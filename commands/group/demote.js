import config from "../../config/setting.js";
import { logger, validator, messageFormatter } from "../../utils/helpers.js";
import { isOwner } from "../../utils/database.js";

export default {
  name: "demote",
  description: "Menurunkan admin menjadi member biasa (Admin only).",
  usage: `${config.prefix}demote @user atau reply pesan`,
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
      const groupCreator = groupMetadata.owner;
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
            text: "❌ Tag/kutip pesan seseorang atau masukkan nomor yang ingin di-demote!",
          },
          { quoted: m }
        );
      }

      // Check if target is in the group
      const targetParticipant = participants.find((p) => p.id === targetId);
      if (!targetParticipant) {
        return await sock.sendMessage(
          chatId,
          { text: "❌ Target tidak ditemukan di grup ini!" },
          { quoted: m }
        );
      }

      // Prevent demoting group creator or bot owner
      if (targetId === groupCreator || isOwner(targetId)) {
        return await sock.sendMessage(
          chatId,
          { text: "❌ Tidak bisa menurunkan Creator Grup atau Owner Bot!" },
          { quoted: m }
        );
      }

      // Check if target is already a member
      if (!targetParticipant.admin) {
        return await sock.sendMessage(
          chatId,
          { text: "✅ Target sudah menjadi member biasa." },
          { quoted: m }
        );
      }

      // Perform demote
      await sock.groupParticipantsUpdate(chatId, [targetId], "demote");

      const targetNumber = targetId.split("@")[0];
      await sock.sendMessage(
        chatId,
        {
          text: `📉 Berhasil menurunkan @${targetNumber} menjadi member biasa!`,
          mentions: [targetId],
        },
        { quoted: m }
      );

      logger.info(
        `[DEMOTE] Admin ${senderNumber} menurunkan ${targetNumber} di grup ${groupMetadata.subject}`
      );
    } catch (error) {
      logger.error("Error in demote command:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "❌ Terjadi kesalahan saat memproses command demote." },
        { quoted: m }
      );
    }
  },
};
