import config from "../../config/setting.js";
import {
  rateLimiter,
  messageFormatter,
  timeFormatter,
  logger,
} from "../../utils/helpers.js";
import {
  updateBalance,
  getBalance,
  addGameStats,
  getSettings,
  addExp,
} from "../../utils/database.js";
import { Sticker, StickerTypes } from "wa-sticker-formatter";

export const command = {
  name: "brat",
  description: "Membuat sticker brat dengan teks custom",
  usage: `${config.prefix}brat <teks>`,
  category: "sticker",
  aliases: ["bratgen", "bratmaker"],

  async execute(sock, message, args) {
    try {
      const senderNumber = message.key.remoteJid.split("@")[0];
      const text = args.join(" ");

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

      // Validasi input
      if (!text) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: messageFormatter.error(`Contoh: ${config.prefix}brat hai`),
          },
          { quoted: message }
        );
        return;
      }

      if (text.length > 250) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: messageFormatter.error("Karakter terbatas, max 250!"),
          },
          { quoted: message }
        );
        return;
      }

      // React to message
      await sock.sendMessage(message.key.remoteJid, {
        react: { text: "⏳", key: message.key },
      });

      const apiUrl = `https://api.maelyn.sbs/api/brat/generator?q=${encodeURIComponent(
        text
      )}&isvideo=false&speed=medium`;

      let res = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "mg-apikey": "lexxganz", // ganti dengan API Key kamu
        },
      });

      if (!res.ok) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: messageFormatter.error(
              `Gagal mengambil data dari API (status: ${res.status}).`
            ),
          },
          { quoted: message }
        );
        return;
      }

      let data = await res.json();

      // Pastikan struktur data benar
      if (!data.result || !data.result.url) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: messageFormatter.error("Gagal mengambil file dari API brat!"),
          },
          { quoted: message }
        );
        return;
      }

      // Download file stiker dari url
      let fileRes = await fetch(data.result.url);
      let contentType = fileRes.headers.get("content-type");

      if (
        !contentType ||
        (!contentType.startsWith("image/") &&
          !contentType.startsWith("video/") &&
          !contentType.endsWith("/gif"))
      ) {
        let errText = await fileRes.text();
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: messageFormatter.error(
              "File stiker dari API tidak valid!\n\n" + errText.slice(0, 200)
            ),
          },
          { quoted: message }
        );
        return;
      }

      let buffer = Buffer.from(await fileRes.arrayBuffer());

      // Kirim file sebagai stiker ke WhatsApp
      const sticker = new Sticker(buffer, {
        pack: "",
        author: "ZephyreBot | Brat Generator",
        type: StickerTypes.FULL,
        categories: ["🤖"],
        id: "12345",
        quality: 50,
      });

      const stickerBuffer = await sticker.toBuffer();
      await sock.sendMessage(
        message.key.remoteJid,
        {
          sticker: stickerBuffer,
        },
        { quoted: message }
      );

      // React success
      await sock.sendMessage(message.key.remoteJid, {
        react: { text: "✅", key: message.key },
      });

      // Add rate limit
      rateLimiter.setCooldown(senderNumber, 3000); // 3 detik cooldown

      // Add experience
      await addExp(senderNumber, 5);

      logger.info(`[BRAT] Command executed by ${senderNumber}`);
    } catch (error) {
      logger.error(`[BRAT] Error: ${error.message}`);

      await sock.sendMessage(message.key.remoteJid, {
        react: { text: "❌", key: message.key },
      });

      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: messageFormatter.error(
            "Terjadi kesalahan saat memproses stiker, coba lagi nanti."
          ),
        },
        { quoted: message }
      );
    }
  },
};

export const aliases = command.aliases;
export default command;
