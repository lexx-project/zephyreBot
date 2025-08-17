import config from "../../config/setting.js";
import { messageFormatter, logger } from "../../utils/helpers.js";

export default {
  name: "ai",
  aliases: ["chat", "gemini"],
  category: "ai",
  description: "Berinteraksi dengan AI (Gemini).",
  usage: `${config.prefix}ai <pertanyaan>`,
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

    try {
      const apiUrl = `https://api.maelyn.sbs/api/gemini/chat?q=${encodeURIComponent(
        query
      )}`;
      logger.info(`[AI] Querying Gemini: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        headers: { "mg-apikey": config.apikey.maelyn },
      });

      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }

      const data = await response.json();
      logger.info(`[AI] API Response: ${JSON.stringify(data)}`);

      if (data.status !== "Success" || !data.result) {
        throw new Error(data.result || "Gagal mendapatkan jawaban dari AI.");
      }

      await sock.sendMessage(chatId, { text: data.result }, { quoted: m });
    } catch (error) {
      logger.error(`[AI] Error: ${error.message}`);
      await sock.sendMessage(
        chatId,
        { text: messageFormatter.error(`Terjadi kesalahan: ${error.message}`) },
        { quoted: m }
      );
    }
  },
};
