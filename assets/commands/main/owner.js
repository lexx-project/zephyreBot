import config from "../../config/setting.js";
import { rateLimiter, messageFormatter, logger } from "../../utils/helpers.js";

export const command = {
  name: "owner",
  description: "Menampilkan kontak owner bot",
  usage: `${config.prefix}owner`,
  category: "main",
  cooldown: 5000, // 5 detik cooldown
  limitExempt: true, // Tidak menggunakan limit

  async execute(sock, message, args) {
    try {
      const chatId = message.key.remoteJid;
      const sender = message.key.participant || message.key.remoteJid;
      const senderNumber = sender.split("@")[0];

      // Rate limiting check
      if (rateLimiter.isOnCooldown(senderNumber)) {
        const remainingTime = rateLimiter.getRemainingTime(senderNumber);
        await sock.sendMessage(
          chatId,
          {
            text: messageFormatter.warning(
              `Tunggu ${Math.ceil(
                remainingTime / 1000
              )} detik sebelum menggunakan command ini lagi!`
            ),
          },
          { quoted: message }
        );
        return;
      }

      // Kirim pesan peringatan terlebih dahulu
      const warningMessage = messageFormatter.warning(
        `⚠️ *PERINGATAN PENTING:*\n` +
          `• Jangan spam chat owner\n` +
          `• Gunakan bahasa yang sopan\n` +
          `• Hanya hubungi untuk hal penting\n` +
          `• Owner berhak memblokir jika melanggar`
      );

      await sock.sendMessage(
        chatId,
        {
          text: warningMessage,
        },
        { quoted: message }
      );

      // Tunggu 2 detik sebelum mengirim kontak
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Kirim kontak owner
      const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${config.namaOwner}\nORG:ZephyreBot Owner\nTEL;type=CELL;type=VOICE;waid=${config.nomorOwner}:+${config.nomorOwner}\nEND:VCARD`;

      await sock.sendMessage(
        chatId,
        {
          contacts: {
            displayName: config.namaOwner,
            contacts: [{ vcard }],
          },
        },
        { quoted: message }
      );

      // Set cooldown
      rateLimiter.setCooldown(senderNumber, this.cooldown);

      // Log aktivitas
      logger.info(`[OWNER] Kontak owner dikirim ke ${senderNumber}`);
    } catch (error) {
      logger.error(`[OWNER] Error: ${error.message}`);
      const chatId = message.key.remoteJid;
      await sock.sendMessage(
        chatId,
        {
          text: messageFormatter.error(
            "❌ Terjadi kesalahan saat mengirim kontak owner!"
          ),
        },
        { quoted: message }
      );
    }
  },
};

export default command;
