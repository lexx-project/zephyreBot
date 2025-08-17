import config from "../../config/setting.js";
import { logger, validator, messageFormatter } from "../../utils/helpers.js";
import { getGroup, saveDatabase, loadDatabase } from "../../utils/database.js";

export default {
  name: "jadwalsholat",
  description: "Mengaktifkan atau menonaktifkan notifikasi jadwal sholat.",
  usage: `${config.prefix}jadwalsholat <on/off>`,
  category: "group",
  cooldown: 10,
  ownerOnly: false,
  groupOnly: true,

  async execute(sock, m, args) {
    try {
      const chatId = m.key.remoteJid;
      const senderId = m.key.participant;

      // Admin & Owner check
      const groupMetadata = await sock.groupMetadata(chatId);
      const senderParticipant = groupMetadata.participants.find(
        (p) => p.id === senderId
      );
      const isSenderAdmin = senderParticipant?.admin;
      const isOwnerUser = validator.isOwner(senderId);

      if (!isSenderAdmin && !isOwnerUser) {
        return await sock.sendMessage(
          chatId,
          { text: "❌ Command ini hanya untuk admin grup!" },
          { quoted: m }
        );
      }

      const option = args[0]?.toLowerCase();
      if (option !== "on" && option !== "off") {
        return await sock.sendMessage(
          chatId,
          { text: `Penggunaan: ${this.usage}` },
          { quoted: m }
        );
      }

      const db = loadDatabase();
      const groupData = getGroup(chatId); // Ensure group data exists

      if (option === "on") {
        if (groupData.jadwalsholat.enabled) {
          return await sock.sendMessage(
            chatId,
            { text: "✅ Notifikasi jadwal sholat sudah aktif di grup ini." },
            { quoted: m }
          );
        }
        groupData.jadwalsholat.enabled = true;
        groupData.jadwalsholat.city = "Jakarta"; // Hardcoded as requested
        db.groups[chatId] = groupData;
        saveDatabase(db);

        await sock.sendMessage(
          chatId,
          {
            text: "✅ Notifikasi jadwal sholat berhasil diaktifkan untuk wilayah Jakarta dan sekitarnya.",
          },
          { quoted: m }
        );
        logger.info(`[JADWAL SHOLAT] Fitur diaktifkan untuk grup ${chatId}`);
      } else if (option === "off") {
        if (!groupData.jadwalsholat.enabled) {
          return await sock.sendMessage(
            chatId,
            {
              text: "ℹ️ Notifikasi jadwal sholat sudah tidak aktif di grup ini.",
            },
            { quoted: m }
          );
        }
        groupData.jadwalsholat.enabled = false;
        db.groups[chatId] = groupData;
        saveDatabase(db);

        await sock.sendMessage(
          chatId,
          { text: "✅ Notifikasi jadwal sholat berhasil dinonaktifkan." },
          { quoted: m }
        );
        logger.info(`[JADWAL SHOLAT] Fitur dinonaktifkan untuk grup ${chatId}`);
      }
    } catch (error) {
      logger.error("Error in jadwalsholat command:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "❌ Terjadi kesalahan." },
        { quoted: m }
      );
    }
  },
};
