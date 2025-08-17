import config from "../../config/setting.js";
import {
  rateLimiter,
  messageFormatter,
  timeFormatter,
  logger,
} from "../../utils/helpers.js";

export default {
  name: "bisakah",
  description: "Menjawab pertanyaan 'bisakah' secara acak.",
  usage: `${config.prefix}bisakah <pertanyaan>`,
  category: "fun",
  aliases: ["bisa"],
  cooldown: 3,

  async execute(sock, m, args) {
    const senderNumber = (m.key.participant || m.key.remoteJid).split("@")[0];
    const question = args.join(" ").trim();

    if (!question) {
      return await sock.sendMessage(
        m.key.remoteJid,
        { text: `Contoh: ${this.usage} saya jadi kaya?` },
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
        react: { text: "🔮", key: m.key },
      });

      const jawaban = [
        "Bisa banget",
        "Bisa",
        "Mungkin bisa",
        "Mungkin",
        "Gak bisa",
        "Mungkin gak bisa",
        "Gak bisa lah",
        "Gak tau",
        "Tentu saja bisa!",
        "Mustahil...",
      ];

      const hasilJawaban = jawaban[Math.floor(Math.random() * jawaban.length)];

      const replyText = `*Pertanyaan:* Bisakah ${question}\n*Jawaban:* ${hasilJawaban}`;

      await sock.sendMessage(
        m.key.remoteJid,
        { text: replyText },
        { quoted: m }
      );

      rateLimiter.setCooldown(senderNumber, this.cooldown * 1000);
      logger.info(`[BISAKAH] Command executed by ${senderNumber}`);
    } catch (error) {
      logger.error(`[BISAKAH] Error: ${error.message}`);
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
