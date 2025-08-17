import config from "../../config/setting.js";
import {
  rateLimiter,
  messageFormatter,
  timeFormatter,
  logger,
} from "../../utils/helpers.js";
import { Sticker, StickerTypes } from "wa-sticker-formatter";

export const command = {
  name: "emojimix",
  description: "Mencampur dua emoji menjadi satu stiker.",
  usage: `${config.prefix}emojimix 😂+😭`,
  category: "sticker",
  aliases: ["mixemoji"],
  cooldown: 5,

  async execute(sock, message, args) {
    const senderNumber = (
      message.key.participant || message.key.remoteJid
    ).split("@")[0];
    const text = args.join(" ");

    try {
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
      if (!text.includes("+")) {
        return await sock.sendMessage(
          message.key.remoteJid,
          { text: `Contoh: ${this.usage}` },
          { quoted: message }
        );
      }

      const [emoji1, emoji2] = text.split("+").map((e) => e.trim());
      if (!emoji1 || !emoji2) {
        return await sock.sendMessage(
          message.key.remoteJid,
          { text: `Contoh: ${this.usage}` },
          { quoted: message }
        );
      }

      await sock.sendMessage(message.key.remoteJid, {
        react: { text: "⏳", key: message.key },
      });

      const hex1 = emoji1.codePointAt(0).toString(16);
      const hex2 = emoji2.codePointAt(0).toString(16);

      const apiUrl = `https://emojik.vercel.app/s/${hex1}_${hex2}?size=256`;
      logger.info(`[EMOJIMIX] Fetching from: ${apiUrl}`);

      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Emoji tidak dapat digabungkan atau tidak valid.`);
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());

      const sticker = new Sticker(imageBuffer, {
        pack: config.namaBot,
        author: message.pushName || "Emojimix",
        type: StickerTypes.FULL,
        quality: 75,
      });

      await sock.sendMessage(
        message.key.remoteJid,
        { sticker: await sticker.toBuffer() },
        { quoted: message }
      );
      await sock.sendMessage(message.key.remoteJid, {
        react: { text: "✅", key: message.key },
      });

      rateLimiter.setCooldown(senderNumber, this.cooldown * 1000);
    } catch (error) {
      logger.error(`[EMOJIMIX] Error: ${error.message}`);
      await sock.sendMessage(message.key.remoteJid, {
        react: { text: "❌", key: message.key },
      });
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: messageFormatter.error(
            `Gagal membuat stiker: ${error.message}`
          ),
        },
        { quoted: message }
      );
    }
  },
};

export const aliases = command.aliases;
export default command;
