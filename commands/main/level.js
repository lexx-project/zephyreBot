import config from "../../config/setting.js";
import { messageFormatter } from "../../utils/helpers.js";
import {
  getUser,
  addExp,
  getLevelInfo,
  getRequiredExp,
  isOwner,
  getUserStatus,
} from "../../utils/database.js";

export default {
  name: "level",
  aliases: ["lvl", "rank"],
  description: "Melihat level dan EXP kamu",
  usage: `${config.prefix}level`,
  category: "main",
  cooldown: 3,
  ownerOnly: false,
  groupOnly: false,
  privateOnly: false,

  async execute(sock, message, args) {
    try {
      const userId = message.key.participant || message.key.remoteJid;
      const user = getUser(userId);
      const levelInfo = getLevelInfo(userId);

      // Defensive calculation for progress bar to prevent crashes
      const progress = Math.max(0, Math.min(100, levelInfo.progress || 0));
      const filledBlocks = Math.floor(progress / 10);
      const emptyBlocks = 10 - filledBlocks;

      const progressBar = "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);

      let responseText = `📊 *LEVEL & EXP INFO*\n\n`;
      responseText += `👤 *User:* ${message.pushName || "User"}\n`;
      responseText += `🏆 *Level:* ${levelInfo.level}\n`;
      responseText += `⭐ *EXP:* ${levelInfo.exp}/${levelInfo.requiredExp}\n`;
      responseText += `📈 *Progress:* ${levelInfo.progress}%\n`;
      responseText += `[${progressBar}] ${levelInfo.progress}%\n\n`;
      responseText += `💰 *Saldo:* ${user.balance} koin\n`;
      responseText += `🎮 *Game Dimainkan:* ${user.gamesPlayed}\n`;
      responseText += `💎 *Total Earned:* ${user.totalEarned} koin\n`;
      const userStatus = getUserStatus(userId);
      const maxLimit =
        userStatus === "owner"
          ? "Unlimited"
          : userStatus === "premium"
          ? "500"
          : "50";
      responseText += `🎯 *Limit Harian:* ${user.limit}/${maxLimit}\n\n`;

      const nextLevelExp = getRequiredExp(levelInfo.level + 1);
      responseText += `🎯 *EXP untuk Level ${
        levelInfo.level + 1
      }:* ${nextLevelExp}\n`;
      responseText += `⚡ *Sisa EXP dibutuhkan:* ${
        nextLevelExp - levelInfo.exp
      }`;

      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: responseText,
        },
        { quoted: message }
      );
    } catch (error) {
      console.error("Error in level command:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: messageFormatter.error(
            "❌ Terjadi kesalahan saat mengambil data level!"
          ),
        },
        { quoted: message }
      );
    }
  },
};
