import { downloadMediaMessage } from "@yupra/baileys";
import { Sticker, StickerTypes } from "wa-sticker-formatter";
import {
  timeFormatter,
  logger,
  messageFormatter,
  rateLimiter,
} from "../../utils/helpers.js";

const aliases = ["sticker", "s"];

const command = {
  name: "sticker",
  aliases,
  category: "sticker",
  description: "Mengkonversi gambar menjadi sticker",
  usage: "Kirim/reply gambar dengan .sticker atau .s",
  cooldown: 3,
  async execute(sock, m, args) {
    try {
      // Definisikan chat ID yang benar
      const chatId = m.key.remoteJid;
      const sender = m.key.participant || m.key.remoteJid;

      // Rate limiting
      const senderNumber = sender ? sender.replace(/@.+/, "") : "unknown";
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

      if (m.message?.imageMessage) {
        imageMessage = m.message.imageMessage;
      } else if (
        m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
      ) {
        const quotedMessage =
          m.message.extendedTextMessage.contextInfo.quotedMessage;
        imageMessage = quotedMessage.imageMessage;

        // Buat struktur quotedMsg yang benar untuk downloadMediaMessage
        quotedMsg = {
          key: {
            remoteJid: m.key.remoteJid,
            fromMe: false,
            id: m.message.extendedTextMessage.contextInfo.stanzaId,
          },
          message: quotedMessage,
        };
      }

      if (!imageMessage) {
        return sock.sendMessage(
          chatId,
          {
            text: messageFormatter.warning(
              "Kirim gambar dengan caption .sticker atau reply gambar dengan .sticker"
            ),
          },
          { quoted: m }
        );
      }

      // Tampilkan loading
      await sock.sendMessage(chatId, { react: { text: "⏳", key: m.key } });

      // Download media
      let imageBuffer;
      try {
        if (quotedMsg) {
          imageBuffer = await downloadMediaMessage(quotedMsg, "buffer", {});
        } else {
          imageBuffer = await downloadMediaMessage(m, "buffer", {});
        }
      } catch (error) {
        logger.error(`[STICKER] Error downloading media: ${error.message}`);
        return sock.sendMessage(
          chatId,
          {
            text: messageFormatter.error("❌ Gagal mengunduh gambar!"),
          },
          { quoted: m }
        );
      }

      // Buat sticker
      const sticker = new Sticker(imageBuffer, {
        pack: "ZephyreBot",
        author: "Sticker Bot",
        type: "full",
        categories: ["🤖"],
        id: "12345",
        quality: 50,
        background: "transparent",
      });

      const stickerBuffer = await sticker.toBuffer();

      // Kirim sticker
      await sock.sendMessage(
        chatId,
        {
          sticker: stickerBuffer,
        },
        { quoted: m }
      );

      // Tampilkan sukses
      await sock.sendMessage(chatId, { react: { text: "✅", key: m.key } });

      // Set rate limit
      rateLimiter.setCooldown(senderNumber, 3000);

      logger.info(`[STICKER] Sticker berhasil dibuat untuk ${senderNumber}`);
    } catch (error) {
      logger.error(`[STICKER] Error: ${error.message}`);
      const chatId = m.key.remoteJid;
      await sock.sendMessage(
        chatId,
        {
          text: messageFormatter.error(
            "❌ Terjadi kesalahan saat membuat sticker!"
          ),
        },
        { quoted: m }
      );
    }
  },
};

export { aliases, command };
