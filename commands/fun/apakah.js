import config from "../../config/setting.js";
import {
  rateLimiter,
  messageFormatter,
  timeFormatter,
  logger,
} from "../../utils/helpers.js";

export default {
  name: "apakah",
  description: "Menjawab pertanyaan ya/tidak secara acak.",
  usage: `${config.prefix}apakah <pertanyaan>`,
  category: "fun",
  aliases: ["apa"],
  cooldown: 3,

  async execute(sock, m, args) {
    const senderNumber = (m.key.participant || m.key.remoteJid).split("@")[0];
    const question = args.join(" ").trim();

    if (!question) {
      return await sock.sendMessage(
        m.key.remoteJid,
        { text: `Contoh: ${this.usage} saya ganteng?` },
        { quoted: m }
      );
    }

    // Rate limiting check
    if (rateLimiter.isOnCooldown(senderNumber)) {
      const remainingTime = rateLimiter.getRemainingTime(senderNumber);
      return await sock.sendMessage(
        m.key.remoteJid,
        {
          text: messageFormatter.warning(
            `Tunggu ${timeFormatter.formatMs(
              remainingTime
            )} sebelum menggunakan command ini lagi!`
          ),
        },
        { quoted: m }
      );
    }

    try {
      await sock.sendMessage(m.key.remoteJid, {
        react: { text: "🤔", key: m.key },
      });

      const jawaban = [
        "Iya",
        "Tentu saja",
        "Pasti",
        "Mungkin iya",
        "Mungkin",
        "Gak",
        "Tidak",
        "Mustahil",
        "Mungkin gak",
        "Gak tau",
        "Coba tanya lagi",
      ];

      const hasilJawaban = jawaban[Math.floor(Math.random() * jawaban.length)];

      const replyText = `*Pertanyaan:* Apakah ${question}\n*Jawaban:* ${hasilJawaban}`;

      await sock.sendMessage(
        m.key.remoteJid,
        { text: replyText },
        { quoted: m }
      );

      rateLimiter.setCooldown(senderNumber, this.cooldown * 1000);
      logger.info(`[APAKAH] Command executed by ${senderNumber}`);
    } catch (error) {
      logger.error(`[APAKAH] Error: ${error.message}`);
      await sock.sendMessage(
        m.key.remoteJid,
        {
          text: messageFormatter.error(
            "Gagal memberikan jawaban, coba lagi nanti."
          ),
        },
        { quoted: m }
      );
    }
  },
};
