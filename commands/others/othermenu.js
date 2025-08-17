import config from "../../config/setting.js";
import { logger } from "../../utils/helpers.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  name: "othermenu",
  description: "Menampilkan daftar command lain-lain.",
  usage: `${config.prefix}othermenu`,
  category: "others",
  cooldown: 3,
  ownerOnly: false,
  groupOnly: false,
  privateOnly: false,

  async execute(sock, message, args) {
    try {
      const sender = message.key.remoteJid;
      const senderNumber = sender.split("@")[0];

      // Mengambil file command dari direktori saat ini
      const otherCommandsPath = __dirname;
      const commandFiles = fs
        .readdirSync(otherCommandsPath)
        .filter((file) => file.endsWith(".js") && file !== "othermenu.js");

      // Membuat daftar command
      let menuText = `┌─❐ 乂ＯＴＨＥＲ ＭＥＮＵ ❐\n`;

      if (commandFiles.length > 0) {
        for (const file of commandFiles) {
          const filePath = path.join(otherCommandsPath, file);
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
        { text: menuText },
        { quoted: message }
      );

      logger.info(`📋 Other menu ditampilkan untuk ${senderNumber}`);
    } catch (error) {
      logger.error("❌ Error saat menampilkan other menu:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        { text: "❌ Terjadi kesalahan saat menampilkan other menu!" },
        { quoted: message }
      );
    }
  },
};
