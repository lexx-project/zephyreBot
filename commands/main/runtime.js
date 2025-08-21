import { fileURLToPath } from "url";
import path from "path";
import config from "../../config/setting.js";
import { messageFormatter, logger } from "../../utils/helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatUptime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  seconds %= 3600 * 24;
  const hrs = Math.floor(seconds / 3600);
  seconds %= 3600;
  const mins = Math.floor(seconds / 60);
  seconds = Math.floor(seconds % 60);

  const parts = [];
  if (days) parts.push(`${days} hari`);
  if (hrs) parts.push(`${hrs} jam`);
  if (mins) parts.push(`${mins} menit`);
  parts.push(`${seconds} detik`);

  return parts.join(", ");
}

export default {
  name: "runtime",
  aliases: ["uptime", "botup"],
  description: "Cek berapa lama bot sudah menyala.",
  usage: `${config.prefix}runtime`,
  category: "main",
  cooldown: 5,
  ownerOnly: false,
  groupOnly: false,
  privateOnly: false,

  async execute(sock, m, args) {
    const chatId = m.key.remoteJid;

    try {
      const uptimeSec = process.uptime();
      const formatted = formatUptime(uptimeSec);

      const caption = `
┌─「 ⏱️ Runtime Bot 」
│ Bot sudah menyala selama:
│ ${formatted}
└──────────────────────`;

      await sock.sendMessage(chatId, { text: caption }, { quoted: m });
      logger.info(`[RUNTIME] Bot uptime: ${formatted}`);
    } catch (err) {
      logger.error("Error di command runtime:", err);
      await sock.sendMessage(
        chatId,
        { text: messageFormatter.error("❌ Gagal menampilkan runtime.") },
        { quoted: m }
      );
    }
  },
};
