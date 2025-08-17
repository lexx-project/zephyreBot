import config from "../../config/setting.js";
import { rateLimiter, messageFormatter, logger } from "../../utils/helpers.js";
import { getUser } from "../../utils/database.js";

export default {
  name: "premium",
  aliases: ["buypremium", "buyprem"],
  description: "Cek status premium atau info cara beli premium",
  usage: `${config.prefix}premium | ${config.prefix}buypremium`,
  category: "main",
  limitExempt: true, // Tidak menggunakan limit
  cooldown: 3000,

  async execute(sock, message, args) {
    try {
      const chatId = message.key.remoteJid;
      const sender = message.key.participant || message.key.remoteJid;
      const senderNumber = sender.split("@")[0];

      // Get the text content from message
      const text =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        message.message?.imageMessage?.caption ||
        "";

      const command = text
        .toLowerCase()
        .split(" ")[0]
        .replace(config.prefix, "");

      // Rate limiting check
      if (rateLimiter.isOnCooldown(senderNumber)) {
        const remainingTime = rateLimiter.getRemainingTime(senderNumber);
        await messageFormatter.sendMessage(
          sock,
          chatId,
          {
            text: messageFormatter.warning(
              `Tunggu ${Math.ceil(
                remainingTime / 1000
              )} detik sebelum menggunakan command ini lagi!`
            ),
          },
          message
        );
        return;
      }

      const user = getUser(sender);
      const isOwner = senderNumber === config.nomorOwner;

      // Handle different commands
      if (command === "premium") {
        // Premium status check
        let statusText = `💎 *STATUS PREMIUM*\n\n`;
        statusText += `👤 *User:* ${message.pushName || "User"}\n`;

        if (isOwner) {
          statusText += `👑 *Status:* Owner\n`;
          statusText += `🔥 *Privilege:* Unlimited Access\n`;
          statusText += `⏰ *Expired:* Never\n\n`;
          statusText += `🎯 *Benefits:*\n`;
          statusText += `• Unlimited limit harian\n`;
          statusText += `• Akses semua fitur bot\n`;
          statusText += `• Priority support\n`;
          statusText += `• No cooldown restrictions\n`;
        } else if (user.isPremium) {
          const premiumExpiry = user.premiumExpiry
            ? new Date(user.premiumExpiry)
            : null;
          const now = new Date();

          if (premiumExpiry && now > premiumExpiry) {
            // Premium expired
            user.isPremium = false;
            user.premiumExpiry = null;
            statusText += `🆓 *Status:* Free User (Premium Expired)\n`;
            statusText += `⏰ *Expired:* ${premiumExpiry.toLocaleDateString(
              "id-ID"
            )}\n\n`;
            statusText += `💡 *Upgrade ke Premium untuk mendapatkan:*\n`;
            statusText += `• Limit harian 500 (vs 50)\n`;
            statusText += `• Akses fitur premium\n`;
            statusText += `• Priority support\n\n`;
            statusText += `💰 *Harga:* Rp 5,000 per 30 hari\n`;
            statusText += `📝 *Cara beli:* ${config.prefix}buypremium`;
          } else {
            statusText += `💎 *Status:* Premium User\n`;
            statusText += `⏰ *Expired:* ${
              premiumExpiry
                ? premiumExpiry.toLocaleDateString("id-ID")
                : "Lifetime"
            }\n\n`;
            statusText += `🎯 *Benefits:*\n`;
            statusText += `• Limit harian 500\n`;
            statusText += `• Akses fitur premium\n`;
            statusText += `• Priority support\n\n`;
            statusText += `🔄 *Extend Premium:* ${config.prefix}buypremium`;
          }
        } else {
          statusText += `🆓 *Status:* Free User\n`;
          statusText += `⏰ *Expired:* -\n\n`;
          statusText += `💡 *Upgrade ke Premium untuk mendapatkan:*\n`;
          statusText += `• Limit harian 500 (vs 50)\n`;
          statusText += `• Akses fitur premium\n`;
          statusText += `• Priority support\n\n`;
          statusText += `💰 *Harga:* Rp 5,000 per 30 hari\n`;
          statusText += `📝 *Cara beli:* ${config.prefix}buypremium`;
        }

        await sock.sendMessage(
          chatId,
          {
            text: statusText,
          },
          { quoted: message }
        );

        // Log aktivitas
        logger.info(`[PREMIUM] Status premium dicek oleh ${senderNumber}`);
      } else if (command === "buypremium" || command === "buyprem") {
        // Buy premium info
        if (isOwner) {
          await messageFormatter.sendMessage(
            sock,
            chatId,
            {
              text: messageFormatter.info(
                "👑 Owner sudah memiliki akses unlimited! Tidak perlu membeli premium."
              ),
            },
            message
          );
          return;
        }

        // Informasi cara membeli premium
        const buyInfoText =
          `💎 *CARA BELI PREMIUM*\n\n` +
          `📞 *Hubungi Owner:* wa.me/${config.nomorOwner}\n` +
          `💰 *Harga:* Rp 5,000 per 30 hari\n` +
          `⏰ *Durasi:* 1-365 hari\n\n` +
          `🎯 *Benefits Premium:*\n` +
          `• Limit harian 500 (vs 50)\n` +
          `• Akses fitur premium\n` +
          `• Priority support\n\n` +
          `📝 *Format chat ke owner:*\n` +
          `"Halo, saya ingin beli premium [durasi] hari"\n\n` +
          `💡 *Contoh:* "Halo, saya ingin beli premium 30 hari"\n\n` +
          `⚠️ *Note:* Premium dibeli dengan transfer uang real, bukan saldo bot!`;

        await messageFormatter.sendMessage(
          sock,
          chatId,
          {
            text: buyInfoText,
          },
          message
        );

        // Log aktivitas
        logger.info(
          `[BUYPREMIUM] ${senderNumber} melihat info cara beli premium`
        );
      }

      // Set cooldown
      rateLimiter.setCooldown(senderNumber, this.cooldown);
    } catch (error) {
      logger.error(`[PREMIUM] Error: ${error.message}`);
      const chatId = message.key.remoteJid;
      await sock.sendMessage(
        chatId,
        {
          text: messageFormatter.error(
            "❌ Terjadi kesalahan saat mengecek/membeli premium!"
          ),
        },
        { quoted: message }
      );
    }
  },
};
