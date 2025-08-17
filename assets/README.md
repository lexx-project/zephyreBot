# ZephyreBot - WhatsApp Bot

Bot WhatsApp yang dibuat menggunakan Node.js dan library @whiskeysockets/baileys dengan sistem command yang modular.

## 📁 Struktur Project

```
ZephyreBot/
│
├── 📁 commands/
│   └── ping.js          # Command .ping untuk cek delay bot
│
├── 📁 session/          # Folder untuk menyimpan auth session bot
│
├── 📁 config/
│   └── setting.js       # File konfigurasi bot
│
├── index.js             # File utama bot
├── package.json         # Dependencies dan scripts
└── README.md           # Dokumentasi ini
```

## 🚀 Instalasi

1. Clone atau download project ini
2. Install dependencies:

   ```bash
   npm install
   ```

3. Edit konfigurasi di `config/setting.js` sesuai kebutuhan:

   - Ganti `nomorOwner` dengan nomor WhatsApp Anda
   - Sesuaikan `namaBot` dan pengaturan lainnya

4. Jalankan bot:

   ```bash
   npm start
   ```

   atau untuk development:

   ```bash
   npm run dev
   ```

5. Scan QR Code yang muncul di terminal dengan WhatsApp Anda

## 📋 Commands

### `.ping`

Mengecek delay/ping bot dalam millisecond.

**Usage:** `.ping`

**Response:** `🏓 Pong! {delay}ms`

## ⚙️ Konfigurasi

Edit file `config/setting.js` untuk mengubah:

- **namaBot**: Nama bot yang akan ditampilkan
- **nomorOwner**: Nomor WhatsApp owner (format: 628xxx)
- **prefix**: Prefix untuk command (default: `.`)
- **linkGrupBot**: Link grup bot
- **apikey**: API keys untuk fitur tambahan
- **botSettings**: Pengaturan behavior bot

## 🔧 Menambah Command Baru

1. Buat file baru di folder `commands/` (misal: `help.js`)
2. Gunakan template berikut:

```javascript
import { config } from "../config/setting.js";

export const command = {
  name: "help",
  description: "Menampilkan daftar command",
  usage: `${config.prefix}help`,
  category: "utility",

  async execute(sock, message, args) {
    try {
      await sock.sendMessage(message.key.remoteJid, {
        text: "Daftar command:\n.ping - Cek delay bot",
      });
    } catch (error) {
      console.error("Error di command help:", error);
    }
  },
};

export default command;
```

3. Restart bot, command akan otomatis dimuat

## 📝 Logging

Bot akan menampilkan log di console untuk:

- Pesan masuk: `[CHAT] dari 628xxx: .ping`
- Command yang dijalankan: `🤖 Menjalankan command: ping`
- Status koneksi dan error

## 🛠️ Troubleshooting

### Bot tidak merespon

- Pastikan QR Code sudah di-scan
- Cek koneksi internet
- Lihat log error di console

### Command tidak berfungsi

- Pastikan menggunakan prefix yang benar (default: `.`)
- Cek apakah file command ada di folder `commands/`
- Lihat log di console untuk error

### Session error

- Hapus folder `session/` dan scan ulang QR Code

## 📄 License

MIT License - Silakan digunakan dan dimodifikasi sesuai kebutuhan.

## 🤝 Contributing

Silakan buat pull request atau issue untuk improvement dan bug fixes.

---

**Dibuat dengan ❤️ menggunakan @whiskeysockets/baileys**
