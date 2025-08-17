import config from "../../config/setting.js";
import { logger } from "../../utils/helpers.js";
import { getUser } from "../../utils/database.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const toolData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../lib/rpg/tools.json"), "utf-8")
);
const toolMap = new Map(toolData.map((t) => [t.id, t]));

export default {
  name: "durability",
  aliases: ["dura"],
  description: "Mengecek sisa durability semua peralatan Anda.",
  usage: `${config.prefix}durability`,
  category: "rpg",
  cooldown: 10,

  async execute(sock, m, args) {
    try {
      const senderId = m.key.participant || m.key.remoteJid;
      const user = getUser(senderId);
      const tools = user.inventory.tools;

      let replyText = `*Kondisi Peralatan Anda* 🛠️\n\n`;

      if (!tools || tools.length === 0) {
        replyText += "Anda tidak memiliki peralatan apapun di dalam tas.";
      } else {
        tools.forEach((toolInstance) => {
          const toolInfo = toolMap.get(toolInstance.id);
          if (toolInfo) {
            const durabilityPercentage =
              (toolInstance.durability / toolInstance.max_durability) * 100;
            const progressBar =
              "█".repeat(Math.floor(durabilityPercentage / 10)) +
              "░".repeat(10 - Math.floor(durabilityPercentage / 10));
            replyText += `${toolInfo.emoji} *${toolInfo.name}*\n`;
            replyText += `   - Sisa: ${toolInstance.durability}/${toolInstance.max_durability}\n`;
            replyText += `   - [${progressBar}] ${Math.round(
              durabilityPercentage
            )}%\n\n`;
          }
        });
      }

      await sock.sendMessage(
        m.key.remoteJid,
        { text: replyText.trim() },
        { quoted: m }
      );
    } catch (error) {
      logger.error("Error in durability command:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "❌ Terjadi kesalahan saat mengecek durability." },
        { quoted: m }
      );
    }
  },
};
