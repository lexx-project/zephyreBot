import config from "../../config/setting.js";
import { logger, validator } from "../../utils/helpers.js";
import { getGroupRentals } from "../../utils/database.js";

export default {
  name: "listsewa",
  description: "Menampilkan daftar grup yang sedang menyewa bot.",
  usage: `${config.prefix}listsewa`,
  category: "owner",
  cooldown: 10,
  ownerOnly: true,

  async execute(sock, m, args) {
    try {
      if (!validator.isOwner(m.key.remoteJid)) {
        return; // Should be handled by the main handler, but as a safeguard.
      }

      const rentedGroups = getGroupRentals();
      const groupIds = Object.keys(rentedGroups);

      if (groupIds.length === 0) {
        return await sock.sendMessage(
          m.key.remoteJid,
          { text: "ℹ️ Saat ini tidak ada grup yang menyewa bot." },
          { quoted: m }
        );
      }

      let replyText = `*Daftar Grup Sewa (${groupIds.length})*\n\n`;
      let counter = 1;

      for (const groupId of groupIds) {
        const rentalInfo = rentedGroups[groupId];
        const expiryDate = new Date(rentalInfo.expiry);
        const now = new Date();
        const timeLeftMs = expiryDate.getTime() - now.getTime();
        const isExpired = timeLeftMs <= 0;

        let groupName = "Nama Grup Tidak Diketahui";
        try {
          const metadata = await sock.groupMetadata(groupId);
          groupName = metadata.subject;
        } catch (err) {
          logger.warning(
            `[LISTSEWA] Gagal mendapatkan metadata untuk grup ${groupId}: ${err.message}`
          );
        }

        const daysLeft = Math.ceil(timeLeftMs / (1000 * 60 * 60 * 24));

        replyText += `*${counter}. ${groupName}*\n`;
        replyText += `   - *ID:* \`${groupId}\`\n`;
        replyText += `   - *Berakhir:* ${expiryDate.toLocaleDateString(
          "id-ID",
          { day: "2-digit", month: "long", year: "numeric" }
        )}\n`;
        replyText += `   - *Status:* ${
          isExpired ? `🔴 Kedaluwarsa` : `🟢 Aktif (${daysLeft} hari lagi)`
        }\n\n`;
        counter++;
      }

      await sock.sendMessage(
        m.key.remoteJid,
        { text: replyText.trim() },
        { quoted: m }
      );
    } catch (error) {
      logger.error("Error in listsewa command:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "❌ Terjadi kesalahan saat menampilkan daftar sewa." },
        { quoted: m }
      );
    }
  },
};
