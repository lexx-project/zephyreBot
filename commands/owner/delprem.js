import config from "../../config/setting.js";
import {
  rateLimiter,
  messageFormatter,
  logger,
  validator,
} from "../../utils/helpers.js";
import { getUser, saveDatabase, loadDatabase } from "../../utils/database.js";

export const command = {
  name: "delprem",
  aliases: ["deletepremium", "removepremium"],
  description: "Menghapus premium dari user",
  usage: `${config.prefix}delprem <nomor>`,
  category: "owner",
  cooldown: 3000,
  ownerOnly: true,

  async execute(sock, message, args) {
    try {
      const chatId = message.key.remoteJid;
      const sender = message.key.participant || message.key.remoteJid;
      const senderNumber = sender.split("@")[0];

      // Cek apakah user adalah owner
      if (!validator.isOwner(sender)) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: messageFormatter.error("❌ Command ini hanya untuk Owner!"),
          },
          { quoted: message }
        );
        return;
      }

      // Rate limiting check
      if (rateLimiter.isOnCooldown(senderNumber)) {
        const remainingTime = rateLimiter.getRemainingTime(senderNumber);
        await messageFormatter.sendMessage(sock, message, {
          text: messageFormatter.warning(
            `Tunggu ${Math.ceil(
              remainingTime / 1000
            )} detik sebelum menggunakan command ini lagi!`
          ),
        });
        return;
      }

      // Validasi argumen
      if (args.length < 1) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: `📝 *Penggunaan:* ${config.prefix}delprem <nomor>\n💡 *Contoh:* ${config.prefix}delprem 628123456789`,
          },
          { quoted: message }
        );
        return;
      }

      const targetNumber = args[0].replace(/[^0-9]/g, "");

      // Validasi nomor
      if (!validator.isValidWhatsAppNumber(targetNumber)) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: messageFormatter.error(
              "❌ Nomor tidak valid! Gunakan format: 628123456789"
            ),
          },
          { quoted: message }
        );
        return;
      }

      // Format user ID
      const targetUserId = targetNumber + "@s.whatsapp.net";

      // Load database dan get user
      const db = loadDatabase();
      const user = getUser(targetUserId);

      // Cek apakah user memiliki premium
      if (!user.isPremium) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: messageFormatter.warning(
              "⚠️ User tersebut tidak memiliki premium!"
            ),
          },
          { quoted: message }
        );
        return;
      }

      // Simpan info premium sebelum dihapus untuk notifikasi
      const previousExpiry = user.premiumExpiry
        ? new Date(user.premiumExpiry).toLocaleDateString("id-ID")
        : "Tidak diketahui";

      // Hapus premium dari user
      user.isPremium = false;
      user.premiumExpiry = null;
      user.limit = 15; // Reset limit ke free user

      // Save to database
      db.users[targetUserId] = user;
      saveDatabase(db);

      const successText = messageFormatter.success(
        `✅ *Premium berhasil dihapus!*\n\n` +
          `👤 *Target:* +${targetNumber}\n` +
          `💎 *Status:* Free User\n` +
          `⏰ *Premium sebelumnya berlaku hingga:* ${previousExpiry}\n` +
          `🎯 *Limit harian sekarang:* 15\n\n` +
          `📝 *User sekarang kembali ke status free user.*`
      );

      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: messageFormatter.success(
            `✅ Premium berhasil dihapus dari @${targetNumber}!`
          ),
          mentions: [targetUserId],
        },
        { quoted: message }
      );

      // Kirim notifikasi ke user yang premiumnya dihapus (jika bukan grup)
      if (validator.isPrivate(chatId) && chatId !== targetUserId) {
        try {
          const notificationText = messageFormatter.warning(
            `⚠️ *Premium kamu telah dihapus!*\n\n` +
              `💎 *Status:* Free User\n` +
              `⏰ *Premium sebelumnya berlaku hingga:* ${previousExpiry}\n\n` +
              `🎯 *Limit harian sekarang:* 15\n` +
              `💡 *Kamu masih bisa menggunakan bot dengan fitur terbatas.*\n\n` +
              `🙏 *Terima kasih telah menggunakan bot ini!*`
          );

          await sock.sendMessage(targetUserId, {
            text: notificationText,
          });
        } catch (notifError) {
          logger.warning(
            `[DELPREM] Gagal mengirim notifikasi ke ${targetNumber}: ${notifError.message}`
          );
        }
      }

      // Set cooldown
      rateLimiter.setCooldown(senderNumber, this.cooldown);

      // Log aktivitas
      logger.info(
        `[DELPREM] Owner ${senderNumber} menghapus premium dari ${targetNumber}`
      );
    } catch (error) {
      logger.error(`[DELPREM] Error: ${error.message}`);
      const chatId = message.key.remoteJid;
      await sock.sendMessage(message.key.remoteJid, {
        text: messageFormatter.error(
          "❌ Terjadi kesalahan saat menghapus premium!"
        ),
      }, { quoted: message });
    }
  },
};

export default command;
