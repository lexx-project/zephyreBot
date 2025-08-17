import config from "../../config/setting.js";
import { messageFormatter, logger } from "../../utils/helpers.js";

export default {
  name: "tiktok",
  aliases: ["tt", "ttdl"],
  category: "download",
  description: "Download video/audio/gambar dari TikTok",
  usage: ".tiktok <link>",
  cooldown: 5,

  async execute(sock, message, args) {
    const chatId = message.key.remoteJid;
    try {
      const text = args.join(" ");
      const wm = config.namaBot;

      if (!text) {
        return await sock.sendMessage(
          chatId,
          { text: `Contoh: ${config.prefix}${this.name} linknya` },
          { quoted: message }
        );
      }

      if (!text.includes("tiktok.com")) {
        return await sock.sendMessage(
          chatId,
          { text: "Harus berupa link tiktok!" },
          { quoted: message }
        );
      }

      await sock.sendMessage(
        chatId,
        { text: config.messages.wait },
        { quoted: message }
      );

      const apiUrl = `https://api.maelyn.sbs/api/tiktok/download?url=${encodeURIComponent(
        text
      )}`;
      const headers = {
        "mg-apikey": config.apikey.maelyn,
        "Content-Type": "application/json",
      };

      logger.info(`Fetching TikTok data from: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        method: "GET",
        headers: headers,
      });

      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }

      const data = await response.json();
      logger.info(`API Response: ${JSON.stringify(data)}`);

      if (data.status !== "Success" || data.code !== 200 || !data.result) {
        throw new Error("Invalid API response or no data found");
      }

      const result = data.result;

      if (result.video && (result.video.nwm_url || result.video.wm_url)) {
        const videoUrl = result.video.nwm_url || result.video.wm_url;
        logger.info(`[TIKTOK] Downloading video from: ${videoUrl}`);

        const videoBuffer = Buffer.from(
          await (await fetch(videoUrl)).arrayBuffer()
        );

        await sock.sendMessage(
          chatId,
          {
            video: videoBuffer,
            mimetype: "video/mp4",
            caption: `🎵 *TikTok Downloader*\n\n📝 *Deskripsi:* ${
              result.title || "Tidak ada deskripsi"
            }\n👤 *Author:* ${result.author?.nickname || "Unknown"}\n\n© ${wm}`,
          },
          { quoted: message }
        );
      } else if (result.image_data && result.image_data.length > 0) {
        const images = result.image_data;
        logger.info(`[TIKTOK] Downloading ${images.length} images...`);

        for (let i = 0; i < images.length; i++) {
          const imageUrl = images[i].url;
          const imageBuffer = Buffer.from(
            await (await fetch(imageUrl)).arrayBuffer()
          );

          await sock.sendMessage(
            chatId,
            {
              image: imageBuffer,
              mimetype: "image/jpeg",
              caption:
                i === 0
                  ? `🖼️ *TikTok Slideshow (${i + 1}/${
                      images.length
                    })*\n\n📝 *Deskripsi:* ${
                      result.title || "Tidak ada deskripsi"
                    }\n👤 *Author:* ${
                      result.author?.nickname || "Unknown"
                    }\n\n© ${wm}`
                  : ``,
            },
            { quoted: message }
          );
        }
      } else if (result.music && result.music.url) {
        const audioUrl = result.music.url;
        logger.info(`[TIKTOK] Downloading audio from: ${audioUrl}`);

        const audioBuffer = Buffer.from(
          await (await fetch(audioUrl)).arrayBuffer()
        );

        await sock.sendMessage(
          chatId,
          {
            audio: audioBuffer,
            mimetype: "audio/mp3",
            caption: `🎵 *TikTok Audio*\n\n📝 *Deskripsi:* ${
              result.title || "Tidak ada deskripsi"
            }\n👤 *Author:* ${result.author?.nickname || "Unknown"}\n\n© ${wm}`,
          },
          { quoted: message }
        );
      } else {
        throw new Error("Tidak ada media yang ditemukan");
      }
    } catch (error) {
      logger.error(`TikTok download error: ${error.message}`);
      await sock.sendMessage(
        chatId,
        {
          text: `❌ Terjadi kesalahan saat mengunduh TikTok:\n${error.message}\n\nSilakan coba lagi atau periksa link yang Anda berikan.`,
        },
        { quoted: message }
      );
    }
  },
};
