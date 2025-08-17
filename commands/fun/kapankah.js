import config from "../../config/setting.js";
import {
  rateLimiter,
  messageFormatter,
  timeFormatter,
  logger,
} from "../../utils/helpers.js";

export default {
  name: "kapankah",
  description: "Menjawab pertanyaan 'kapan' secara acak.",
  usage: `${config.prefix}kapankah <pertanyaan>`,
  category: "game",
  aliases: ["kapan"],
  cooldown: 3,

  async execute(sock, m, args) {
    const senderNumber = (m.key.participant || m.key.remoteJid).split("@")[0];
    const question = args.join(" ").trim();

    if (!question) {
      return await sock.sendMessage(
        m.key.remoteJid,
        { text: `Contoh: ${this.usage} saya kaya?` },
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

      const jawabanWaktu = [
        "Bentar lagi",
        "Nunggu kiamat dulu",
        "Kapan-kapan",
        "Besok",
        "Pas lu tidur",
        "Gw juga gak tau kapan",
        "Mungkin lusa",
        "Tanya sama rumput yang bergoyang",
        "Secepatnya!",
        "Tahun depan, mungkin...",
      ];

      const waktuRandom = Math.floor(Math.random() * 10) + 1;
      const unitWaktu = ["minggu", "bulan", "tahun", "hari", "jam", "detik"];
      const unitWaktuRandom =
        unitWaktu[Math.floor(Math.random() * unitWaktu.length)];

      const jawabanDinamis = `${waktuRandom} ${unitWaktuRandom} lagi`;

      const semuaJawaban = [...jawabanWaktu, jawabanDinamis];
      const hasilJawaban =
        semuaJawaban[Math.floor(Math.random() * semuaJawaban.length)];

      const replyText = `*Pertanyaan:* Kapankah ${question}\n*Jawaban:* ${hasilJawaban}`;

      await sock.sendMessage(
        m.key.remoteJid,
        { text: replyText },
        { quoted: m }
      );

      rateLimiter.setCooldown(senderNumber, this.cooldown * 1000);
      logger.info(`[KAPANKAH] Command executed by ${senderNumber}`);
    } catch (error) {
      logger.error(`[KAPANKAH] Error: ${error.message}`);
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
