import config from "../../config/setting.js";
import {
  rateLimiter,
  messageFormatter,
  logger,
  validator,
} from "../../utils/helpers.js";
import { getUser, saveDatabase, loadDatabase } from "../../utils/database.js";

export const command = {
  name: "addprem",
  aliases: ["addpremium"],
  description: "Menambahkan premium ke user atau memperpanjang durasi premium",
  usage: `${config.prefix}addprem <nomor> <durasi_hari>`,
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
      if (args.length < 2) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: `📝 *Penggunaan:* ${config.prefix}addprem <nomor> <durasi>\n💡 *Contoh:* ${config.prefix}addprem 628123456789 30`,
          },
          { quoted: message }
        );
        return;
      }

      const targetNumber = args[0].replace(/[^0-9]/g, "");
      const duration = parseInt(args[1]);

      // Validasi nomor
      if (!validator.isValidWhatsAppNumber(targetNumber)) {
        await messageFormatter.sendMessage(sock, message, {
          text: messageFormatter.error("❌ Nomor WhatsApp tidak valid!"),
        });
        return;
      }

      // Validasi durasi
      if (isNaN(duration) || duration < 1 || duration > 365) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: messageFormatter.error(
              "❌ Durasi harus berupa angka positif (dalam hari)!"
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

      // Hitung tanggal expiry baru
      const now = new Date();
      let newExpiry;

      if (user.isPremium && user.premiumExpiry) {
        // Extend existing premium
        const currentExpiry = new Date(user.premiumExpiry);
        if (currentExpiry > now) {
          // Premium masih aktif, extend dari tanggal expiry
          newExpiry = new Date(
            currentExpiry.getTime() + duration * 24 * 60 * 60 * 1000
          );
        } else {
          // Premium sudah expired, mulai dari sekarang
          newExpiry = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
        }
      } else {
        // New premium
        newExpiry = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
      }

      // Update user data
      user.isPremium = true;
      user.premiumExpiry = newExpiry.toISOString();
      user.limit = 500; // Reset limit to premium amount

      // Save to database
      db.users[targetUserId] = user;
      saveDatabase(db);

      const statusText =
        user.isPremium &&
        user.premiumExpiry &&
        new Date(user.premiumExpiry) > now
          ? "diperpanjang"
          : "ditambahkan";

      const successText = messageFormatter.success(
        `✅ *Premium berhasil ${statusText}!*\n\n` +
          `👤 *Target:* +${targetNumber}\n` +
          `💎 *Status:* Premium User\n` +
          `⏰ *Berlaku hingga:* ${newExpiry.toLocaleDateString("id-ID")}\n` +
          `📅 *Durasi ditambahkan:* ${duration} hari\n` +
          `🎯 *Limit harian:* 500\n\n` +
          `🎉 *User sekarang memiliki akses premium!*`
      );

      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: successText,
        },
        { quoted: message }
      );

      // Kirim notifikasi ke user yang mendapat premium (jika bukan grup)
      if (validator.isPrivate(chatId) && chatId !== targetUserId) {
        try {
          const notificationText = messageFormatter.info(
            `🎉 *Selamat! Kamu mendapat premium!*\n\n` +
              `💎 *Status:* Premium User\n` +
              `⏰ *Berlaku hingga:* ${newExpiry.toLocaleDateString(
                "id-ID"
              )}\n` +
              `📅 *Durasi:* ${duration} hari\n\n` +
              `🎯 *Benefits:*\n` +
              `• Limit harian 500\n` +
              `• Akses fitur premium\n` +
              `• Priority support\n\n` +
              `🙏 *Terima kasih telah menggunakan bot ini!*`
          );

          await sock.sendMessage(targetUserId, {
            text: notificationText,
          });
        } catch (notifError) {
          logger.warning(
            `[ADDPREM] Gagal mengirim notifikasi ke ${targetNumber}: ${notifError.message}`
          );
        }
      }

      // Set cooldown
      rateLimiter.setCooldown(senderNumber, this.cooldown);

      // Log aktivitas
      logger.info(
        `[ADDPREM] Owner ${senderNumber} menambahkan premium ${duration} hari ke ${targetNumber}`
      );
    } catch (error) {
      logger.error(`[ADDPREM] Error: ${error.message}`);
      const chatId = message.key.remoteJid;
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: messageFormatter.error(
            "❌ Terjadi kesalahan saat menambahkan premium!"
          ),
        },
        { quoted: message }
      );
    }
  },
};

export default command;
