import config from "../../config/setting.js";
import {
  rateLimiter,
  messageFormatter,
  timeFormatter,
  logger,
} from "../../utils/helpers.js";

function randomNomor(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default {
  name: "cekcantik",
  description: "Mengecek seberapa cantik seseorang secara acak.",
  usage: `${config.prefix}cekcantik <nama/tag>`,
  category: "fun",
  aliases: ["cantikcek"],
  cooldown: 5,

  async execute(sock, m, args) {
    const senderNumber = (m.key.participant || m.key.remoteJid).split("@")[0];

    let targetText = args.join(" ");
    const mentions =
      m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (mentions.length > 0) {
      const taggedUserNumber = mentions[0].split("@")[0];
      targetText = `@${taggedUserNumber}`;
    }

    if (!targetText) {
      return await sock.sendMessage(
        m.key.remoteJid,
        { text: `Contoh: ${this.usage} ` },
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
        react: { text: "✨", key: m.key },
      });

      const adjective = ["cantik", "jelek"][Math.floor(Math.random() * 2)];

      const allAnswers = [
        `${randomNomor(2, 100)}% ${adjective}`,
        "Cantik",
        "Cantik Amat",
        "Lumayan",
        "Jelek",
        "Jelek Amat 🤢",
        "Gila, cantiknya kebangetan!",
      ];

      const finalAnswer =
        allAnswers[Math.floor(Math.random() * allAnswers.length)];

      const replyText = `*Pertanyaan:* Cek Cantik ${targetText}\n*Jawaban:* ${finalAnswer}`;

      await sock.sendMessage(
        m.key.remoteJid,
        { text: replyText },
        { quoted: m }
      );

      rateLimiter.setCooldown(senderNumber, this.cooldown * 1000);
      logger.info(`[CEKCANTIK] Command executed by ${senderNumber}`);
    } catch (error) {
      logger.error(`[CEKCANTIK] Error: ${error.message}`);
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
