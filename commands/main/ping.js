import { config } from "../../config/setting.js";
import {
  rateLimiter,
  messageFormatter,
  timeFormatter,
  logger,
} from "../../utils/helpers.js";

export const command = {
  name: "ping",
  description: "Cek ping/delay bot dan informasi sistem",
  usage: `${config.prefix}ping`,
  category: "utility",

  async execute(sock, message, args) {
    try {
      const senderNumber = message.key.remoteJid.split("@")[0];

      // Rate limiting check
      if (rateLimiter.isOnCooldown(senderNumber)) {
        const remainingTime = rateLimiter.getRemainingTime(senderNumber);
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: messageFormatter.warning(
              `Tunggu ${timeFormatter.formatMs(
                remainingTime
              )} sebelum menggunakan command ini lagi!`
            ),
          },
          { quoted: message }
        );
        return;
      }

      // Set cooldown
      rateLimiter.setCooldown(senderNumber, 2000); // 2 detik cooldown untuk ping

      // Catat waktu mulai
      const startTime = Date.now();
      const processStartTime = process.hrtime.bigint();

      // Kirim pesan "Pinging..."
      const sentMessage = await sock.sendMessage(
        message.key.remoteJid,
        {
          text: "🏓 Pinging...",
        },
        { quoted: message }
      );

      // Hitung delay setelah pesan terkirim
      const endTime = Date.now();
      const processEndTime = process.hrtime.bigint();
      const responseTime = endTime - startTime;
      const processTime = Number(processEndTime - processStartTime) / 1000000; // Convert to ms

      // Update pesan dengan hasil ping
      const pingResult =
        `🏓 *Pong!*\n\n` +
        `⚡ *Response Time:* ${responseTime}ms\n` +
        `🔄 *Process Time:* ${processTime.toFixed(2)}ms\n` +
        `💾 *Memory Usage:* ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\n` +
        `⏱️ *Uptime:* ${timeFormatter.formatMs(process.uptime() * 1000)}\n` +
        `📊 *Status:* ${responseTime < 100 ? "Excellent" : responseTime < 300 ? "Good" : "Slow"}`;

      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: pingResult,
          edit: sentMessage.key,
        }
      );

      logger.info(`[PING] Response time: ${responseTime}ms for ${message.key.remoteJid}`);
    } catch (error) {
      logger.error(`[PING] Error: ${error.message}`);
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: messageFormatter.error("❌ Terjadi kesalahan saat mengecek ping!"),
        },
        { quoted: message }
      );
    }
  },
};

export default command;
