import config from "../../config/setting.js";
import { logger, messageFormatter, validator } from "../../utils/helpers.js";
import { unbanUser, isBanned } from "../../utils/database.js";

export default {
  name: "unban",
  aliases: ["unbanuser"],
  description: "Membatalkan ban user.",
  usage: `${config.prefix}unban <@user/nomor>`,
  category: "owner",
  cooldown: 3,
  ownerOnly: true,
  groupOnly: false,
  privateOnly: false,

  async execute(sock, m, args) {
    try {
      // 1. Get target user
      let users;

      if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        users = m.message.extendedTextMessage.contextInfo.participant;
      } else if (
        m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0
      ) {
        users = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
      } else if (args[0]) {
        const cleanNumber = args[0].replace(/[^0-9]/g, "");
        if (validator.isValidWhatsAppNumber(cleanNumber)) {
          users = cleanNumber + "@s.whatsapp.net";
        }
      }

      if (!users) {
        return await sock.sendMessage(
          m.key.remoteJid,
          {
            text: `Penggunaan: ${this.usage}\nContoh: .unban @user`,
          },
          { quoted: m }
        );
      }

      // 2. Check if user is actually banned
      if (!isBanned(users)) {
        return await sock.sendMessage(
          m.key.remoteJid,
          { text: "✅ User tersebut tidak dalam status banned." },
          { quoted: m }
        );
      }

      // 3. Unban the user
      const unbanned = unbanUser(users);
      const targetNumber = users.split("@")[0];

      if (unbanned) {
        let responseText = `✅ *User Berhasil Di-unban!*\n\n`;
        responseText += `👤 *Target:* @${targetNumber}\n`;
        responseText += `🔓 *Status:* Akses bot dipulihkan.`;

        await sock.sendMessage(
          m.key.remoteJid,
          { text: responseText, mentions: [users] },
          { quoted: m }
        );
        logger.info(
          `[UNBAN] Owner ${
            m.key.participant || m.key.remoteJid
          } melakukan unban pada ${targetNumber}.`
        );
      } else {
        await sock.sendMessage(
          m.key.remoteJid,
          { text: "❌ Gagal melakukan unban. User mungkin tidak diban." },
          { quoted: m }
        );
      }
    } catch (error) {
      logger.error("Error in unban command:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "❌ Terjadi kesalahan saat menjalankan command unban." },
        { quoted: m }
      );
    }
  },
};
