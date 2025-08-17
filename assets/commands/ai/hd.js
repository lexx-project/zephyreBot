import axios from "axios";
import fs from "fs";
import FormData from "form-data";
import path from "path";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { config } from "../../config/setting.js";
import {
  rateLimiter,
  messageFormatter,
  timeFormatter,
  logger,
} from "../../utils/helpers.js";

const aliases = ["hd", "hdr", "hdimg", "remini", "enhance"];

export const command = {
  name: "hd",
  aliases,
  category: "ai",
  description: "Meningkatkan kualitas gambar menggunakan AI",
  usage: `Kirim/reply gambar dengan caption ${config.prefix}hd`,
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

      // Cek apakah ada gambar
      let imageMessage = null;
      let quotedMsg = null;
      let messageToDownload = null;

      // Cek gambar langsung di pesan
      if (m.message?.imageMessage) {
        imageMessage = m.message.imageMessage;
        messageToDownload = m;
      }
      // Cek gambar di quoted message
      else if (
        m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
      ) {
        quotedMsg = m.message.extendedTextMessage.contextInfo.quotedMessage;
        imageMessage = quotedMsg.imageMessage;
        // Buat objek pesan untuk quoted message
        messageToDownload = {
          key: {
            ...m.key,
            id: m.message.extendedTextMessage.contextInfo.stanzaId,
          },
          message: quotedMsg,
        };
      }
      // Cek gambar di viewOnceMessage
      else if (m.message?.viewOnceMessage?.message?.imageMessage) {
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
              `Kirim/kutip gambar dengan caption ${config.prefix}hd`
            ),
          },
          { quoted: m }
        );
      }

      // Set cooldown
      rateLimiter.setCooldown(senderNumber, 10000);

      // React untuk menunjukkan proses
      await sock.sendMessage(chatId, {
        react: { text: "⏳", key: m.key },
      });

      try {
        // Download gambar
        let imageBuffer;
        try {
          console.log("[HD DEBUG] Mulai download gambar...");
          imageBuffer = await downloadMediaMessage(
            messageToDownload,
            "buffer",
            {},
            {
              logger: console,
              reuploadRequest: sock.updateMediaMessage,
            }
          );

          console.log(
            "[HD DEBUG] Download selesai, ukuran buffer:",
            imageBuffer?.length || 0
          );

          if (!imageBuffer || imageBuffer.length === 0) {
            console.log("[HD DEBUG] Buffer gambar kosong atau null");
            throw new Error("Buffer gambar kosong");
          }

          console.log("[HD DEBUG] Buffer gambar valid, siap diproses");
        } catch (downloadError) {
          console.error(
            "[HD DEBUG] Error saat download:",
            downloadError.message
          );
          logger.error(
            `[HD] Error downloading media: ${downloadError.message}`
          );
          throw new Error("Gagal mengunduh gambar");
        }

        // Validasi ukuran gambar
        const maxSize = 5 * 1024 * 1024; // 5MB
        console.log(
          "[HD DEBUG] Validasi ukuran gambar, ukuran saat ini:",
          imageBuffer.length,
          "bytes"
        );

        if (imageBuffer.length > maxSize) {
          console.log(
            "[HD DEBUG] Gambar terlalu besar:",
            imageBuffer.length,
            ">",
            maxSize
          );
          throw new Error("Ukuran gambar terlalu besar. Maksimal 5MB.");
        }

        console.log("[HD DEBUG] Ukuran gambar valid, melanjutkan proses...");

        // Upload gambar ke Maelyn CDN untuk mendapatkan URL
        console.log("[HD DEBUG] Mengupload gambar ke Maelyn CDN...");
        let imageUrl;

        try {
          const formData = new FormData();
          // Langsung gunakan buffer tanpa menyimpan ke file
          formData.append("file", imageBuffer, {
            filename: `temp_image_${Date.now()}.jpg`,
            contentType: "image/jpeg",
          });

          console.log("[HD DEBUG] Mengirim request ke Maelyn CDN...");
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

          console.log("[HD DEBUG] Response status:", uploadResponse.status);
          console.log(
            "[HD DEBUG] Response data:",
            JSON.stringify(uploadResponse.data, null, 2)
          );

          // Cek response dari Maelyn CDN
          if (
            uploadResponse.data &&
            uploadResponse.data.data &&
            uploadResponse.data.data.url
          ) {
            imageUrl = uploadResponse.data.data.url;
            console.log("[HD DEBUG] Upload berhasil, URL:", imageUrl);
          } else {
            throw new Error(
              "Response tidak valid dari Maelyn CDN: " +
                JSON.stringify(uploadResponse.data)
            );
          }

          console.log("[HD DEBUG] Upload ke Maelyn CDN berhasil:", imageUrl);
        } catch (uploadError) {
          console.error(
            "[HD DEBUG] Upload ke Maelyn CDN gagal:",
            uploadError.message
          );
          if (uploadError.response) {
            console.error(
              "[HD DEBUG] Error response status:",
              uploadError.response.status
            );
            console.error(
              "[HD DEBUG] Error response data:",
              uploadError.response.data
            );
          }
          throw new Error(
            "Gagal mengupload gambar ke Maelyn CDN: " + uploadError.message
          );
        }

        // Kirim URL ke API Maelyn
        console.log("[HD DEBUG] Mengirim URL ke API Maelyn:", imageUrl);
        const enhanceResponse = await axios.get(
          `https://api.maelyn.sbs/api/img2img/upscale?url=${encodeURIComponent(
            imageUrl
          )}&apikey=${config.apikey.maelyn}`,
          {
            timeout: 120000, // Timeout 2 menit untuk gambar besar
          }
        );

        console.log("[HD DEBUG] Response dari API Maelyn diterima");
        console.log("[HD DEBUG] Status response:", enhanceResponse.status);
        console.log(
          "[HD DEBUG] Data response:",
          JSON.stringify(enhanceResponse.data, null, 2)
        );

        console.log("[HD DEBUG] Memeriksa status response final...");

        if (enhanceResponse.data.status === "Error") {
          console.error(
            "[HD DEBUG] API mengembalikan status Error:",
            enhanceResponse.data.result
          );
          throw new Error(
            enhanceResponse.data.result || "Gagal memproses gambar"
          );
        }

        console.log("[HD DEBUG] Status response OK, memproses hasil...");

        // Kirim hasil
        if (enhanceResponse.data.result && enhanceResponse.data.result.url) {
          console.log(
            "[HD DEBUG] Hasil ditemukan, mengirim gambar enhanced..."
          );
          console.log("[HD DEBUG] URL hasil:", enhanceResponse.data.result.url);

          // Coba download gambar hasil untuk dikirim sebagai buffer
          try {
            console.log("[HD DEBUG] Mendownload gambar hasil dari API...");
            const resultResponse = await axios.get(
              enhanceResponse.data.result.url,
              {
                responseType: "arraybuffer",
                timeout: 30000,
              }
            );

            console.log(
              "[HD DEBUG] Download gambar hasil berhasil, ukuran:",
              resultResponse.data.length
            );

            // Kirim gambar sebagai buffer langsung
            await sock.sendMessage(
              chatId,
              {
                image: Buffer.from(resultResponse.data),
                caption: messageFormatter.success(
                  "✅ Gambar berhasil di-enhance!"
                ),
              },
              { quoted: m }
            );

            console.log("[HD DEBUG] Gambar berhasil dikirim sebagai buffer");
          } catch (downloadError) {
            console.error(
              "[HD DEBUG] Gagal download hasil, fallback ke URL:",
              downloadError.message
            );

            // Fallback: kirim sebagai URL jika download gagal
            await sock.sendMessage(
              chatId,
              {
                image: { url: enhanceResponse.data.result.url },
                caption: messageFormatter.success(
                  "✅ Gambar berhasil di-enhance!"
                ),
              },
              { quoted: m }
            );

            console.log("[HD DEBUG] Gambar dikirim sebagai URL (fallback)");
          }

          // React sukses
          await sock.sendMessage(chatId, {
            react: { text: "✅", key: m.key },
          });

          console.log("[HD DEBUG] Proses selesai dengan sukses");
        } else {
          console.error("[HD DEBUG] Tidak ada hasil dari API");
          throw new Error("Tidak ada hasil dari API");
        }
      } catch (apiError) {
        console.error("[HD DEBUG] Error dalam proses utama:", apiError.message);
        console.error("[HD DEBUG] Error stack:", apiError.stack);
        console.error("[HD DEBUG] Error details:", {
          name: apiError.name,
          code: apiError.code,
          response: apiError.response?.data,
          status: apiError.response?.status,
        });

        logger.error("Error saat memproses gambar:", apiError.message);

        await sock.sendMessage(
          chatId,
          {
            text: messageFormatter.error(
              `Terjadi kesalahan saat memproses gambar: ${apiError.message}. Silakan coba lagi nanti.`
            ),
          },
          { quoted: m }
        );

        // React error
        await sock.sendMessage(chatId, {
          react: { text: "❌", key: m.key },
        });
      }
    } catch (error) {
      console.error("[HD DEBUG] Error sistem level:", error.message);
      console.error("[HD DEBUG] Error sistem stack:", error.stack);

      logger.error("Error di command hd:", error);

      await sock.sendMessage(
        m.key.remoteJid,
        {
          text: messageFormatter.error(
            `Terjadi kesalahan sistem: ${error.message}. Silakan coba lagi nanti.`
          ),
        },
        { quoted: m }
      );
    }
  },
};

export default command;
