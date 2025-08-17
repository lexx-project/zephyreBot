import config from "../../config/setting.js";
import { messageFormatter, logger } from "../../utils/helpers.js";

// Map untuk menyimpan sesi pencarian per-chat.
// Ini akan di-reset setiap kali bot di-restart.
const searchSessions = new Map();

/**
 * Mengirim gambar Pinterest beserta tombol navigasi.
 * @param {object} sock - Socket Baileys.
 * @param {object} message - Objek pesan asli.
 */
async function sendPinterestImage(sock, message) {
  const chatId = message.key.remoteJid;
  const session = searchSessions.get(chatId);

  if (!session) {
    return sock.sendMessage(
      chatId,
      { text: "Sesi pencarian tidak ditemukan atau telah berakhir." },
      { quoted: message }
    );
  }

  const imageUrl = session.results[session.currentIndex];
  const isLastImage = session.currentIndex >= session.results.length - 1;

  const buttons = [];
  if (!isLastImage) {
    buttons.push({
      buttonId: `${config.prefix}pin next`,
      buttonText: { displayText: "➡️ Next" },
      type: 1,
    });
  }

  const caption = `Gambar ${session.currentIndex + 1} dari ${
    session.results.length
  }`;

  await sock.sendMessage(
    chatId,
    {
      image: { url: imageUrl },
      caption: caption,
      footer: `© ${config.namaBot}`,
      buttons: buttons,
      headerType: 4,
    },
    { quoted: message }
  );

  // Hapus sesi jika sudah mencapai gambar terakhir
  if (isLastImage) {
    searchSessions.delete(chatId);
  }
}

export default {
  name: "pin",
  aliases: ["pinterest"],
  category: "download",
  description: "Mencari gambar di Pinterest.",
  usage: `${config.prefix}pin <query>`,
  cooldown: 5,

  async execute(sock, message, args) {
    const chatId = message.key.remoteJid;
    const action = args[0]?.toLowerCase();

    // --- Logika untuk Tombol "Next" ---
    if (action === "next") {
      const session = searchSessions.get(chatId);
      if (!session) {
        return sock.sendMessage(
          chatId,
          { text: "Sesi pencarian tidak ditemukan atau telah berakhir." },
          { quoted: message }
        );
      }

      session.currentIndex++;
      await sendPinterestImage(sock, message);
      return;
    }

    // --- Logika untuk Pencarian Baru ---
    const query = args.join(" ");
    if (!query) {
      return sock.sendMessage(
        chatId,
        { text: `Contoh: ${this.usage}` },
        { quoted: message }
      );
    }

    await sock.sendMessage(
      chatId,
      { text: config.messages.wait },
      { quoted: message }
    );

    try {
      const apiUrl = `https://api.maelyn.sbs/api/pinterest/search?q=${encodeURIComponent(
        query
      )}`;
      const response = await fetch(apiUrl, {
        headers: { "mg-apikey": config.apikey.maelyn },
      });

      if (!response.ok)
        throw new Error(`API request gagal: ${response.status}`);

      const data = await response.json();
      if (
        data.status !== "Success" ||
        !data.result ||
        data.result.length === 0
      ) {
        return sock.sendMessage(
          chatId,
          { text: "❌ Gambar tidak ditemukan." },
          { quoted: message }
        );
      }

      // Simpan sesi pencarian baru
      searchSessions.set(chatId, {
        results: data.result,
        currentIndex: 0,
      });

      // Kirim gambar pertama
      await sendPinterestImage(sock, message);
    } catch (error) {
      logger.error(`[PINTEREST] Error: ${error.message}`);
      await sock.sendMessage(
        chatId,
        { text: messageFormatter.error(`Terjadi kesalahan: ${error.message}`) },
        { quoted: message }
      );
    }
  },
};
