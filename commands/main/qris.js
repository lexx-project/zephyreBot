import config from "../../config/setting.js";
import { messageFormatter, logger } from "../../utils/helpers.js";

export default {
  name: "qris",
  aliases: ["donasi", "donate"],
  description: "Menampilkan QRIS untuk donasi.",
  usage: `${config.prefix}qris`,
  category: "main",
  cooldown: 10,

  async execute(sock, m, args) {
    const chatId = m.key.remoteJid;
    const qrisUrl = "https://files.catbox.moe/iyodxs.jpg";
    const caption = `*_SCAN QRIS DI ATAS UNTUK DONASI_*\n\nTerima kasih telah menggunakan *${config.namaBot}*!\nDonasi Anda sangat berarti untuk mendukung pengembangan dan pemeliharaan bot ini.\n\nTerima kasih banyak! 🙏\n- ${config.namaOwner}`;

    try {
      await sock.sendMessage(
        chatId,
        {
          image: { url: qrisUrl },
          caption: caption,
        },
        { quoted: m }
      );
      logger.info(`[QRIS] QRIS donation image sent to ${chatId}`);
    } catch (error) {
      logger.error(`[QRIS] Error sending QRIS image: ${error.message}`);
      await sock.sendMessage(
        chatId,
        { text: messageFormatter.error("Gagal menampilkan gambar QRIS.") },
        { quoted: m }
      );
    }
  },
};
