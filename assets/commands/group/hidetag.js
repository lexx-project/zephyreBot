import config from "../../config/setting.js";
import helpers, {
  timeFormatter,
  logger,
  messageFormatter,
} from "../../utils/helpers.js";
import fs from "fs";

export default {
  name: "hidetag",
  aliases: ["h"],
  description: "Tag semua member group (hanya untuk owner dan admin)",
  usage: `${config.prefix}hidetag [text]`,
  category: "group",
  cooldown: 5,
  ownerOnly: false,
  groupOnly: true,
  privateOnly: false,

  async execute(sock, message, args) {
    try {
      const sender = message.key.remoteJid;
      const senderNumber = sender.split("@")[0];
      const text = args.join(" ");
      const m = message;
      const q = text;

      // Check if it's a group
      if (!m.key.remoteJid.endsWith("@g.us")) {
        await sock.sendMessage(
          sender,
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
          sender,
          {
            text: "❌ Command ini hanya bisa digunakan oleh owner atau admin group!",
          },
          { quoted: message }
        );
        return;
      }

      // Check if bot has admin permissions for mentions
      if (!isBotAdmin) {
        await sock.sendMessage(
          sender,
          {
            text: "❌ Bot harus menjadi admin untuk menggunakan fitur hidetag!",
          },
          { quoted: message }
        );
        return;
      }

      const mime =
        m.message?.imageMessage?.mimetype ||
        m.message?.videoMessage?.mimetype ||
        m.message?.audioMessage?.mimetype ||
        m.message?.documentMessage?.mimetype ||
        "";

      const isMedia = /image|video|audio|document/i.test(mime);

      // Fake text object for quoted messages
      const ftext = {
        key: {
          fromMe: false,
          participant: `0@s.whatsapp.net`,
          ...(sender ? { remoteJid: "status@broadcast" } : {}),
        },
        message: {
          extendedTextMessage: {
            text: `🏷️ Hidetag by ${config.botName}`,
            title: config.botName,
            jpegThumbnail: null,
          },
        },
      };

      // Handle quoted message
      if (m.quoted) {
        await sock.sendMessage(
          sender,
          {
            forward: m.quoted.fakeObj,
            mentions: participants.map((a) => a.id),
          },
          { quoted: message }
        );
      }
      // Handle media message
      else if (isMedia) {
        try {
          const mediaPath = await sock.downloadAndSaveMediaMessage(m);
          const mediaBuffer = fs.readFileSync(mediaPath);
          const mediaType = m.mtype;

          const messageOptions = {
            mentions: participants.map((a) => a.id),
          };

          if (mediaType === "imageMessage") {
            messageOptions.image = mediaBuffer;
            messageOptions.caption = text ? text : "";
          } else if (mediaType === "videoMessage") {
            messageOptions.video = mediaBuffer;
            messageOptions.caption = text ? text : "";
          } else if (mediaType === "audioMessage") {
            messageOptions.audio = mediaBuffer;
          } else if (mediaType === "documentMessage") {
            messageOptions.document = mediaBuffer;
            messageOptions.mimetype = mime;
            messageOptions.fileName = m.fileName || "document";
          } else {
            console.error("Unknown media type:", mediaType);
            await sock.sendMessage(
              sender,
              {
                text: "❌ Tipe media tidak didukung",
              },
              { quoted: message }
            );
            return;
          }

          await sock.sendMessage(sender, messageOptions, { quoted: message });

          // Clean up downloaded file
          fs.unlinkSync(mediaPath);
        } catch (error) {
          logger.error("Error processing media for hidetag:", error);
          await sock.sendMessage(
            sender,
            {
              text: "❌ Gagal memproses media",
            },
            { quoted: message }
          );
        }
      }
      // Handle text message
      else {
        await sock.sendMessage(
          sender,
          {
            text: q ? q : "🏷️ *Hidetag*",
            mentions: participants.map((a) => a.id),
            quoted: ftext,
          },
          { quoted: message }
        );
      }

      logger.info(
        `🏷️ Hidetag digunakan oleh ${senderNumber} di group ${groupMetadata.subject}`
      );
    } catch (error) {
      logger.error("❌ Error in hidetag command:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: "❌ Terjadi kesalahan saat menggunakan hidetag!",
        },
        { quoted: message }
      );
    }
  },
};
