import config from "../../config/setting.js";
import { rateLimiter, messageFormatter, logger } from "../../utils/helpers.js";
import { isPremium, isOwner } from "../../utils/database.js";

export default {
  name: "dalle",
  aliases: ["dall-e", "createimg"],
  category: "ai",
  description: "Membuat gambar dari teks menggunakan DALL-E.",
  usage: `${config.prefix}dalle <deskripsi gambar>`,
  cooldown: 20, // Cooldown 20 detik
  premiumOnly: true, // Fitur ini hanya untuk premium

  async execute(sock, m, args) {
    const chatId = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    const senderNumber = sender.split("@")[0];
    const prompt = args.join(" ").trim();

    try {
      // Cek permission: Hanya Owner atau Premium
      const isUserOwner = isOwner(sender);
      const isUserPremium = isPremium(sender);

      if (!isUserOwner && !isUserPremium) {
        return await sock.sendMessage(
          chatId,
          {
            text: messageFormatter.error(
              "Fitur ini hanya untuk pengguna Premium atau Owner."
            ),
          },
          { quoted: m }
        );
      }

      // Rate limiting (owner tidak terpengaruh)
      if (rateLimiter.isOnCooldown(senderNumber) && !isUserOwner) {
        const remainingTime = rateLimiter.getRemainingTime(senderNumber);
        return await sock.sendMessage(
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

      if (!prompt) {
        return await sock.sendMessage(
          chatId,
          { text: `Contoh: ${this.usage}` },
          { quoted: m }
        );
      }

      // React untuk menunjukkan proses
      await sock.sendMessage(chatId, {
        react: { text: "🎨", key: m.key },
      });
      await sock.sendMessage(
        chatId,
        { text: config.messages.wait },
        { quoted: m }
      );

      const apiUrl = `https://api.maelyn.sbs/api/txt2img/dalle?prompt=${encodeURIComponent(
        prompt
      )}`;
      logger.info(`[DALLE] Querying DALL-E: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        headers: { "mg-apikey": config.apikey.maelyn },
      });

      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }

      const data = await response.json();
      logger.info(`[DALLE] API Response: ${JSON.stringify(data)}`);

      if (data.status !== "Success" || !data.result?.url) {
        throw new Error(data.result || "Gagal membuat gambar dari API.");
      }

      const imageUrl = data.result.url;
      const caption = `*Prompt:* ${prompt}\n\n© ${config.namaBot}`;

      await sock.sendMessage(
        chatId,
        { image: { url: imageUrl }, caption: caption },
        { quoted: m }
      );

      // React sukses
      await sock.sendMessage(chatId, { react: { text: "✅", key: m.key } });

      // Set cooldown (owner tidak terpengaruh)
      if (!isUserOwner) {
        rateLimiter.setCooldown(senderNumber, this.cooldown * 1000);
      }
    } catch (error) {
      logger.error(`[DALLE] Error: ${error.message}`);
      await sock.sendMessage(chatId, { react: { text: "❌", key: m.key } });
      await sock.sendMessage(
        chatId,
        { text: messageFormatter.error(`Terjadi kesalahan: ${error.message}`) },
        { quoted: m }
      );
    }
  },
};
