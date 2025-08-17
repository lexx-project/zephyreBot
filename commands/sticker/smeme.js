import config from "../../config/setting.js";
import {
  rateLimiter,
  messageFormatter,
  timeFormatter,
  logger,
} from "../../utils/helpers.js";
import { Sticker, StickerTypes } from "wa-sticker-formatter";
import { downloadMediaMessage } from "@yupra/baileys";
import FormData from "form-data";
import axios from "axios";

export const command = {
  name: "smeme",
  description: "Membuat stiker meme dari gambar dengan teks atas dan bawah.",
  usage: `${config.prefix}smeme <teks> atau ${config.prefix}smeme <teks atas>|<teks bawah>`,
  category: "sticker",
  aliases: ["stickermeme"],
  cooldown: 10,

  async execute(sock, m, args) {
    const senderNumber = (m.key.participant || m.key.remoteJid).split("@")[0];
    const text = args.join(" ");

    try {
      // Rate limiting check
      if (rateLimiter.isOnCooldown(senderNumber)) {
        const remainingTime = rateLimiter.getRemainingTime(senderNumber);
        return await sock.sendMessage(
          m.key.remoteJid,
          {
            text: messageFormatter.warning(
              `Tunggu ${timeFormatter.formatMs(
                remainingTime
              )} sebelum menggunakan command ini lagi!`
            ),
          },
          { quoted: m }
        );
      }

      // Check for image
      let imageMessage = null;
      let messageToDownload = null;

      if (m.message?.imageMessage) {
        imageMessage = m.message.imageMessage;
        messageToDownload = m;
      } else if (
        m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
      ) {
        const quotedMessage =
          m.message.extendedTextMessage.contextInfo.quotedMessage;
        imageMessage = quotedMessage.imageMessage;
        messageToDownload = {
          key: {
            ...m.key,
            id: m.message.extendedTextMessage.contextInfo.stanzaId,
          },
          message: quotedMessage,
        };
      } else if (m.message?.viewOnceMessage?.message?.imageMessage) {
        imageMessage = m.message.viewOnceMessage.message.imageMessage;
        messageToDownload = {
          ...m,
          message: m.message.viewOnceMessage.message,
        };
      }

      if (!imageMessage) {
        return await sock.sendMessage(
          m.key.remoteJid,
          {
            text: messageFormatter.error(
              `Kirim atau balas gambar dengan caption ${this.usage}`
            ),
          },
          { quoted: m }
        );
      }

      if (!text) {
        return await sock.sendMessage(
          m.key.remoteJid,
          {
            text: messageFormatter.error(
              `Teks tidak boleh kosong. Contoh: ${this.usage}`
            ),
          },
          { quoted: m }
        );
      }

      await sock.sendMessage(m.key.remoteJid, {
        react: { text: "⏳", key: m.key },
      });

      // Parse text for top and bottom
      let topText = "";
      let bottomText = "";
      if (text.includes("|")) {
        const parts = text.split("|").map((part) => part.trim());
        topText = parts.shift() || ""; // Ambil bagian pertama sebagai teks atas
        bottomText = parts.join("|").trim(); // Gabungkan sisanya sebagai teks bawah
      } else {
        // Logika otomatis: 2 kata di atas, sisanya di bawah
        const words = text.trim().split(/\s+/);
        if (words.length > 2) {
          topText = words.slice(0, 2).join(" ");
          bottomText = words.slice(2).join(" ");
        } else {
          topText = text.trim();
        }
      }

      // Download image
      const imageBuffer = await downloadMediaMessage(
        messageToDownload,
        "buffer",
        {},
        { logger, reuploadRequest: sock.updateMediaMessage }
      );

      // Upload image to get URL
      const formData = new FormData();
      formData.append("file", imageBuffer, {
        filename: `meme_temp_${Date.now()}.jpg`,
        contentType: "image/jpeg",
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
        }
      );

      if (!uploadResponse.data?.data?.url) {
        throw new Error("Gagal mengupload gambar untuk meme.");
      }
      const imageUrl = uploadResponse.data.data.url;

      // Helper function to encode text for meme API URL
      const encodeMemeText = (txt) => {
        if (!txt) return "_";
        return txt
          .replace(/-/g, "--")
          .replace(/_/g, "__")
          .replace(/ /g, "_")
          .replace(/\?/g, "~q")
          .replace(/%/g, "~p")
          .replace(/#/g, "~h")
          .replace(/\//g, "~s")
          .replace(/"/g, "''");
      };

      // Generate meme using public API
      const memeApiUrl = `https://api.memegen.link/images/custom/${encodeMemeText(
        topText
      )}/${encodeMemeText(bottomText)}.png?background=${encodeURIComponent(
        imageUrl
      )}`;
      logger.info(`[SMEME] Fetching from: ${memeApiUrl}`);

      const memeResponse = await axios.get(memeApiUrl, {
        responseType: "arraybuffer",
      });
      const memeBuffer = Buffer.from(memeResponse.data);

      // Create sticker
      const sticker = new Sticker(memeBuffer, {
        pack: config.namaBot,
        author: m.pushName || "Meme Sticker",
        type: StickerTypes.FULL,
        quality: 75,
      });

      await sock.sendMessage(
        m.key.remoteJid,
        { sticker: await sticker.toBuffer() },
        { quoted: m }
      );
      await sock.sendMessage(m.key.remoteJid, {
        react: { text: "✅", key: m.key },
      });

      rateLimiter.setCooldown(senderNumber, this.cooldown * 1000);
    } catch (error) {
      logger.error(`[SMEME] Error: ${error.message}`);
      await sock.sendMessage(m.key.remoteJid, {
        react: { text: "❌", key: m.key },
      });
      await sock.sendMessage(
        m.key.remoteJid,
        {
          text: messageFormatter.error(
            `Gagal membuat stiker meme: ${error.message}`
          ),
        },
        { quoted: m }
      );
    }
  },
};

export const aliases = command.aliases;
export default command;
