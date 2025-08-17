// Konfigurasi Bot WhatsApp
export const config = {
  // API Keys (jika diperlukan untuk fitur tambahan)
  apikey: {
    openai: "your-openai-api-key-here",
    gemini: "your-gemini-api-key-here",
    maelyn: "lexxganz",
  },

  // Informasi Bot
  namaBot: "ZephyreBot",

  // Nomor Owner (format: 628xxx)
  nomorOwner: "62882009391607",

  // Nama Owner
  namaOwner: "LexxGanz",

  // Link Grup Bot
  linkGrupBot: "https://chat.whatsapp.com/your-group-link",

  // Prefix Command
  prefix: ".",

  // Pengaturan Bot
  botSettings: {
    autoRead: true,
    autoTyping: false,
    selfBot: false,
  },

  // Pesan Default
  messages: {
    owner: "Fitur ini hanya untuk owner!",
    group: "Fitur ini hanya bisa digunakan di grup!",
    private: "Fitur ini hanya bisa digunakan di chat pribadi!",
    wait: "Tunggu sebentar...",
    error: "Terjadi kesalahan!",
  },
};

export default config;
