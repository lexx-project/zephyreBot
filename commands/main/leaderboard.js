import config from "../../config/setting.js";
import { logger, messageFormatter } from "../../utils/helpers.js";
import { getAllUsers } from "../../utils/database.js";

export default {
  name: "leaderboard",
  aliases: ["lb", "peringkat"],
  description: "Menampilkan papan peringkat user berdasarkan level dan EXP.",
  usage: `${config.prefix}leaderboard`,
  category: "main",
  cooldown: 20, // Cooldown 20 detik untuk mencegah spam
  limitExempt: true,

  async execute(sock, m, args) {
    try {
      const senderId = m.key.participant || m.key.remoteJid;
      const allUsers = getAllUsers();

      // 1. Convert object to array and filter
      const userArray = Object.entries(allUsers)
        .map(([id, data]) => ({ id, ...data }))
        .filter((user) => user.id.endsWith("@s.whatsapp.net")) // Hanya user, bukan grup
        .filter((user) => user.level > 1 || (user.level === 1 && user.exp > 0)); // Filter user default

      // 2. Sort users by level, then by EXP
      userArray.sort((a, b) => {
        if (a.level !== b.level) {
          return b.level - a.level;
        }
        return b.exp - a.exp;
      });

      // 3. Build the leaderboard string for the top 10
      let leaderboardText = `🏆 *LEADERBOARD TOP 10*\n\n`;
      const top10 = userArray.slice(0, 10);

      if (top10.length === 0) {
        leaderboardText +=
          "Belum ada pemain di papan peringkat. Jadilah yang pertama!";
      } else {
        top10.forEach((user, index) => {
          const rank = index + 1;
          const userNumber = user.id.split("@")[0];
          const medal =
            rank === 1
              ? "🥇"
              : rank === 2
              ? "🥈"
              : rank === 3
              ? "🥉"
              : ` ${rank}.`;
          leaderboardText += `${medal} @${userNumber}\n`;
          leaderboardText += `   └─ Level: ${
            user.level
          } | EXP: ${user.exp.toLocaleString()}\n\n`;
        });
      }

      // 4. Find the sender's rank
      const senderRankIndex = userArray.findIndex(
        (user) => user.id === senderId
      );

      leaderboardText += `----------------------------------\n`;
      if (senderRankIndex !== -1) {
        const senderRank = senderRankIndex + 1;
        leaderboardText += `👤 *Peringkat Kamu*\n`;
        leaderboardText += `   └─ #${senderRank} dari ${userArray.length} pemain\n`;
      } else {
        leaderboardText += `Anda belum masuk peringkat. Mainkan game untuk mendapatkan EXP!\n`;
      }

      // 5. Send the message with mentions
      const mentions = top10.map((user) => user.id);
      if (senderRankIndex !== -1) {
        mentions.push(senderId);
      }

      await sock.sendMessage(
        m.key.remoteJid,
        {
          text: leaderboardText.trim(),
          mentions: [...new Set(mentions)], // Ensure unique mentions
        },
        { quoted: m }
      );
    } catch (error) {
      logger.error("Error in leaderboard command:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        {
          text: messageFormatter.error(
            "Terjadi kesalahan saat menampilkan leaderboard."
          ),
        },
        { quoted: m }
      );
    }
  },
};
