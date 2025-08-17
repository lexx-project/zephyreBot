import config from "../../config/setting.js";
import { logger, validator, messageFormatter } from "../../utils/helpers.js";
import { isOwner } from "../../utils/database.js";

export default {
  name: "warn",
  description: "Memberi peringatan kepada member (Admin only).",
  usage: `${config.prefix}warn @user <alasan>`,
  category: "group",
  cooldown: 10,
  ownerOnly: false,
  groupOnly: true,

  async execute(sock, m, args) {
    try {
      const chatId = m.key.remoteJid;
      const senderId = m.key.participant;
      const senderName = m.pushName || senderId.split("@")[0];

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
      if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        targetId = m.message.extendedTextMessage.contextInfo.participant;
      } else if (
        m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0
      ) {
        targetId = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
      } else {
        return await sock.sendMessage(
          chatId,
          { text: `Penggunaan: ${this.usage}\nContoh: .warn @user toxic` },
          { quoted: m }
        );
      }

      // Get reason
      const reason = args.slice(1).join(" ") || "Tidak ada alasan spesifik.";

      // Prevent warning owner, bot, or other admins
      const targetParticipant = participants.find((p) => p.id === targetId);
      if (isOwner(targetId) || targetId === botNumber) {
        return await sock.sendMessage(
          chatId,
          { text: "❌ Tidak bisa memberi peringatan kepada Owner atau Bot!" },
          { quoted: m }
        );
      }
      if (targetParticipant?.admin && !isOwner(senderId)) {
        return await sock.sendMessage(
          chatId,
          { text: "❌ Tidak bisa memberi peringatan kepada sesama admin!" },
          { quoted: m }
        );
      }

      const targetNumber = targetId.split("@")[0];
      const senderNumber = senderId.split("@")[0];

      // 1. Send warning message to the group
      const warningText = `
⚠️ *PERINGATAN* ⚠️

👤 *Untuk:* @${targetNumber}
🗣️ *Dari:* @${senderNumber} (Admin)
💬 *Alasan:* ${reason}

Harap patuhi peraturan grup! Pelanggaran berulang dapat menyebabkan ban.
      `.trim();

      await sock.sendMessage(
        chatId,
        { text: warningText, mentions: [targetId, senderId] },
        { quoted: m }
      );

      // 2. Send notification to the owner
      const ownerJid = `${config.nomorOwner}@s.whatsapp.net`;
      const notificationText = `
🔔 *Notifikasi Peringatan Pengguna* 🔔

Admin *${senderName}* (@${senderNumber}) telah memberikan peringatan kepada pengguna di grup.

*Detail:*
👥 *Grup:* ${groupMetadata.subject}
🎯 *Target:* @${targetNumber}
💬 *Alasan:* ${reason}

Mohon ditinjau untuk tindakan lebih lanjut jika diperlukan (misalnya: .ban atau .kick).
      `.trim();

      await sock.sendMessage(ownerJid, {
        text: notificationText,
        mentions: [senderId, targetId],
      });

      logger.info(
        `[WARN] Admin ${senderNumber} memberi peringatan pada ${targetNumber} di grup ${groupMetadata.subject} dengan alasan: ${reason}`
      );
    } catch (error) {
      logger.error("Error in warn command:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "❌ Terjadi kesalahan saat menjalankan command warn." },
        { quoted: m }
      );
    }
  },
};
