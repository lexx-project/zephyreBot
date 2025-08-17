import config from "../../config/setting.js";
import { logger, messageFormatter } from "../../utils/helpers.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  name: "totalfitur",
  aliases: ["totalcommand", "fitur"],
  description: "Menghitung dan menampilkan total command yang tersedia di bot.",
  usage: `${config.prefix}totalfitur`,
  category: "main",
  cooldown: 10,

  async execute(sock, m, args) {
    try {
      const commandsPath = path.join(__dirname, "../../commands");
      let totalFitur = 0;

      const items = fs.readdirSync(commandsPath);

      // Hitung file di direktori root commands
      const rootCommandFiles = items.filter((item) => {
        const itemPath = path.join(commandsPath, item);
        return fs.statSync(itemPath).isFile() && item.endsWith(".js");
      });
      totalFitur += rootCommandFiles.length;

      // Hitung file di dalam sub-folder
      const subFolders = items.filter((item) => {
        const itemPath = path.join(commandsPath, item);
        return fs.statSync(itemPath).isDirectory();
      });

      subFolders.forEach((folder) => {
        const folderPath = path.join(commandsPath, folder);
        try {
          const folderItems = fs.readdirSync(folderPath);
          const folderCommands = folderItems.filter((item) =>
            item.endsWith(".js")
          );
          totalFitur += folderCommands.length;
        } catch (error) {
          logger.error(`[TotalFitur] Gagal membaca folder: ${folder}`, error);
        }
      });

      const responseText = `📊 *Total Fitur Bot*\n\nSaat ini, *${config.namaBot}* memiliki total *${totalFitur}* command yang siap digunakan!`;

      await sock.sendMessage(
        m.key.remoteJid,
        { text: responseText },
        { quoted: m }
      );

      logger.info(`[TotalFitur] Command executed. Total fitur: ${totalFitur}`);
    } catch (error) {
      logger.error("Error di command totalfitur:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        {
          text: messageFormatter.error(
            "Terjadi kesalahan saat menghitung total fitur."
          ),
        },
        { quoted: m }
      );
    }
  },
};
