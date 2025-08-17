import config from "../../config/setting.js";
import {
  rateLimiter,
  messageFormatter,
  timeFormatter,
  logger,
} from "../../utils/helpers.js";

export default {
  name: "request",
  aliases: ["req", "fitur"],
  description: "Mengirim permintaan fitur baru ke owner bot.",
  usage: `${config.prefix}request <deskripsi fitur>`,
  category: "main",
  limitExempt: true, // Tidak menggunakan limit
  cooldown: 60, // Cooldown 1 menit untuk mencegah spam

  async execute(sock, m, args) {
    const chatId = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    const senderNumber = sender.split("@")[0];
    const pushName = m.pushName || "User";
    const requestText = args.join(" ");

    try {
      // Rate limiting check
      if (rateLimiter.isOnCooldown(senderNumber)) {
        const remainingTime = rateLimiter.getRemainingTime(senderNumber);
        return await sock.sendMessage(
          chatId,
          {
            text: messageFormatter.warning(
              `Tunggu ${timeFormatter.formatMs(
                remainingTime
              )} sebelum mengirim request lagi!`
            ),
          },
          { quoted: m }
        );
      }

      // Validasi input
      if (!requestText) {
        return await sock.sendMessage(
          chatId,
          { text: `Contoh: ${this.usage}` },
          { quoted: m }
        );
      }

      // Format pesan untuk owner
      const ownerJid = `${config.nomorOwner}@s.whatsapp.net`;
      const messageForOwner = `📬 *REQUEST FITUR BARU*\n\n*Dari:* ${pushName} (@${senderNumber})\n*Request:* ${requestText}`;

      // Kirim pesan ke owner
      await sock.sendMessage(ownerJid, {
        text: messageForOwner,
        mentions: [sender],
      });

      // Kirim konfirmasi ke user
      await sock.sendMessage(
        chatId,
        {
          text: messageFormatter.success(
            "✅ Request Anda telah berhasil dikirim ke owner. Terima kasih atas masukannya!"
          ),
        },
        { quoted: m }
      );

      // Set cooldown
      rateLimiter.setCooldown(senderNumber, this.cooldown * 1000);

      logger.info(`[REQUEST] Request dari ${senderNumber}: ${requestText}`);
    } catch (error) {
      logger.error(`[REQUEST] Error: ${error.message}`);
      await sock.sendMessage(
        chatId,
        {
          text: messageFormatter.error(
            "Gagal mengirim request. Silakan coba lagi nanti."
          ),
        },
        { quoted: m }
      );
    }
  },
};
