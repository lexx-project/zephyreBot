import config from "../../config/setting.js";
import { messageFormatter, logger } from "../../utils/helpers.js";

export default {
  name: "ytsearch",
  aliases: ["yts", "youtubesearch"],
  category: "download",
  description: "Mencari video di YouTube.",
  usage: `${config.prefix}ytsearch <query>`,
  cooldown: 5,

  async execute(sock, m, args) {
    const chatId = m.key.remoteJid;
    const query = args.join(" ").trim();

    if (!query) {
      return await sock.sendMessage(
        chatId,
        { text: `Contoh: ${this.usage}` },
        { quoted: m }
      );
    }

    await sock.sendMessage(
      chatId,
      { text: config.messages.wait },
      { quoted: m }
    );

    try {
      const apiUrl = `https://api.maelyn.sbs/api/youtube/search?q=${encodeURIComponent(
        query
      )}`;
      logger.info(`[YTSEARCH] Searching YouTube with URL: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        headers: { "mg-apikey": config.apikey.maelyn },
      });

      if (!response.ok) {
        throw new Error(
          `API search request failed with status: ${response.status}`
        );
      }

      const data = await response.json();
      logger.info(`[YTSEARCH] Search API Response: ${JSON.stringify(data)}`);

      if (
        data.status !== "Success" ||
        !data.result ||
        data.result.length === 0
      ) {
        return await sock.sendMessage(
          chatId,
          { text: "❌ Video tidak ditemukan." },
          { quoted: m }
        );
      }

      let listText = `🔎 *HASIL PENCARIAN YOUTUBE UNTUK "${query.toUpperCase()}"*\n\n`;
      data.result.slice(0, 10).forEach((video, index) => {
        listText += `*${index + 1}. ${video.title}*\n`;
        listText += `   ↳ *Channel:* ${video.channel}\n`;
        listText += `   ↳ *Durasi:* ${video.duration}\n`;
        listText += `   ↳ *Link:* ${video.url}\n\n`;
      });
      listText += `© ${config.namaBot}`;

      await sock.sendMessage(chatId, { text: listText }, { quoted: m });
    } catch (error) {
      logger.error(`[YTSEARCH] Search error: ${error.message}`);
      await sock.sendMessage(
        chatId,
        { text: messageFormatter.error(`Terjadi kesalahan: ${error.message}`) },
        { quoted: m }
      );
    }
  },
};
