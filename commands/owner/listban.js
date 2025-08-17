import config from "../../config/setting.js";
import { logger } from "../../utils/helpers.js";
import { getBannedUsers } from "../../utils/database.js";

export default {
  name: "listban",
  aliases: ["banlist"],
  description: "Menampilkan daftar user yang diban.",
  usage: `${config.prefix}listban`,
  category: "owner",
  cooldown: 10,
  ownerOnly: true,
  groupOnly: false,
  privateOnly: false,

  async execute(sock, m, args) {
    try {
      const bannedUsers = getBannedUsers();

      if (bannedUsers.length === 0) {
        return await sock.sendMessage(
          m.key.remoteJid,
          { text: "✅ Tidak ada user yang sedang diban saat ini." },
          { quoted: m }
        );
      }

      let responseText = `🚫 *DAFTAR USER DIBAN* 🚫\n\nTotal: ${bannedUsers.length} user\n\n`;
      const mentions = [];

      bannedUsers.forEach((user, index) => {
        const targetNumber = user.id.split("@")[0];
        mentions.push(user.id);
        responseText += `*${index + 1}.* @${targetNumber}\n`;
        responseText += `   - *Durasi:* ${
          user.expiry ? `Temporer` : "Permanen"
        }\n`;
        if (user.expiry) {
          responseText += `   - *Berakhir:* ${new Date(
            user.expiry
          ).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}\n`;
        }
        responseText += `\n`;
      });

      await sock.sendMessage(
        m.key.remoteJid,
        { text: responseText.trim(), mentions: mentions },
        { quoted: m }
      );
      logger.info(
        `[LISTBAN] Owner ${
          m.key.participant || m.key.remoteJid
        } melihat daftar ban.`
      );
    } catch (error) {
      logger.error("Error in listban command:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "❌ Terjadi kesalahan saat menampilkan daftar ban." },
        { quoted: m }
      );
    }
  },
};
