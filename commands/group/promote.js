import config from "../../config/setting.js";
import { logger, validator, messageFormatter } from "../../utils/helpers.js";
import { isOwner } from "../../utils/database.js";

export default {
  name: "promote",
  description: "Menjadikan member sebagai admin grup (Admin only).",
  usage: `${config.prefix}promote @user atau reply pesan`,
  category: "group",
  cooldown: 5,
  ownerOnly: false,
  groupOnly: true,

  async execute(sock, m, args) {
    try {
      const chatId = m.key.remoteJid;
      const senderId = m.key.participant;
      const senderNumber = senderId.split("@")[0];

      // Get group metadata
      const groupMetadata = await sock.groupMetadata(chatId);
      const participants = groupMetadata.participants;
      const botNumber = sock.user.id.split(":")[0] + "@s.whatsapp.net";

      // Check if bot is admin
      const botParticipant = participants.find((p) => p.id === botNumber);
      if (!botParticipant?.admin) {
        return await sock.sendMessage(
          chatId,
          { text: "❌ Bot harus menjadi admin untuk menggunakan command ini!" },
          { quoted: m }
        );
      }

      // Check if sender is admin
      const senderParticipant = participants.find((p) => p.id === senderId);
      if (!senderParticipant?.admin) {
        return await sock.sendMessage(
          chatId,
          { text: "❌ Command ini hanya untuk admin grup!" },
          { quoted: m }
        );
      }

      // Get target user
      let targetId;
      const text = args.join(" ");
      if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        targetId = m.message.extendedTextMessage.contextInfo.participant;
      } else if (
        m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0
      ) {
        targetId = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
      } else if (text) {
        const cleanNumber = text.replace(/[^0-9]/g, "");
        if (cleanNumber) {
          targetId = cleanNumber + "@s.whatsapp.net";
        }
      }

      if (!targetId) {
        return await sock.sendMessage(
          chatId,
          {
            text: "❌ Tag/kutip pesan seseorang atau masukkan nomor yang ingin dipromote!",
          },
          { quoted: m }
        );
      }

      // Check if target is in the group
      const targetParticipant = participants.find((p) => p.id === targetId);
      if (!targetParticipant) {
        return await sock.sendMessage(
          chatId,
          {
            text: "❌ Target tidak ditemukan di grup ini!",
          },
          { quoted: m }
        );
      }

      // Check if target is already an admin
      if (targetParticipant.admin) {
        return await sock.sendMessage(
          chatId,
          { text: "✅ Target sudah menjadi admin." },
          { quoted: m }
        );
      }

      // Perform promote
      await sock.groupParticipantsUpdate(chatId, [targetId], "promote");

      const targetNumber = targetId.split("@")[0];
      await sock.sendMessage(
        chatId,
        {
          text: `👑 Berhasil menjadikan @${targetNumber} sebagai admin!`,
          mentions: [targetId],
        },
        { quoted: m }
      );

      logger.info(
        `[PROMOTE] Admin ${senderNumber} menjadikan ${targetNumber} admin di grup ${groupMetadata.subject}`
      );
    } catch (error) {
      logger.error("Error in promote command:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "❌ Terjadi kesalahan saat memproses command promote." },
        { quoted: m }
      );
    }
  },
};
