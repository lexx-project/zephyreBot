import { addBalance, isOwner } from "../../utils/database.js";
import config from "../../config/setting.js";
import { messageFormatter } from "../../utils/helpers.js";

export default {
  name: "addsaldo",
  aliases: ["tambahsaldo", "givesaldo", "addbalance"],
  category: "owner",
  description: "Menambahkan saldo untuk user tertentu (Owner Only)",
  usage: `${config.prefix}addsaldo <nomor> <jumlah>`,

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
          text: `📝 *Penggunaan:* ${config.prefix}addsaldo <nomor> <jumlah>\n💡 *Contoh:* ${config.prefix}addsaldo 628123456789 10000`,
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
      // Add balance to target user
      addBalance(targetUser, amount);

      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: messageFormatter.success(
            `✅ Berhasil menambahkan ${amount} saldo untuk @${targetNumber}!`
          ),
          mentions: [targetUser],
        },
        { quoted: message }
      );
    } catch (error) {
      console.error("Error adding balance:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: messageFormatter.error(
            "❌ Terjadi kesalahan saat menambahkan saldo!"
          ),
        },
        { quoted: message }
      );
    }
  },
};
