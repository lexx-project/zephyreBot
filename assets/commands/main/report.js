import config from "../../config/setting.js";
import {
  rateLimiter,
  messageFormatter,
  timeFormatter,
  logger,
} from "../../utils/helpers.js";

export default {
  name: "report",
  aliases: ["bug", "lapor"],
  description: "Mengirim laporan bug atau error pada bot ke owner.",
  usage: `${config.prefix}report <deskripsi error>`,
  category: "main",
  limitExempt: true, // Tidak menggunakan limit
  cooldown: 120, // Cooldown 2 menit untuk mencegah spam laporan

  async execute(sock, m, args) {
    const chatId = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    const senderNumber = sender.split("@")[0];
    const pushName = m.pushName || "User";
    const reportText = args.join(" ");

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
              )} sebelum mengirim laporan lagi!`
            ),
          },
          { quoted: m }
        );
      }

      // Validasi input
      if (!reportText) {
        return await sock.sendMessage(
          chatId,
          { text: `Contoh: ${this.usage}` },
          { quoted: m }
        );
      }

      // Format pesan untuk owner
      const ownerJid = `${config.nomorOwner}@s.whatsapp.net`;
      const messageForOwner = `🐞 *LAPORAN BUG/ERROR BARU*\n\n*Dari:* ${pushName} (@${senderNumber})\n*Laporan:* ${reportText}`;

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
            "✅ Laporan Anda telah berhasil dikirim ke owner. Terima kasih atas bantuannya dalam meningkatkan kualitas bot!"
          ),
        },
        { quoted: m }
      );

      // Set cooldown
      rateLimiter.setCooldown(senderNumber, this.cooldown * 1000);

      logger.info(`[REPORT] Laporan dari ${senderNumber}: ${reportText}`);
    } catch (error) {
      logger.error(`[REPORT] Error: ${error.message}`);
      await sock.sendMessage(
        chatId,
        {
          text: messageFormatter.error(
            "Gagal mengirim laporan. Silakan coba lagi nanti."
          ),
        },
        { quoted: m }
      );
    }
  },
};
