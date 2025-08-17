import config from "../../config/setting.js";
import { messageFormatter, logger } from "../../utils/helpers.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  name: "downloadmenu",
  description: "Menampilkan daftar command download",
  category: "download",
  usage: `${config.prefix}downloadmenu`,
  aliases: ["dlmenu"],
  cooldown: 3,

  async execute(sock, message, args) {
    try {
      const chatId = message.key.remoteJid;
      const senderNumber = (
        message.key.participant || message.key.remoteJid
      ).split("@")[0];
      // Baca semua file command di direktori download
      const downloadDir = __dirname;
      const commandFiles = fs
        .readdirSync(downloadDir)
        .filter((file) => file.endsWith(".js") && file !== "downloadmenu.js");

      let menuText = `╭─❏ *DOWNLOAD MENU* ❏\n`;

      if (commandFiles.length > 0) {
        for (const file of commandFiles) {
          const filePath = path.join(downloadDir, file);
          const commandModule = await import(`file://${filePath}`);
          const command = commandModule.default || commandModule.command;

          if (command && command.name) {
            const premiumSymbol = command.premiumOnly ? " ℗" : "";
            const ownerSymbol = command.ownerOnly ? " 👑" : "";
            menuText += `├ ${config.prefix}${command.name}${premiumSymbol}${ownerSymbol}\n`;
          }
        }
      } else {
        menuText += `├ Tidak ada command download yang tersedia\n`;
      }

      menuText += `╰────────────────❏`;

      await sock.sendMessage(chatId, { text: menuText }, { quoted: message });
      logger.info(
        `[DOWNLOADMENU] Menu download ditampilkan untuk ${senderNumber}`
      );
    } catch (error) {
      logger.error("Error in downloadmenu command:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        { text: "Terjadi kesalahan saat menampilkan menu download." },
        { quoted: message }
      );
    }
  },
};
