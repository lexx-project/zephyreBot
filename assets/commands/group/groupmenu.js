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
  name: "groupmenu",
  description: "Menampilkan daftar command group yang tersedia",
  usage: `${config.prefix}groupmenu`,
  category: "group",
  cooldown: 3,
  ownerOnly: false,
  groupOnly: false,
  privateOnly: false,

  async execute(sock, message, args) {
    try {
      const sender = message.key.remoteJid;
      const senderNumber = sender.split("@")[0];

      // Get group commands from current directory
      const groupCommandsPath = __dirname;
      const groupFiles = fs
        .readdirSync(groupCommandsPath)
        .filter((file) => file.endsWith(".js") && file !== "groupmenu.js")
        .map((file) => file.replace(".js", ""));

      // Build simple command list
      let menuText = `┌─❐ 乂ＧＲＯＵＰ ＭＥＮＵ ❐\n`;

      if (groupFiles.length > 0) {
        groupFiles.forEach((command, index) => {
          menuText += `┃ ${config.prefix}${command}\n`;
        });
      } else {
        menuText += `┃ Belum ada command group tersedia\n`;
      }

      menuText += `┗╍╍╍╍╍╍╍╍╍╍╍╍╍╍╍`;

      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: menuText,
        },
        { quoted: message }
      );

      logger.info(`📋 Group menu ditampilkan untuk ${senderNumber}`);
    } catch (error) {
      logger.error("❌ Error saat menampilkan group menu:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: "❌ Terjadi kesalahan saat menampilkan group menu!",
        },
        { quoted: message }
      );
    }
  },
};
