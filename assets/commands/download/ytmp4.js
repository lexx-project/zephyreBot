import config from "../../config/setting.js";
import { messageFormatter, logger } from "../../utils/helpers.js";

export default {
  name: "ytmp4",
  aliases: ["ytv", "ytvideo"],
  category: "download",
  description: "Mengunduh video dari link YouTube.",
  usage: `${config.prefix}ytmp4 <url_youtube>`,
  cooldown: 15,

  async execute(sock, m, args) {
    const chatId = m.key.remoteJid;
    const url = args[0];

    if (!url || (!url.includes("youtube.com") && !url.includes("youtu.be"))) {
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
      const apiUrl = `https://api.maelyn.sbs/api/youtube/video?url=${encodeURIComponent(
        url
      )}`;
      logger.info(`[YTMP4] Fetching video from: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        headers: { "mg-apikey": config.apikey.maelyn },
      });

      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }

      const data = await response.json();
      logger.info(`[YTMP4] API Response: ${JSON.stringify(data)}`);

      if (data.status !== "Success" || !data.result || !data.result.url) {
        throw new Error(
          data.result || "Gagal mendapatkan link video dari API."
        );
      }

      const { title, channel, duration, url: videoUrl } = data.result;

      const caption = `🎬 *${title}*\n\n👤 *Channel:* ${channel}\n⏱️ *Durasi:* ${duration}\n\n© ${config.namaBot}`;

      await sock.sendMessage(
        chatId,
        { video: { url: videoUrl }, mimetype: "video/mp4", caption: caption },
        { quoted: m }
      );

      logger.info(
        `[YTMP4] Successfully sent video for "${title}" to ${chatId}`
      );
    } catch (error) {
      logger.error(`[YTMP4] Download error: ${error.message}`);
      await sock.sendMessage(
        chatId,
        { text: messageFormatter.error(`Terjadi kesalahan: ${error.message}`) },
        { quoted: m }
      );
    }
  },
};
