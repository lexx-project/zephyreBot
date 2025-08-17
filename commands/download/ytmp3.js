import config from "../../config/setting.js";
import { messageFormatter, logger } from "../../utils/helpers.js";

export default {
  name: "ytmp3",
  aliases: ["yta", "ytaudio"],
  category: "download",
  description: "Mengunduh audio dari link YouTube.",
  usage: `${config.prefix}ytmp3 <url_youtube>`,
  cooldown: 10,

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
      const apiUrl = `https://api.maelyn.sbs/api/youtube/audio?url=${encodeURIComponent(
        url
      )}`;
      logger.info(`[YTMP3] Fetching audio from: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        headers: { "mg-apikey": config.apikey.maelyn },
      });

      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }

      const data = await response.json();
      logger.info(`[YTMP3] API Response: ${JSON.stringify(data)}`);

      if (data.status !== "Success" || !data.result || !data.result.url) {
        throw new Error(
          data.result || "Gagal mendapatkan link audio dari API."
        );
      }

      const { title, channel, duration, url: audioUrl } = data.result;

      const caption = `🎵 *${title}*\n\n👤 *Channel:* ${channel}\n⏱️ *Durasi:* ${duration}\n\n© ${config.namaBot}`;

      await sock.sendMessage(
        chatId,
        { audio: { url: audioUrl }, mimetype: "audio/mp4", caption: caption },
        { quoted: m }
      );

      logger.info(
        `[YTMP3] Successfully sent audio for "${title}" to ${chatId}`
      );
    } catch (error) {
      logger.error(`[YTMP3] Download error: ${error.message}`);
      await sock.sendMessage(
        chatId,
        { text: messageFormatter.error(`Terjadi kesalahan: ${error.message}`) },
        { quoted: m }
      );
    }
  },
};
