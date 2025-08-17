import config from "../../config/setting.js";
import helpers, {
  timeFormatter,
  logger,
  messageFormatter,
} from "../../utils/helpers.js";
import fs from "fs";

export default {
  name: "kick",
  aliases: ["remove"],
  description: "Kick member dari group (hanya untuk owner dan admin)",
  usage: `${config.prefix}kick @user atau reply pesan`,
  category: "group",
  cooldown: 3,
  ownerOnly: false,
  groupOnly: true,
  privateOnly: false,

  async execute(sock, message, args) {
    try {
      const sender = message.key.remoteJid;
      const senderNumber = sender.split("@")[0];
      const text = args.join(" ");
      const m = message;

      // Check if it's a group
      if (!m.key.remoteJid.endsWith("@g.us")) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: "❌ Command ini hanya bisa digunakan di group!",
          },
          { quoted: message }
        );
        return;
      }

      // Get group metadata
      const groupMetadata = await sock.groupMetadata(sender);
      const participants = groupMetadata.participants;
      const botNumber = sock.user.id.split(":")[0] + "@s.whatsapp.net";

      // Check if bot is admin
      const botParticipant = participants.find((p) => p.id === botNumber);
      const isBotAdmin = botParticipant && botParticipant.admin;

      if (!isBotAdmin) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: "❌ Bot harus menjadi admin untuk menggunakan fitur kick!",
          },
          { quoted: message }
        );
        return;
      }

      // Check if sender is admin
      const senderParticipant = participants.find(
        (p) => p.id === m.key.participant || p.id === sender
      );
      const isAdmins = senderParticipant && senderParticipant.admin;

      // Check permissions (owner or admin)
      const isOwnerUser = helpers.validator.isOwner(
        m.key.participant || sender
      );
      if (!isOwnerUser && !isAdmins) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: "❌ Command ini hanya bisa digunakan oleh owner atau admin group!",
          },
          { quoted: message }
        );
        return;
      }

      // Get target user
      let users;
      if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        // If replying to a message
        users = m.message.extendedTextMessage.contextInfo.participant;
      } else if (
        m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0
      ) {
        // If mentioning someone
        users = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
      } else if (text) {
        // If providing number manually
        const cleanNumber = text.replace(/[^0-9]/g, "");
        if (cleanNumber) {
          users = cleanNumber + "@s.whatsapp.net";
        }
      }

      if (!users) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: "❌ Tag/kutip pesan seseorang atau masukkan nomor yang ingin dikick!\n\nContoh:\n• Reply pesan target\n• Tag: @user\n• Nomor: 628xxx",
          },
          { quoted: message }
        );
        return;
      }

      // Check if target is owner or bot
      const ownerNumber = config.nomorOwner + "@s.whatsapp.net";
      if (users === ownerNumber || users === botNumber) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: "❌ Tidak bisa mengeluarkan owner atau bot dari group!",
          },
          { quoted: message }
        );
        return;
      }

      // Check if target is in the group
      const targetParticipant = participants.find((p) => p.id === users);
      if (!targetParticipant) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: "❌ Target tidak ditemukan di group ini!",
          },
          { quoted: message }
        );
        return;
      }

      // Check if target is admin (only owner can kick admin)
      const isTargetAdmin = targetParticipant.admin;
      if (isTargetAdmin && !isOwnerUser) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: "❌ Hanya owner yang bisa mengeluarkan admin group!",
          },
          { quoted: message }
        );
        return;
      }

      // Perform kick
      try {
        await sock.groupParticipantsUpdate(sender, [users], "remove");

        const targetNumber = users.split("@")[0];
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: `✅ Berhasil mengeluarkan @${targetNumber} dari group!`,
            mentions: [users],
          },
          { quoted: message }
        );

        // Log the action
        logger.info(
          `[KICK] ${senderNumber} mengeluarkan ${targetNumber} dari group ${groupMetadata.subject}`
        );
      } catch (error) {
        console.error("Error kicking user:", error);
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: "❌ Terjadi kesalahan saat mengeluarkan member. Pastikan bot memiliki permission yang cukup!",
          },
          { quoted: message }
        );
      }
    } catch (error) {
      console.error("Error in kick command:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: "❌ Terjadi kesalahan sistem!",
        },
        { quoted: message }
      );
    }
  },
};
