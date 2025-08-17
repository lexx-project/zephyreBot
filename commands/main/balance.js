import config from "../../config/setting.js";
import { getUser, getBalance, getUserStatus } from "../../utils/database.js";
import { messageFormatter } from "../../utils/helpers.js";

export default {
  name: "balance",
  aliases: ["bal", "saldo"],
  description: "Cek saldo kamu saat ini",
  usage: `${config.prefix}balance atau ${config.prefix}saldo`,
  category: "economy",
  cooldown: 3,
  ownerOnly: false,
  groupOnly: false,
  privateOnly: false,

  async execute(sock, message, args) {
    try {
      const userId = message.key.participant || message.key.remoteJid;
      const user = getUser(userId);
      const senderNumber = message.key.remoteJid.split("@")[0];

      const userStatus = getUserStatus(userId);
      const statusEmoji =
        userStatus === "owner" ? "👑" : userStatus === "premium" ? "💎" : "🆓";
      const statusText =
        userStatus === "owner"
          ? "Owner"
          : userStatus === "premium"
          ? "Premium"
          : "Free User";

      let balanceText = `💳 *INFORMASI SALDO*\n\n`;
      balanceText += `👤 *User:* @${senderNumber}\n`;
      balanceText += `${statusEmoji} *Status:* ${statusText}\n`;
      balanceText += `💰 *Saldo saat ini:* ${user.balance.toLocaleString()}\n`;
      balanceText += `📈 *Total earned:* ${user.totalEarned.toLocaleString()}\n`;
      balanceText += `🎮 *Games played:* ${user.gamesPlayed}\n\n`;
      balanceText += `💡 *Tip:* Main game yang banyak untuk mendapatkan saldo!, limit habis? beli premium lahh`;

      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: balanceText,
          mentions: [userId],
        },
        { quoted: message }
      );
    } catch (error) {
      console.error("❌ Error saat mengecek saldo:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: "❌ Terjadi kesalahan saat mengecek saldo!",
        },
        { quoted: message }
      );
    }
  },
};
