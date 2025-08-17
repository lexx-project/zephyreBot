import axios from "axios";
import FormData from "form-data";
import { downloadMediaMessage } from "@yupra/baileys";
import { config } from "../../config/setting.js";
import { rateLimiter, messageFormatter, logger } from "../../utils/helpers.js";

export default {
  name: "removebg",
  aliases: ["rbg", "nobg"],
  category: "ai",
  description: "Menghapus background dari sebuah gambar.",
  usage: `Kirim/reply gambar dengan caption ${config.prefix}removebg`,
  cooldown: 10,

  async execute(sock, m, args) {
    try {
      const chatId = m.key.remoteJid;
      const sender = m.key.participant || m.key.remoteJid;
      const senderNumber = sender ? sender.replace(/@.+/, "") : "unknown";

      // Rate limiting
      if (rateLimiter.isOnCooldown(senderNumber)) {
        const remainingTime = rateLimiter.getRemainingTime(senderNumber);
        return sock.sendMessage(
          chatId,
          {
            text: messageFormatter.warning(
              `Tunggu ${Math.ceil(
                remainingTime / 1000
              )} detik lagi sebelum menggunakan command ini!`
            ),
          },
          { quoted: m }
        );
      }

      // Cek apakah ada gambar (logic from hd.js)
      let imageMessage = null;
      let quotedMsg = null;
      let messageToDownload = null;

      if (m.message?.imageMessage) {
        imageMessage = m.message.imageMessage;
        messageToDownload = m;
      } else if (
        m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
      ) {
        quotedMsg = m.message.extendedTextMessage.contextInfo.quotedMessage;
        imageMessage = quotedMsg.imageMessage;
        messageToDownload = {
          key: {
            ...m.key,
            id: m.message.extendedTextMessage.contextInfo.stanzaId,
          },
          message: quotedMsg,
        };
      } else if (m.message?.viewOnceMessage?.message?.imageMessage) {
        imageMessage = m.message.viewOnceMessage.message.imageMessage;
        messageToDownload = {
          ...m,
          message: m.message.viewOnceMessage.message,
        };
      }

      if (!imageMessage) {
        return sock.sendMessage(
          chatId,
          {
            text: messageFormatter.error(
              `Kirim/kutip gambar dengan caption ${config.prefix}removebg`
            ),
          },
          { quoted: m }
        );
      }

      // Set cooldown
      rateLimiter.setCooldown(senderNumber, this.cooldown * 1000);

      // React untuk menunjukkan proses
      await sock.sendMessage(chatId, {
        react: { text: "⏳", key: m.key },
      });

      try {
        // Download gambar
        const imageBuffer = await downloadMediaMessage(
          messageToDownload,
          "buffer",
          {},
          {
            logger: console, // Use console for baileys internal logging
            reuploadRequest: sock.updateMediaMessage,
          }
        );

        if (!imageBuffer || imageBuffer.length === 0) {
          throw new Error("Gagal mengunduh gambar dari pesan.");
        }

        // Validasi ukuran gambar
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (imageBuffer.length > maxSize) {
          throw new Error("Ukuran gambar terlalu besar. Maksimal 5MB.");
        }

        // Upload gambar ke Maelyn CDN untuk mendapatkan URL
        let imageUrl;
        try {
          const formData = new FormData();
          formData.append("file", imageBuffer, {
            filename: `temp_image_${Date.now()}.png`,
            contentType: "image/png",
          });

          const uploadResponse = await axios.post(
            "https://cdn.maelyn.sbs/api/upload",
            formData,
            {
              headers: {
                ...formData.getHeaders(),
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              },
              timeout: 60000,
            }
          );

          if (uploadResponse.data?.data?.url) {
            imageUrl = uploadResponse.data.data.url;
          } else {
            throw new Error(
              "Gagal mendapatkan URL dari server upload: " +
                JSON.stringify(uploadResponse.data)
            );
          }
        } catch (uploadError) {
          logger.error("[REMOVEBG] Upload ke Maelyn CDN gagal:", uploadError);
          throw new Error("Gagal mengupload gambar ke server.");
        }

        // Kirim URL ke API removebg Maelyn (FIX: Menggunakan query parameter seperti hd.js)
        const removeBgResponse = await axios.get(
          `https://api.maelyn.sbs/api/img2img/removebg?url=${encodeURIComponent(
            imageUrl
          )}&apikey=${config.apikey.maelyn}`,
          {
            timeout: 120000, // Timeout 2 menit
          }
        );

        if (
          removeBgResponse.data.status === "Error" ||
          !removeBgResponse.data.result?.url
        ) {
          throw new Error(
            removeBgResponse.data.result || "Gagal menghapus background"
          );
        }

        // Kirim hasil
        await sock.sendMessage(
          chatId,
          {
            image: { url: removeBgResponse.data.result.url },
            caption: messageFormatter.success(
              "✅ Background berhasil dihapus!"
            ),
          },
          { quoted: m }
        );

        // React sukses
        await sock.sendMessage(chatId, {
          react: { text: "✅", key: m.key },
        });
      } catch (apiError) {
        logger.error(
          "[REMOVEBG] Error saat memproses gambar:",
          apiError.message
        );
        await sock.sendMessage(
          chatId,
          {
            text: messageFormatter.error(
              `Terjadi kesalahan: ${apiError.message}`
            ),
          },
          { quoted: m }
        );
        await sock.sendMessage(chatId, {
          react: { text: "❌", key: m.key },
        });
      }
    } catch (error) {
      logger.error("[REMOVEBG] Error di command removebg:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        {
          text: messageFormatter.error(
            `Terjadi kesalahan sistem: ${error.message}`
          ),
        },
        { quoted: m }
      );
    }
  },
};
