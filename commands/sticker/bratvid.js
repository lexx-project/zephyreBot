import config from "../../config/setting.js";
import {
  rateLimiter,
  messageFormatter,
  timeFormatter,
  logger,
} from "../../utils/helpers.js";
import { addExp } from "../../utils/database.js";
import { Sticker, StickerTypes } from "wa-sticker-formatter";

export const command = {
  name: "brat2",
  description: "Membuat stiker video brat dengan teks custom.",
  usage: `${config.prefix}brat2 <teks>`,
  category: "sticker",
  aliases: ["bratvid"],
  cooldown: 10,

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
            text: messageFormatter.error(`Contoh: ${this.usage}`),
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
      )}&isvideo=true&speed=medium`;

      let res = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "mg-apikey": config.apikey.maelyn,
        },
      });

      if (!res.ok) {
        throw new Error(
          `Gagal mengambil data dari API (status: ${res.status}).`
        );
      }

      let data = await res.json();

      if (!data.result || !data.result.url) {
        throw new Error("Gagal mengambil file dari API brat!");
      }

      let fileRes = await fetch(data.result.url);
      if (!fileRes.ok) {
        throw new Error(
          `Gagal mengunduh file stiker (status: ${fileRes.status})`
        );
      }

      let buffer = Buffer.from(await fileRes.arrayBuffer());

      const sticker = new Sticker(buffer, {
        pack: config.namaBot,
        author: "Brat Generator",
        type: StickerTypes.FULL,
        categories: ["🤖", "😂"],
        id: `brat-${Date.now()}`,
        quality: 50,
      });

      const stickerBuffer = await sticker.toBuffer();
      await sock.sendMessage(
        message.key.remoteJid,
        { sticker: stickerBuffer },
        { quoted: message }
      );

      await sock.sendMessage(message.key.remoteJid, {
        react: { text: "✅", key: message.key },
      });

      rateLimiter.setCooldown(senderNumber, this.cooldown * 1000);
      await addExp(senderNumber, 10);

      logger.info(`[BRAT2] Command executed by ${senderNumber}`);
    } catch (error) {
      logger.error(`[BRAT2] Error: ${error.message}`);

      await sock.sendMessage(message.key.remoteJid, {
        react: { text: "❌", key: message.key },
      });

      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: messageFormatter.error(`Terjadi kesalahan: ${error.message}`),
        },
        { quoted: message }
      );
    }
  },
};

export const aliases = command.aliases;
export default command;
