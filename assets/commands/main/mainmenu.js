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
  name: "mainmenu",
  description: "Menampilkan daftar command utama",
  usage: `${config.prefix}mainmenu`,
  category: "main",
  cooldown: 3,
  ownerOnly: false,
  groupOnly: false,
  privateOnly: false,

  async execute(sock, message, args) {
    try {
      const sender = message.key.remoteJid;
      const senderNumber = sender.split("@")[0];

      // Get main commands from current directory
      const mainCommandsPath = __dirname;
      const mainFiles = fs
        .readdirSync(mainCommandsPath)
        .filter((file) => file.endsWith(".js"));

      // Build simple command list
      let menuText = `┌─❐ 乂ＭＡＩＮ ＭＥＮＵ ❐\n`;

      if (mainFiles.length > 0) {
        for (const file of mainFiles) {
          if (file === "mainmenu.js") continue; // Skip the menu file itself
          const filePath = path.join(mainCommandsPath, file);
          const commandModule = await import(`file://${filePath}`);
          const command = commandModule.default || commandModule.command;

          if (command && command.name) {
            const premiumSymbol = command.premiumOnly ? " ℗" : "";
            const ownerSymbol = command.ownerOnly ? " 👑" : "";
            menuText += `┃ ${config.prefix}${command.name}${premiumSymbol}${ownerSymbol}\n`;
          }
        }
      } else {
        menuText += `┃ Tidak ada command tersedia\n`;
      }

      menuText += `┗╍╍╍╍╍╍╍╍╍╍╍╍╍╍╍`;

      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: menuText,
        },
        { quoted: message }
      );

      logger.info(`📋 Main menu ditampilkan untuk ${senderNumber}`);
    } catch (error) {
      logger.error("❌ Error saat menampilkan main menu:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: "❌ Terjadi kesalahan saat menampilkan main menu!",
        },
        { quoted: message }
      );
    }
  },
};
