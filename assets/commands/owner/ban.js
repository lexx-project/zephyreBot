import config from "../../config/setting.js";
import { logger, messageFormatter, validator } from "../../utils/helpers.js";
import { banUser, isOwner, isBanned } from "../../utils/database.js";

export default {
  name: "ban",
  aliases: ["banuser"],
  description: "Membanned user agar tidak bisa menggunakan bot.",
  usage: `${config.prefix}ban <@user/nomor> [durasi_hari]`,
  category: "owner",
  cooldown: 3,
  ownerOnly: true,
  groupOnly: false,
  privateOnly: false,

  async execute(sock, m, args) {
    try {
      // 1. Get target user
      let users;
      let duration = null;
      const reason = "Dibanned oleh Owner.";
      let targetArgIndex = -1; // Keep track of the argument index for the user number

      if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        users = m.message.extendedTextMessage.contextInfo.participant;
      } else if (
        m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0
      ) {
        users = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
        // Find the mention in args to get its index, if it exists.
        targetArgIndex = args.findIndex((arg) =>
          arg.includes(users.split("@")[0])
        );
      } else if (args.length > 0) {
        // Find the argument that is a valid number
        const numberArgIndex = args.findIndex((arg) =>
          validator.isValidWhatsAppNumber(arg.replace(/[^0-9]/g, ""))
        );
        if (numberArgIndex !== -1) {
          const cleanNumber = args[numberArgIndex].replace(/[^0-9]/g, "");
          users = cleanNumber + "@s.whatsapp.net";
          targetArgIndex = numberArgIndex;
        }
      }

      if (!users) {
        const usageText = `
🚫 *Perintah Ban User* 🚫

Gunakan command ini untuk memblokir user dari penggunaan bot.

*Cara Penggunaan:*
1.  \`${config.prefix}ban @user\` (Ban permanen dengan tag)
2.  \`${config.prefix}ban @user 7\` (Ban temporer 7 hari)
3.  \`${config.prefix}ban 628xxxx\` (Ban permanen dengan nomor)
4.  *Reply pesan user* dengan command \`${config.prefix}ban\`

Pastikan target adalah user yang valid.
`;
        return await sock.sendMessage(
          m.key.remoteJid,
          { text: usageText.trim() },
          { quoted: m }
        );
      }

      // 2. Parse duration
      // Find a numeric argument that is NOT the target user's number argument
      const durationArg = args.find(
        (arg, index) => !isNaN(parseInt(arg)) && index !== targetArgIndex
      );
      if (durationArg) {
        duration = parseInt(durationArg);
      }

      // 3. Prevent banning owner or bot
      const botNumber = sock.user.id.split(":")[0] + "@s.whatsapp.net";
      if (isOwner(users) || users === botNumber) {
        return await sock.sendMessage(
          m.key.remoteJid,
          { text: "❌ Tidak bisa membanned Owner atau Bot!" },
          { quoted: m }
        );
      }

      // 4. Check if user is already banned
      if (isBanned(users)) {
        return await sock.sendMessage(
          m.key.remoteJid,
          { text: "⚠️ User tersebut sudah dalam status banned." },
          { quoted: m }
        );
      }

      // 5. Ban the user
      const banInfo = banUser(users, duration, reason);
      const targetNumber = users.split("@")[0];

      // 6. Send confirmation message
      let responseText = `✅ *User Berhasil Dibanned!*\n\n`;
      responseText += `👤 *Target:* @${targetNumber}\n`;
      responseText += `⏰ *Durasi:* ${
        duration ? `${duration} hari` : "Permanen"
      }\n`;
      if (banInfo.expiry) {
        responseText += `🚫 *Berakhir pada:* ${new Date(
          banInfo.expiry
        ).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}\n`;
      }

      await sock.sendMessage(
        m.key.remoteJid,
        { text: responseText, mentions: [users] },
        { quoted: m }
      );

      logger.info(
        `[BAN] Owner ${
          m.key.participant || m.key.remoteJid
        } membanned ${targetNumber} selama ${duration || "permanen"} hari.`
      );
    } catch (error) {
      logger.error("Error in ban command:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "❌ Terjadi kesalahan saat menjalankan command ban." },
        { quoted: m }
      );
    }
  },
};
