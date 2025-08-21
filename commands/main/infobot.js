import os from "os";
import process from "process";
import { fileURLToPath } from "url";
import path from "path";
import config from "../../config/setting.js";
import { messageFormatter, logger } from "../../utils/helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

function formatBytes(bytes) {
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

export default {
  name: "infobot",
  aliases: ["statusbot", "botinfo"],
  description: "Menampilkan semua informasi detail bot & server.",
  usage: `${config.prefix}infobot`,
  category: "main",
  cooldown: 10,
  ownerOnly: false,
  groupOnly: false,
  privateOnly: false,

  async execute(sock, m, args) {
    const chatId = m.key.remoteJid;

    try {
      // ==== BOT UPTIME ====
      const botUptime = formatUptime(process.uptime());
      const osUptime = formatUptime(os.uptime());

      // ==== RAM ====
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(2);

      // ==== CPU ====
      const cpus = os.cpus();
      const cpuModel = cpus[0].model;
      const cpuCores = cpus.length;
      const loadAvg = os.loadavg().map((v) => v.toFixed(2)); // 1m, 5m, 15m

      // ==== PROCESS ====
      const pid = process.pid;
      const nodeVer = process.version;
      const platform = `${os.type()} ${os.release()} (${os.arch()})`;
      const rss = formatBytes(process.memoryUsage().rss);
      const heapUsed = formatBytes(process.memoryUsage().heapUsed);
      const heapTotal = formatBytes(process.memoryUsage().heapTotal);

      // ==== FORMAT OUTPUT ====
      const caption = `
┌─「 🤖 InfoBot 」
│ ⏱️ Bot Uptime  : ${botUptime}
│ 💻 OS Uptime   : ${osUptime}
│
│ 🧠 RAM
│ • Total       : ${formatBytes(totalMem)}
│ • Used        : ${formatBytes(usedMem)} (${memUsagePercent}%)
│ • Free        : ${formatBytes(freeMem)}
│
│ ⚡ CPU
│ • Model       : ${cpuModel}
│ • Cores       : ${cpuCores}
│ • Load Avg    : ${loadAvg.join(" / ")}
│
│ 📦 Process
│ • PID         : ${pid}
│ • Node.js     : ${nodeVer}
│ • Platform    : ${platform}
│ • RSS         : ${rss}
│ • Heap Used   : ${heapUsed} / ${heapTotal}
└──────────────────────────`;

      await sock.sendMessage(chatId, { text: caption }, { quoted: m });
      logger.info("[INFOBOT] Info bot terkirim.");
    } catch (err) {
      logger.error("Error di command infobot:", err);
      await sock.sendMessage(
        chatId,
        { text: messageFormatter.error("❌ Gagal mengambil info bot.") },
        { quoted: m }
      );
    }
  },
};
