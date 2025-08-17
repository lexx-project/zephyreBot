import config from "../../config/setting.js";
import { logger } from "../../utils/helpers.js";

export default {
  name: "instagram",
  aliases: ["ig", "igdl"],
  category: "download",
  description: "Download video/gambar dari Instagram",
  usage: ".instagram <link>",
  cooldown: 5,

  async execute(sock, message, args) {
    try {
      const chatId = message.key.remoteJid;
      const text = args.join(" ");
      const wm = config.namaBot;

      // Check if URL is provided
      if (!text) {
        return await sock.sendMessage(
          message.key.remoteJid,
          {
            text: `Contoh: ${config.prefix}${this.name} linknya`,
          },
          { quoted: message }
        );
      }

      // Check if it's an Instagram URL
      if (!text.includes("instagram.com")) {
        return await sock.sendMessage(
          message.key.remoteJid,
          {
            text: "Harus berupa link Instagram!",
          },
          { quoted: message }
        );
      }

      // Send loading reaction
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: config.messages.wait,
        },
        { quoted: message }
      );

      // Prepare API request
      const apiUrl = `https://api.maelyn.sbs/api/instagram?url=${encodeURIComponent(
        text
      )}`;
      const headers = {
        "mg-apikey": config.apikey.maelyn,
        "Content-Type": "application/json",
      };

      logger.info(`Fetching Instagram data from: ${apiUrl}`);

      // Make API request
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: headers,
      });

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error(
            `Layanan download Instagram sedang tidak tersedia. Silakan coba lagi nanti.`
          );
        }
        throw new Error(
          `Gagal mengambil data dari API (Status: ${response.status})`
        );
      }

      const data = await response.json();
      logger.info(`API Response: ${JSON.stringify(data)}`);

      // Check if API response is successful
      if (data.status !== "Success" || data.code !== 200 || !data.result) {
        throw new Error(
          data.result || "Gagal memproses link, format respons API tidak valid."
        );
      }

      const result = data.result;

      // Handle media from API response
      if (Array.isArray(result) && result.length > 0) {
        for (let i = 0; i < result.length; i++) {
          const media = result[i];
          await new Promise((resolve) => setTimeout(resolve, 500)); // Delay between sends

          if (media.download_link) {
            try {
              // Download the media file
              const mediaResponse = await fetch(media.download_link);
              if (!mediaResponse.ok) {
                throw new Error(
                  `Gagal mengunduh media: ${mediaResponse.status}`
                );
              }

              const mediaBuffer = await mediaResponse.arrayBuffer();
              const buffer = Buffer.from(mediaBuffer);

              // Get content type from response headers
              const contentType =
                mediaResponse.headers.get("content-type") || "";

              // Determine media type from content-type or URL
              const isVideo =
                contentType.includes("video") ||
                media.download_link.includes(".mp4") ||
                media.download_link.includes("video") ||
                media.download_link.includes("/o1/v/t2/");

              const isImage =
                contentType.includes("image") ||
                media.download_link.includes(".jpg") ||
                media.download_link.includes(".jpeg") ||
                media.download_link.includes(".png") ||
                media.download_link.includes(".webp");

              if (isVideo) {
                await sock.sendMessage(
                  message.key.remoteJid,
                  {
                    video: buffer,
                    caption: i === 0 ? `*Instagram Downloader*\n\n© ${wm}` : "",
                    mimetype: "video/mp4",
                  },
                  { quoted: message }
                );
                logger.info(`Successfully sent Instagram video ${i + 1}`);
              } else if (isImage) {
                await sock.sendMessage(
                  message.key.remoteJid,
                  {
                    image: buffer,
                    caption: i === 0 ? `*Instagram Downloader*\n\n© ${wm}` : "",
                    mimetype: "image/jpeg",
                  },
                  { quoted: message }
                );
                logger.info(`Successfully sent Instagram image ${i + 1}`);
              } else {
                // Default to image if type cannot be determined
                await sock.sendMessage(
                  message.key.remoteJid,
                  {
                    image: buffer,
                    caption: i === 0 ? `*Instagram Downloader*\n\n© ${wm}` : "",
                    mimetype: "image/jpeg",
                  },
                  { quoted: message }
                );
                logger.info(
                  `Successfully sent Instagram media ${
                    i + 1
                  } (default as image)`
                );
              }
            } catch (downloadError) {
              logger.error(
                `Failed to download media ${i + 1}: ${downloadError.message}`
              );
              // Fallback to URL method if download fails
              const isVideo =
                media.download_link.includes(".mp4") ||
                media.download_link.includes("video") ||
                media.download_link.includes("/o1/v/t2/");

              if (isVideo) {
                await sock.sendMessage(
                  message.key.remoteJid,
                  {
                    video: { url: media.download_link },
                    caption: i === 0 ? `*Instagram Downloader*\n\n© ${wm}` : "",
                  },
                  { quoted: message }
                );
                logger.info(`Fallback: sent Instagram video ${i + 1} via URL`);
              } else {
                await sock.sendMessage(
                  message.key.remoteJid,
                  {
                    image: { url: media.download_link },
                    caption: i === 0 ? `*Instagram Downloader*\n\n© ${wm}` : "",
                  },
                  { quoted: message }
                );
                logger.info(`Fallback: sent Instagram image ${i + 1} via URL`);
              }
            }
          }
        }
        return;
      }

      // If no media found
      throw new Error("Tidak ada media yang ditemukan");
    } catch (error) {
      logger.error(`Instagram download error: ${error.message}`);

      // Send error message
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: `❌ Terjadi kesalahan saat mengunduh Instagram:\n${error.message}\n\nSilakan coba lagi atau periksa link yang Anda berikan.`,
        },
        { quoted: message }
      );
    }
  },
};
