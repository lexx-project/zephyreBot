import config from "../../config/setting.js";
import { messageFormatter, logger } from "../../utils/helpers.js";

export default {
  name: "play",
  aliases: ["ytplay", "song"],
  category: "download",
  description: "Mencari dan memutar lagu dari YouTube.",
  usage: `${config.prefix}play <judul lagu>`,
  cooldown: 10,

  async execute(sock, m, args) {
    const chatId = m.key.remoteJid;
    const userId = m.key.participant || m.key.remoteJid;
    const query = args.join(" ").trim();

    // --- Menangani Pencarian Awal ---
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
      // Langsung cari dan unduh lagu menggunakan endpoint /play
      const apiUrl = `https://api.maelyn.sbs/api/youtube/play?q=${encodeURIComponent(
        query
      )}`;
      logger.info(`[PLAY] Fetching audio from: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        headers: { "mg-apikey": config.apikey.maelyn },
      });

      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }

      const data = await response.json();
      logger.info(`[PLAY] API Response: ${JSON.stringify(data)}`);

      if (data.status !== "Success" || !data.result || !data.result.url) {
        throw new Error(
          data.result || "Gagal mendapatkan link audio dari API."
        );
      }

      const { title, channel, duration, url: audioUrl } = data.result;

      // Kirim audio ke pengguna
      const caption = `🎵 *${title}*\n\n👤 *Channel:* ${channel}\n⏱️ *Durasi:* ${duration}\n\n© ${config.namaBot}`;

      await sock.sendMessage(
        chatId,
        {
          audio: { url: audioUrl },
          mimetype: "audio/mp4",
          caption: caption,
        },
        { quoted: m }
      );

      logger.info(`[PLAY] Successfully sent audio for "${title}" to ${chatId}`);
    } catch (error) {
      logger.error(`[PLAY] Download error: ${error.message}`);
      await sock.sendMessage(
        chatId,
        { text: messageFormatter.error(`Terjadi kesalahan: ${error.message}`) },
        { quoted: m }
      );
    }
  },
};
