import config from "../../config/setting.js";
import { messageFormatter, logger } from "../../utils/helpers.js";

export const command = {
  name: "qc",
  description: "Membuat stiker kutipan (quote) dengan teks custom.",
  usage: `${config.prefix}qc <teks>`,
  category: "sticker",
  aliases: ["qcstick"],
  cooldown: 10,

  async execute(sock, m, args) {
    // Pesan bahwa command sedang dalam perbaikan
    await sock.sendMessage(
      m.key.remoteJid,
      {
        text: "Fitur `.qc` sedang dalam perbaikan karena API yang digunakan sedang tidak aktif. Mohon tunggu update selanjutnya ya! 🙏",
      },
      { quoted: m }
    );
    logger.info(`[QC] Command is temporarily disabled, user notified.`);
  },
};

export const aliases = command.aliases;
export default command;
