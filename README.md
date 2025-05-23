## Gemini Telegram Bot  
Bot Telegram yang menggunakan Google Gemini API untuk menjawab pertanyaan dan membuat/mengedit gambar langsung dari Telegram.

## Instalasi dan Penggunaan  
Langkah 1: Clone Repository  
`git clone https://github.com/GotenAjje/telegrambot && cd telegrambot`

Langkah 2: Konfigurasi .env  
`cp .env.example .env && nano .env`  
Isi dengan token dan API key Anda seperti berikut:  
`TELEGRAM_BOT_TOKEN=ISI_TOKEN_BOT_ANDA`  
`GOOGLE_API_KEY=ISI_API_KEY_GEMINI_ANDA`

Langkah 3: Instal Dependensi  
`npm install`

Langkah 4: Jalankan Bot  
`node bot.js`

Catatan: Anda dapat mengedit file `persona.txt` untuk menyesuaikan karakter bot (opsional).

Setelah bot aktif, gunakan perintah berikut di Telegram:  
`/tanya [pertanyaan]` — untuk mengajukan pertanyaan  
`/gambar [deskripsi gambar]` — untuk membuat gambar dari deskripsi  
Balas gambar + teks — untuk mengedit gambar

## More Information   
Author: https://github.com/GotenAjje
credite: https://github.com/RiProG-id
