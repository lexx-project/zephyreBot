import { addExp, isOwner } from "../../utils/database.js";
import config from "../../config/setting.js";
import { messageFormatter } from "../../utils/helpers.js";

export default {
  name: "addexp",
  aliases: ["tambahexp", "giveexp", "addxp"],
  category: "owner",
  description: "Menambahkan EXP untuk user tertentu (Owner Only)",
  usage: `${config.prefix}addexp <nomor> <jumlah>`,

  async execute(sock, message, args) {
    const sender = message.key.remoteJid.endsWith("@g.us")
      ? message.key.participant || message.participant
      : message.key.remoteJid;

    // Check if user is owner
    if (!isOwner(sender)) {
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: messageFormatter.error("❌ Command ini hanya untuk Owner!"),
        },
        { quoted: message }
      );
      return;
    }

    // Validate arguments
    if (!args[0] || !args[1] || isNaN(args[1]) || parseInt(args[1]) <= 0) {
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: `📝 *Penggunaan:* ${config.prefix}addexp <nomor> <jumlah>\n💡 *Contoh:* ${config.prefix}addexp 628123456789 500`,
        },
        { quoted: message }
      );
      return;
    }

    const targetNumber = args[0].replace(/[^0-9]/g, "");
    const amount = parseInt(args[1]);

    // Format target number
    const targetUser = targetNumber.startsWith("62")
      ? targetNumber + "@s.whatsapp.net"
      : "62" + targetNumber + "@s.whatsapp.net";

    try {
      // Add EXP to target user
      addExp(targetUser, amount);

      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: messageFormatter.success(
            `✅ *Berhasil menambahkan EXP!*\n\n` +
              `👤 *Target:* ${targetNumber}\n` +
              `⭐ *Jumlah:* ${amount.toLocaleString("id-ID")} EXP\n` +
              `⏰ *Waktu:* ${new Date().toLocaleString("id-ID")}`
          ),
        },
        { quoted: message }
      );
    } catch (error) {
      console.error("Error adding EXP:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: messageFormatter.error(
            "❌ Terjadi kesalahan saat menambahkan EXP!"
          ),
        },
        { quoted: message }
      );
    }
  },
};
