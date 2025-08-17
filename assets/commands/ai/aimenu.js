import config from "../../config/setting.js";
import { logger } from "../../utils/helpers.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  name: "aimenu",
  description: "Menampilkan daftar command AI.",
  usage: `${config.prefix}aimenu`,
  category: "ai",
  cooldown: 3,
  ownerOnly: false,
  groupOnly: false,
  privateOnly: false,

  async execute(sock, message, args) {
    try {
      const sender = message.key.remoteJid;
      const senderNumber = sender.split("@")[0];

      // Mengambil command dari direktori saat ini
      const aiCommandsPath = __dirname;
      const aiFiles = fs
        .readdirSync(aiCommandsPath)
        .filter((file) => file.endsWith(".js") && file !== "aimenu.js")
        .map((file) => file.replace(".js", ""));

      // Membuat daftar command
      let menuText = `┌─❐ 乂 ＡＩ ＭＥＮＵ 乂 ❐\n`;

      if (aiFiles.length > 0) {
        aiFiles.forEach((command) => {
          menuText += `┃ ${config.prefix}${command}\n`;
        });
      } else {
        menuText += `┃ Tidak ada command tersedia\n`;
      }

      menuText += `┗╍╍╍╍╍╍╍╍╍╍╍╍╍╍╍`;

      await sock.sendMessage(
        message.key.remoteJid,
        { text: menuText },
        { quoted: message }
      );

      logger.info(`📋 AI menu ditampilkan untuk ${senderNumber}`);
    } catch (error) {
      logger.error("❌ Error saat menampilkan AI menu:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        { text: "❌ Terjadi kesalahan saat menampilkan AI menu!" },
        { quoted: message }
      );
    }
  },
};
