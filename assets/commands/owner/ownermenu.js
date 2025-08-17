import config from "../../config/setting.js";
import { isOwner } from "../../utils/database.js";
import { logger, messageFormatter } from "../../utils/helpers.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  name: "ownermenu",
  description: "Menampilkan daftar command yang hanya bisa diakses oleh owner.",
  usage: `${config.prefix}ownermenu`,
  category: "owner",
  cooldown: 3,
  ownerOnly: false, // Diubah agar semua bisa melihat menu ini
  groupOnly: false,
  privateOnly: false,

  async execute(sock, message, args) {
    try {
      const sender = message.key.remoteJid;
      const senderNumber = sender.split("@")[0];

      // Get owner commands from current directory
      const commandDir = __dirname;
      const commandFiles = fs
        .readdirSync(commandDir)
        .filter((file) => file.endsWith(".js") && file !== "ownermenu.js");

      // Build simple command list
      let menuText = `┌─❐ 乂ＯＷＮＥＲ ＭＥＮＵ ❐\n`;

      if (commandFiles.length > 0) {
        for (const file of commandFiles) {
          const filePath = path.join(commandDir, file);
          const commandModule = await import(`file://${filePath}`);
          const command = commandModule.default || commandModule.command;

          if (command && command.name) {
            // Owner commands are always owner only
            const ownerSymbol = " 👑";
            menuText += `┃ ${config.prefix}${command.name}${ownerSymbol}\n`;
          }
        }
      } else {
        menuText += `┃ Tidak ada command owner tersedia\n`;
      }

      menuText += `┗╍╍╍╍╍╍╍╍╍╍╍╍╍╍╍`;

      await messageFormatter.sendMessage(
        sock,
        sender,
        {
          text: menuText,
        },
        message
      );

      logger.info(`👑 Owner menu ditampilkan untuk ${senderNumber}`);
    } catch (error) {
      logger.error(`Error saat menampilkan owner menu: ${error.message}`);
      await messageFormatter.sendMessage(
        sock,
        message.key.remoteJid,
        {
          text: messageFormatter.error(
            "❌ Terjadi kesalahan saat menampilkan menu owner"
          ),
        },
        message
      );
    }
  },
};
