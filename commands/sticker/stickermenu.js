import config from "../../config/setting.js";
import { messageFormatter, logger } from "../../utils/helpers.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  name: "stickermenu",
  description: "Menampilkan daftar command sticker",
  category: "sticker",
  usage: `${config.prefix}stickermenu`,
  aliases: ["smenu"],
  cooldown: 3,

  async execute(sock, message, args) {
    try {
      const chatId = message.key.remoteJid;
      const senderNumber = (
        message.key.participant || message.key.remoteJid
      ).split("@")[0];
      // Baca semua file di direktori sticker
      const stickerDir = __dirname;
      const files = fs
        .readdirSync(stickerDir)
        .filter((file) => file.endsWith(".js") && file !== "stickermenu.js")
        .map((file) => file.replace(".js", ""));

      let menuText = `╭─❏ *STICKER MENU* ❏\n`;

      if (files.length > 0) {
        files.forEach((command) => {
          menuText += `├ ${config.prefix}${command}\n`;
        });
      } else {
        menuText += `├ Tidak ada command sticker yang tersedia\n`;
      }

      menuText += `╰────────────────❏`;

      await sock.sendMessage(chatId, { text: menuText }, { quoted: message });
      logger.info(
        `[STICKERMENU] Menu stiker ditampilkan untuk ${senderNumber}`
      );
    } catch (error) {
      logger.error("Error in stickermenu command:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        { text: "Terjadi kesalahan saat menampilkan menu sticker." },
        { quoted: message }
      );
    }
  },
};
