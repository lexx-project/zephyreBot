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
  name: "gamemenu",
  description: "Menampilkan daftar game yang tersedia",
  usage: `${config.prefix}gamemenu`,
  category: "game",
  cooldown: 3,
  ownerOnly: false,
  groupOnly: false,
  privateOnly: false,

  async execute(sock, message, args) {
    try {
      const sender = message.key.remoteJid;
      const senderNumber = sender.split("@")[0];

      // Get game commands from current directory
      const gameCommandsPath = __dirname;
      const gameFiles = fs
        .readdirSync(gameCommandsPath)
        .filter((file) => file.endsWith(".js") && file !== "gamemenu.js")
        .map((file) => file.replace(".js", ""));

      // Build simple command list
      let menuText = `┌─❐ 乂ＧＡＭＥ ＭＥＮＵ ❐\n`;

      if (gameFiles.length > 0) {
        gameFiles.forEach((command, index) => {
          menuText += `┃ ${config.prefix}${command}\n`;
        });
      } else {
        menuText += `┃ Tidak ada game tersedia\n`;
      }

      menuText += `┗╍╍╍╍╍╍╍╍╍╍╍╍╍╍╍`;

      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: menuText,
        },
        { quoted: message }
      );

      logger.info(`🎮 Game menu ditampilkan untuk ${senderNumber}`);
    } catch (error) {
      logger.error("❌ Error saat menampilkan game menu:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: "❌ Terjadi kesalahan saat menampilkan game menu!",
        },
        { quoted: message }
      );
    }
  },
};
