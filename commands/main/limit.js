import config from "../../config/setting.js";
import { messageFormatter } from "../../utils/helpers.js";
import { getUser, isOwner, getUserStatus } from "../../utils/database.js";

export default {
  name: "limit",
  aliases: ["mylimit"],
  description: "Melihat sisa limit harian kamu",
  usage: `${config.prefix}limit`,
  category: "main",
  cooldown: 3,
  limitExempt: true, // Tidak menggunakan limit
  ownerOnly: false,
  groupOnly: false,
  privateOnly: false,

  async execute(sock, message, args) {
    try {
      const userId = message.key.participant || message.key.remoteJid;
      const user = getUser(userId);

      let responseText = `📊 *LIMIT HARIAN*\n\n`;
      responseText += `👤 *User:* ${message.pushName || "User"}\n`;

      const userStatus = getUserStatus(userId);

      if (userStatus === "owner") {
        responseText += `👑 *Status:* Owner\n`;
        responseText += `🔥 *Limit:* Unlimited\n`;
      } else if (userStatus === "premium") {
        responseText += `💎 *Status:* Premium\n`;
        responseText += `🔥 *Limit:* ${user.limit}/500\n`;
      } else {
        responseText += `🆓 *Status:* Free User\n`;
        responseText += `🔥 *Limit:* ${user.limit}/50\n`;
      }

      responseText += `\n📅 *Reset:* Setiap hari jam 00:00 WIB\n\n`;

      if (user.limit <= 5) {
        responseText += `⚠️ *Peringatan:* Limit hampir habis!\n`;
        if (!isOwner(userId)) {
          responseText += `💰 *Beli Limit:* Gunakan ${config.prefix}buylimit untuk membeli limit tambahan (1000 saldo per limit)\n`;
          responseText += `💡 *Tip:* Upgrade ke Premium untuk limit 500/hari`;
        }
      } else if (!isOwner(userId)) {
        responseText += `💰 *Info:* Gunakan ${config.prefix}buylimit untuk membeli limit tambahan (1000 saldo per limit)`;
      }

      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: responseText,
        },
        { quoted: message }
      );
    } catch (error) {
      console.error("Error in limit command:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: messageFormatter.error(
            "❌ Terjadi kesalahan saat mengambil data limit!"
          ),
        },
        { quoted: message }
      );
    }
  },
};
