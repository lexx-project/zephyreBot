import config from "../../config/setting.js";
import {
  timeFormatter,
  logger,
  messageFormatter,
} from "../../utils/helpers.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  name: "rpgmenu",
  description: "Menampilkan daftar command RPG",
  usage: `${config.prefix}rpgmenu`,
  category: "rpg",
  cooldown: 3,
  ownerOnly: false,
  groupOnly: false,
  privateOnly: false,

  async execute(sock, message, args) {
    try {
      const sender = message.key.remoteJid;
      const senderNumber = sender.split("@")[0];

      // Get RPG commands from the current directory
      const rpgCommandsPath = __dirname;
      const rpgFiles = fs
        .readdirSync(rpgCommandsPath)
        .filter((file) => file.endsWith(".js"));

      // Build simple command list
      let menuText = `┌─❐ 乂ＲＰＧ ＭＥＮＵ ❐\n`;

      if (rpgFiles.length > 0) {
        for (const file of rpgFiles) {
          if (file === "rpgmenu.js") continue; // Skip the menu file itself
          const filePath = path.join(rpgCommandsPath, file);
          const commandModule = await import(`file://${filePath}`);
          const command = commandModule.default || commandModule.command;

          if (command && command.name) {
            const premiumSymbol = command.premiumOnly ? " ℗" : "";
            const ownerSymbol = command.ownerOnly ? " 👑" : "";
            menuText += `┃ ${config.prefix}${command.name}${premiumSymbol}${ownerSymbol}\n`;
          }
        }
      } else {
        menuText += `┃ Tidak ada command RPG tersedia\n`;
      }

      menuText += `┗╍╍╍╍╍╍╍╍╍╍╍╍╍╍╍`;

      await sock.sendMessage(
        message.key.remoteJid,
        { text: menuText },
        { quoted: message }
      );

      logger.info(`🎮 RPG menu ditampilkan untuk ${senderNumber}`);
    } catch (error) {
      logger.error("❌ Error saat menampilkan RPG menu:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        { text: "❌ Terjadi kesalahan saat menampilkan RPG menu!" },
        { quoted: message }
      );
    }
  },
};
