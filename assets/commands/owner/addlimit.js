import { addLimit, isOwner } from "../../utils/database.js";
import config from "../../config/setting.js";
import { messageFormatter } from "../../utils/helpers.js";

export default {
  name: "addlimit",
  aliases: ["tambahanlimit", "givelimit"],
  category: "owner",
  description: "Menambahkan limit untuk user tertentu (Owner Only)",
  usage: `${config.prefix}addlimit <nomor> <jumlah>`,

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
          text: `📝 *Penggunaan:* ${config.prefix}addlimit <nomor> <jumlah>\n💡 *Contoh:* ${config.prefix}addlimit 628123456789 10`,
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
      // Add limit to target user
      addLimit(targetUser, amount);

      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: messageFormatter.success(
            `✅ Berhasil menambahkan ${amount} limit untuk @${targetNumber}!`
          ),
          mentions: [targetUser],
        },
        { quoted: message }
      );
    } catch (error) {
      console.error("Error adding limit:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: messageFormatter.error(
            "❌ Terjadi kesalahan saat menambahkan limit!"
          ),
        },
        { quoted: message }
      );
    }
  },
};
