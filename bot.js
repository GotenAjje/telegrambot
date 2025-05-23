import 'dotenv/config'
import TelegramBot from 'node-telegram-bot-api'
import { GoogleGenAI, Modality } from '@google/genai'
import fs from 'fs/promises'
import * as fsSync from 'node:fs'

let fetchFn
try {
  fetchFn = fetch
} catch {
  fetchFn = (await import('node-fetch')).then(mod => mod.default)
}

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })

async function readPersona() {
  try {
    const content = await fs.readFile('./persona.txt', 'utf-8')
    return content.trim() || null
  } catch {
    return null
  }
}

async function buildContentText(persona, replyText, question) {
  let combined = ''
  if (persona) combined += persona + '\n\n---\n\n'
  if (replyText) combined += replyText + '\n\n'
  combined += question
  return combined
}

async function handleQuestion(msg, question, replyText = '') {
  const persona = await readPersona()
  const content = await buildContentText(persona, replyText, question)

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: content }] }],
    })

    const answer = response.candidates?.[0]?.content?.parts?.map(p => p.text).join(' ') || 'Maaf, tidak ada jawaban.'
    await bot.sendMessage(msg.chat.id, answer, {
      reply_to_message_id: msg.message_id,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    })
  } catch (error) {
    console.error('handleQuestion error:', error)
    await bot.sendMessage(msg.chat.id, 'Terjadi kesalahan saat menjawab.', {
      reply_to_message_id: msg.message_id,
    })
  }
}

async function handleImageRequest(msg, prompt) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-preview-image-generation',
      contents: [{ text: prompt }],
      config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
    })

    let imageSent = false
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.text) {
        await bot.sendMessage(msg.chat.id, part.text, {
          reply_to_message_id: msg.message_id,
          parse_mode: 'HTML',
        })
      } else if (part.inlineData) {
        const buffer = Buffer.from(part.inlineData.data, 'base64')
        const fileName = `img_${msg.message_id}.png`
        await fs.writeFile(fileName, buffer)
        await bot.sendPhoto(msg.chat.id, fileName, {
          reply_to_message_id: msg.message_id,
        })
        await fs.unlink(fileName)
        imageSent = true
      }
    }

    if (!imageSent) {
      await bot.sendMessage(msg.chat.id, 'Maaf, gambar tidak dapat dibuat.', {
        reply_to_message_id: msg.message_id,
      })
    }
  } catch (error) {
    console.error('handleImageRequest error:', error)
    await bot.sendMessage(msg.chat.id, 'Kesalahan saat membuat gambar.', {
      reply_to_message_id: msg.message_id,
    })
  }
}

async function handleImageEditFromMessage(msg, captionPrompt) {
  const photo = msg.photo?.at(-1) || msg.reply_to_message?.photo?.at(-1)
  if (!photo) return

  try {
    const fileLink = await bot.getFileLink(photo.file_id)
    const res = await fetchFn(fileLink)
    const base64Image = Buffer.from(await res.arrayBuffer()).toString('base64')

    const contents = [
      { text: captionPrompt },
      { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
    ]

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-preview-image-generation',
      contents,
      config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
    })

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.text) {
        await bot.sendMessage(msg.chat.id, part.text, {
          reply_to_message_id: msg.message_id,
          parse_mode: 'HTML',
        })
      } else if (part.inlineData) {
        const buffer = Buffer.from(part.inlineData.data, 'base64')
        const fileName = `edit_${msg.message_id}.png`
        await fs.writeFile(fileName, buffer)
        await bot.sendPhoto(msg.chat.id, fileName, {
          reply_to_message_id: msg.message_id,
        })
        await fs.unlink(fileName)
      }
    }
  } catch (error) {
    console.error('handleImageEdit error:', error)
    await bot.sendMessage(msg.chat.id, 'Gagal memproses gambar.', {
      reply_to_message_id: msg.message_id,
    })
  }
}

bot.on('polling_error', error => console.error('Polling error:', error))

bot.onText(/^\/(start|help)/, msg => {
  const message = `Author: @Goten_Reallaccount
Channel: @gotenbest
Group: @gotenbest

Gunakan perintah:
/tanya [pertanyaan]
/gambar [deskripsi gambar]`
  bot.sendMessage(msg.chat.id, message)
})

bot.onText(/^\/tanya (.+)/, async (msg, match) => {
  const question = match[1].trim()
  const replyText = msg.reply_to_message?.text || ''
  return await handleQuestion(msg, question, replyText)
})

bot.onText(/^\/gambar (.+)/, async (msg, match) => {
  return await handleImageRequest(msg, match[1].trim())
})

bot.on('message', async msg => {
  const chatType = msg.chat.type
  const text = msg.text?.trim() || ''
  const caption = msg.caption?.trim() || ''
  const botUsername = bot.botInfo?.username || ''
  const isMentioned = text.includes(`@${botUsername}`) || caption.includes(`@${botUsername}`)

  const questionText = text.replace(`@${botUsername}`, '').trim()
  const promptText = caption.replace(`@${botUsername}`, '').trim()

  const shouldHandleImage =
    msg.photo ||
    msg.document?.mime_type?.startsWith('image/') ||
    msg.reply_to_message?.photo ||
    msg.reply_to_message?.document?.mime_type?.startsWith('image/')

  if (shouldHandleImage && (caption || text)) {
    return await handleImageEditFromMessage(msg, caption || text)
  }

  if (
    chatType === 'private' ||
    (chatType !== 'private' &&
      (msg.reply_to_message?.from?.id === bot.botInfo?.id || isMentioned))
  ) {
    const question = questionText || promptText
    const replyText = msg.reply_to_message?.text || ''
    if (question) {
      return await handleQuestion(msg, question, replyText)
    }
  }
})
