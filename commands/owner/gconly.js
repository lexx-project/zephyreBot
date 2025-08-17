import config from "../../config/setting.js";
import { isOwner } from "../../utils/database.js";
import { loadDatabase, saveDatabase } from "../../utils/database.js";
import { messageFormatter } from "../../utils/helpers.js";

export default {
  name: "gconly",
  aliases: ["grouponly", "gcmode"],
  description:
    "Mengatur apakah bot hanya bisa digunakan di grup atau juga di chat pribadi",
  usage: `${config.prefix}gconly <on/off>`,
  category: "owner",
  cooldown: 3,
  ownerOnly: true,
  groupOnly: false,
  privateOnly: false,

  async execute(sock, message, args) {
    try {
      const userId = message.key.participant || message.key.remoteJid;

      // Validasi owner
      if (!isOwner(userId)) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: messageFormatter.error("❌ Command ini hanya untuk owner!"),
          },
          { quoted: message }
        );
        return;
      }

      // Validasi input
      if (!args[0]) {
        const db = loadDatabase();
        const currentStatus = db.settings.gcOnly || false;

        await sock.sendMessage(
          message.key.remoteJid,
          {
            text:
              `🔧 *STATUS GC ONLY MODE*\n\n` +
              `📊 *Status saat ini:* ${
                currentStatus ? "🟢 ON" : "🔴 OFF"
              }\n\n` +
              `📝 *Penggunaan:*\n` +
              `• ${config.prefix}gconly on - Aktifkan mode grup only\n` +
              `• ${config.prefix}gconly off - Nonaktifkan mode grup only\n\n` +
              `ℹ️ *Keterangan:*\n` +
              `• ON: User free hanya bisa pakai bot di grup\n` +
              `• OFF: User free bisa pakai bot dimana saja\n` +
              `• User premium tetap bisa pakai bot dimana saja\n` +
              `• Game werewolf tetap bisa digunakan di chat pribadi`,
          },
          message
        );
        return;
      }

      const action = args[0].toLowerCase();

      if (action !== "on" && action !== "off") {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: messageFormatter.warning(
              `⚠️ *Parameter tidak valid!*\n\n` +
                `📝 *Gunakan:*\n` +
                `• ${config.prefix}gconly on\n` +
                `• ${config.prefix}gconly off`
            ),
          },
          { quoted: message }
        );
        return;
      }

      // Update database
      const db = loadDatabase();
      const newStatus = action === "on";

      if (!db.settings) {
        db.settings = {};
      }

      db.settings.gcOnly = newStatus;
      saveDatabase(db);

      // Kirim konfirmasi
      const statusText = newStatus ? "🟢 DIAKTIFKAN" : "🔴 DINONAKTIFKAN";
      const statusEmoji = newStatus ? "🔒" : "🔓";

      await sock.sendMessage(
        message.key.remoteJid,
        {
          text:
            `✅ *GC ONLY MODE ${statusText}*\n\n` +
            `${statusEmoji} *Status baru:* ${newStatus ? "ON" : "OFF"}\n\n` +
            `📋 *Efek perubahan:*\n` +
            `${
              newStatus
                ? "• User free hanya bisa pakai bot di grup\n" +
                  "• User premium tetap bisa pakai bot dimana saja\n" +
                  "• Game werewolf tetap bisa di chat pribadi\n" +
                  "• Notifikasi ke user free dibatasi 30 menit"
                : "• Semua user bisa pakai bot dimana saja\n" +
                  "• Mode normal diaktifkan kembali"
            }\n\n` +
            `⏰ *Waktu:* ${new Date().toLocaleString("id-ID", {
              timeZone: "Asia/Jakarta",
            })}`,
        },
        { quoted: message }
      );
    } catch (error) {
      console.error("Error in gconly command:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: messageFormatter.error(
            "Terjadi kesalahan saat mengatur GC Only mode!"
          ),
        },
        { quoted: message }
      );
    }
  },
};
