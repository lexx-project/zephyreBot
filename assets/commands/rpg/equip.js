import config from "../../config/setting.js";
import { logger } from "../../utils/helpers.js";
import { getUser, setUserData } from "../../utils/database.js";
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
  name: "equip",
  description: "Memasang peralatan dari inventaris.",
  usage: `${config.prefix}equip <id_alat>`,
  category: "rpg",
  cooldown: 5,

  async execute(sock, m, args) {
    try {
      const senderId = m.key.participant || m.key.remoteJid;
      const user = getUser(senderId);
      const inventory = user.inventory;

      const toolId = args[0]?.toLowerCase();

      if (!toolId) {
        let usageText = `Penggunaan: ${this.usage}\n\n*Alat yang bisa dipasang (dari tas Anda):*\n`;
        const toolCounts = {};
        inventory.tools.forEach((tool) => {
          if (toolCounts[tool.id]) {
            toolCounts[tool.id]++;
          } else {
            toolCounts[tool.id] = 1;
          }
        });

        if (Object.keys(toolCounts).length > 0) {
          for (const [id, count] of Object.entries(toolCounts)) {
            const toolInfo = toolMap.get(id);
            if (toolInfo) {
              usageText += `- ${toolInfo.emoji} ${toolInfo.name} (ID: \`${toolInfo.id}\`) - Anda punya: ${count}\n`;
            }
          }
        } else {
          usageText += "   - Anda tidak punya alat untuk dipasang.\n";
        }
        usageText += `\n*Contoh:* ${config.prefix}equip pickaxe_batu`;
        return await sock.sendMessage(
          m.key.remoteJid,
          { text: usageText.trim() },
          { quoted: m }
        );
      }

      const toolToEquipInfo = toolMap.get(toolId);
      if (!toolToEquipInfo) {
        return await sock.sendMessage(
          m.key.remoteJid,
          { text: `❌ Alat dengan ID \`${toolId}\` tidak ditemukan.` },
          { quoted: m }
        );
      }

      const availableTools = inventory.tools.filter((t) => t.id === toolId);

      if (availableTools.length === 0) {
        return await sock.sendMessage(
          m.key.remoteJid,
          { text: `❌ Anda tidak punya ${toolToEquipInfo.name} di tas.` },
          { quoted: m }
        );
      }

      // Sort by durability to use the best one first
      availableTools.sort((a, b) => b.durability - a.durability);
      const bestToolInstance = availableTools[0];

      // Equip the tool
      user.equipped[toolToEquipInfo.type] = bestToolInstance.uniqueId;
      setUserData(senderId, user); // Fungsi ini harus ada di database.js untuk menyimpan seluruh data user

      await sock.sendMessage(
        m.key.remoteJid,
        {
          text: `✅ Berhasil memasang *${toolToEquipInfo.name}* ${toolToEquipInfo.emoji}.`,
        },
        { quoted: m }
      );
      logger.info(
        `[EQUIP] ${senderId} memasang ${toolId} (${bestToolInstance.uniqueId})`
      );
    } catch (error) {
      logger.error("Error in equip command:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "❌ Terjadi kesalahan saat memasang alat." },
        { quoted: m }
      );
    }
  },
};
