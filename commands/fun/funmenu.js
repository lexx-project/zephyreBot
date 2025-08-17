import config from "../../config/setting.js";
import { messageFormatter, logger } from "../../utils/helpers.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  name: "funmenu",
  description: "Menampilkan daftar command fun",
  category: "fun",
  usage: `${config.prefix}funmenu`,
  aliases: ["fmenu"],
  cooldown: 3,

  async execute(sock, message, args) {
    try {
      const chatId = message.key.remoteJid;
      const senderNumber = (
        message.key.participant || message.key.remoteJid
      ).split("@")[0];
      // Baca semua file di direktori fun
      const funDir = __dirname;
      const files = fs
        .readdirSync(funDir)
        .filter((file) => file.endsWith(".js") && file !== "funmenu.js")
        .map((file) => file.replace(".js", ""));

      let menuText = `╭─❏ *FUN MENU* ❏\n`;

      if (files.length > 0) {
        files.forEach((command) => {
          menuText += `├ ${config.prefix}${command}\n`;
        });
      } else {
        menuText += `├ Tidak ada command fun yang tersedia\n`;
      }

      menuText += `╰────────────────❏`;

      await sock.sendMessage(chatId, { text: menuText }, { quoted: message });
      logger.info(`[FUNMENU] Menu fun ditampilkan untuk ${senderNumber}`);
    } catch (error) {
      logger.error("Error in funmenu command:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        { text: "Terjadi kesalahan saat menampilkan menu fun." },
        { quoted: message }
      );
    }
  },
};
