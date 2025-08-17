import config from "../../config/setting.js";
import {
  rateLimiter,
  messageFormatter,
  timeFormatter,
  logger,
  validator,
} from "../../utils/helpers.js";
import { isPremium, isOwner } from "../../utils/database.js";
import { menfessManager } from "../../utils/menfessManager.js";

export default {
  name: "menfess",
  aliases: ["confess", "menfesschat"],
  description: "Fitur chat anonim menggunakan perintah manual.",
  usage:
    `${config.prefix}menfess <nomor>|<pesan>\n` +
    `${config.prefix}menfess [terima|tolak|stop]`,
  category: "others",
  cooldown: 300, // Cooldown 5 menit
  ownerOnly: false,
  premiumOnly: true, // Menandakan command ini butuh premium
  groupOnly: false,
  privateOnly: true, // Hanya bisa digunakan di chat pribadi

  async execute(sock, m, args) {
    try {
      const command = args[0]?.toLowerCase();
      const sender = m.key.remoteJid; // Di chat pribadi, sender adalah remoteJid
      const senderNumber = sender.split("@")[0];

      // --- Handle untuk menghentikan sesi ---
      if (command === "stop") {
        const partnerJid = menfessManager.endSession(sender);
        if (partnerJid) {
          await sock.sendMessage(sender, {
            text: "💬 Sesi menfess telah berakhir.",
          });
          await sock.sendMessage(partnerJid, {
            text: "💬 Partner Anda telah mengakhiri sesi menfess.",
          });
        } else {
          await sock.sendMessage(
            sender,
            { text: "Kamu tidak sedang dalam sesi menfess." },
            { quoted: m }
          );
        }
        return;
      }

      // --- Handle untuk menerima permintaan ---
      if (command === "terima") {
        const targetJid = sender;
        const senderJid = menfessManager.acceptRequest(targetJid);
        if (senderJid) {
          await sock.sendMessage(targetJid, {
            text: "✅ Kamu telah menerima permintaan. Sesi chat anonim dimulai!\n\nKetik `.menfess stop` untuk mengakhiri sesi.",
          });
          await sock.sendMessage(senderJid, {
            text: "🎉 Target menerima permintaanmu! Sesi chat anonim dimulai.\n\nKetik `.menfess stop` untuk mengakhiri sesi.",
          });
        } else {
          await sock.sendMessage(targetJid, {
            text: "⚠️ Tidak ada permintaan menfess yang tertunda untukmu.",
          });
        }
        return;
      }

      // --- Handle untuk menolak permintaan ---
      if (command === "tolak") {
        const targetJid = sender;
        const senderJid = menfessManager.declineRequest(targetJid);
        if (senderJid) {
          await sock.sendMessage(targetJid, {
            text: "❌ Kamu telah menolak permintaan menfess.",
          });
          await sock.sendMessage(senderJid, {
            text: "😔 Maaf, permintaan menfess chat kamu ditolak oleh target.",
          });
        } else {
          await sock.sendMessage(targetJid, {
            text: "⚠️ Tidak ada permintaan menfess yang tertunda untukmu.",
          });
        }
        return;
      }

      // Cek permission: Hanya Owner atau Premium
      const isUserOwner = isOwner(sender);
      const isUserPremium = isPremium(sender);

      if (!isUserOwner && !isUserPremium) {
        return await sock.sendMessage(
          sender,
          {
            text: messageFormatter.error(
              "Fitur ini hanya untuk pengguna Premium atau Owner."
            ),
          },
          { quoted: m }
        );
      }

      // Cek cooldown (owner tidak kena cooldown)
      if (rateLimiter.isOnCooldown(senderNumber) && !isUserOwner) {
        const remainingTime = rateLimiter.getRemainingTime(senderNumber);
        return await sock.sendMessage(
          sender,
          {
            text: messageFormatter.warning(
              `Tunggu ${timeFormatter.formatMs(
                remainingTime
              )} sebelum mengirim menfess lagi!`
            ),
          },
          { quoted: m }
        );
      }

      // Cek apakah user sudah dalam sesi
      if (menfessManager.findSession(sender)) {
        return await sock.sendMessage(
          sender,
          {
            text: "❌ Kamu sudah berada dalam sesi menfess. Ketik `.menfess stop` untuk mengakhiri.",
          },
          { quoted: m }
        );
      }

      const text = args.join(" ");

      // Validasi format input
      if (!text.includes("|")) {
        return await sock.sendMessage(
          sender,
          {
            text: `Format salah. Gunakan: ${this.usage}\n\nContoh:\n.menfess 6281234567890|Hai, aku pengagum rahasiamu.`,
          },
          { quoted: m }
        );
      }

      const [targetPart, ...messageParts] = text.split("|");
      const targetNumber = targetPart.trim().replace(/[^0-9]/g, ""); // Bersihkan nomor dari karakter non-digit
      const initialMessage = messageParts.join("|").trim();

      if (!validator.isValidWhatsAppNumber(targetNumber)) {
        return await sock.sendMessage(
          sender,
          {
            text: messageFormatter.error(
              "Nomor tujuan tidak valid. Gunakan format 628xxx."
            ),
          },
          { quoted: m }
        );
      }

      if (!initialMessage) {
        return await sock.sendMessage(
          sender,
          { text: messageFormatter.error("Pesan tidak boleh kosong.") },
          { quoted: m }
        );
      }

      if (targetNumber === config.nomorOwner || targetNumber === senderNumber) {
        return await sock.sendMessage(
          sender,
          {
            text: messageFormatter.error(
              "Tidak bisa mengirim menfess ke diri sendiri atau ke Owner."
            ),
          },
          { quoted: m }
        );
      }

      const targetJid = `${targetNumber}@s.whatsapp.net`;

      // Buat permintaan di menfessManager
      const requestCreated = menfessManager.createRequest(sender, targetJid);
      if (!requestCreated) {
        return await sock.sendMessage(
          sender,
          {
            text: messageFormatter.warning(
              "Target tersebut sedang memiliki permintaan menfess lain yang tertunda. Coba lagi nanti."
            ),
          },
          { quoted: m }
        );
      }

      const requestMessage = {
        text:
          `💌 *Permintaan Menfess Chat Diterima*\n\n` +
          `Seseorang ingin memulai chat anonim denganmu.\n\n` +
          `*Pesan Awal:*\n> ${initialMessage}\n\n` +
          `*Untuk merespons, balas pesan ini dengan mengetik salah satu perintah berikut:*\n\n` +
          `➡️ Ketik: *${config.prefix}menfess terima*\n` +
          `_(Untuk menerima permintaan chat)_\n\n` +
          `➡️ Ketik: *${config.prefix}menfess tolak*\n` +
          `_(Untuk menolak permintaan chat)_\n\n` +
          `_Permintaan ini akan batal jika tidak direspons._`,
      };

      // Mengirim pesan permintaan ke target
      await sock.sendMessage(targetJid, requestMessage);

      // Kirim konfirmasi ke pengirim
      await sock.sendMessage(
        sender,
        {
          text: messageFormatter.success(
            `✅ Permintaan menfess chat telah dikirim ke +${targetNumber}. Mohon tunggu respons dari target.`
          ),
        },
        { quoted: m }
      );

      // Set cooldown (owner tidak terpengaruh)
      if (!isUserOwner) {
        rateLimiter.setCooldown(senderNumber, this.cooldown * 1000);
      }

      logger.info(
        `[MENFESS] Menfess sent from ${senderNumber} to ${targetNumber}`
      );
    } catch (error) {
      logger.error(`[MENFESS] Error: ${error.message}`);
      // Cek error spesifik jika nomor tidak ada di WhatsApp
      const targetNumber = args
        .join(" ")
        .split("|")[0]
        .trim()
        .replace(/[^0-9]/g, "");
      if (error.message.includes("jid is not on whatsapp")) {
        await sock.sendMessage(
          sender,
          {
            text: messageFormatter.error(
              `Gagal mengirim permintaan. Nomor +${targetNumber} tidak terdaftar di WhatsApp.`
            ),
          },
          { quoted: m }
        );
      } else {
        await sock.sendMessage(
          sender,
          {
            text: messageFormatter.error(
              "Gagal mengirim menfess. Mungkin bot diblokir oleh target atau terjadi kesalahan lain."
            ),
          },
          { quoted: m }
        );
      }
    }
  },
};
