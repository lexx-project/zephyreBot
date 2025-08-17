import config from "../../config/setting.js";
import {
  timeFormatter,
  logger,
  messageFormatter,
} from "../../utils/helpers.js";
import {
  updateBalance,
  getBalance,
  addGameStats,
  getSettings,
  addExp,
} from "../../utils/database.js";
import fs from "fs";
import path from "path";

// Global game sessions storage
const tebaklirikSessions = new Map();

// Helper function to get random question
function getRandomQuestion() {
  try {
    const dataPath = path.join(process.cwd(), "lib", "game", "tebaklirik.json");
    const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    return data[Math.floor(Math.random() * data.length)];
  } catch (error) {
    logger.error(`Error loading tebaklirik data: ${error.message}`);
    return null;
  }
}

// Helper function to create hint
function createHint(answer) {
  return answer.replace(/[b|c|d|f|g|h|j|k|l|m|n|p|q|r|s|t|v|w|x|y|z]/gi, "-");
}

// Helper function to clean answer for comparison
function cleanAnswer(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export default {
  name: "tebaklirik",
  aliases: ["lirik", "tebaklyric"],
  description: "Game tebak lirik lagu - lengkapi lirik yang hilang!",
  usage: `${config.prefix}tebaklirik`,
  category: "game",
  cooldown: 3,
  ownerOnly: false,
  groupOnly: true,
  privateOnly: false,

  async execute(sock, m, args) {
    try {
      const chatId = m.key.remoteJid;
      const userId = m.key.participant || m.key.remoteJid;
      const userName = m.pushName || "User";

      // Check if there's already an active session for this group
      if (tebaklirikSessions.has(chatId)) {
        await sock.sendMessage(
          chatId,
          {
            text: "❌ Masih ada sesi tebak lirik yang sedang berlangsung!\nSelesaikan dulu atau ketik `.nyerah` untuk menyerah.",
          },
          { quoted: m }
        );
        return;
      }

      // Get random question
      const questionData = getRandomQuestion();
      if (!questionData) {
        await sock.sendMessage(
          chatId,
          {
            text: "❌ Terjadi kesalahan saat memuat soal. Silakan coba lagi!",
          },
          { quoted: m }
        );
        return;
      }

      const { soal, jawaban } = questionData;
      const hint = createHint(jawaban);
      const gameTime = 60; // 60 seconds
      const reward = Math.floor(Math.random() * 1001) + 1000; // 1000-2000 balance

      // Create session
      const session = {
        soal,
        jawaban: jawaban.toLowerCase(),
        hint,
        reward,
        startTime: Date.now(),
        participants: new Set(),
        creator: userId,
        creatorName: userName,
      };

      tebaklirikSessions.set(chatId, session);

      // Set timeout for game
      setTimeout(async () => {
        if (tebaklirikSessions.has(chatId)) {
          const session = tebaklirikSessions.get(chatId);
          await sock.sendMessage(chatId, {
            text: `⏰ *WAKTU HABIS!*\n\n📝 Soal: ${session.soal}\n✅ Jawaban: *${jawaban}*\n\n🎮 Game berakhir! Tidak ada yang berhasil menjawab.`,
          });
          tebaklirikSessions.delete(chatId);
          logger.info(`⏰ Tebak lirik game timeout in ${chatId}`);
        }
      }, gameTime * 1000);

      // Send game message
      await sock.sendMessage(
        chatId,
        {
          text: `🎵 *GAME TEBAK LIRIK* 🎵\n\n📝 *Soal:*\n${soal}\n\n💡 *Petunjuk:* ${hint}\n⏰ *Waktu:* ${gameTime} detik\n💰 *Hadiah:* ${reward} balance + EXP\n\n🎯 Ketik jawabanmu atau \`.nyerah\` untuk menyerah!`,
        },
        { quoted: m }
      );

      logger.info(
        `🎵 ${userName} started tebak lirik game in ${chatId} - Answer: ${jawaban}`
      );
    } catch (error) {
      logger.error(`Error in tebaklirik game: ${error.message}`);
      await sock.sendMessage(
        m.key.remoteJid,
        {
          text: "❌ Terjadi kesalahan saat memulai game. Silakan coba lagi!",
        },
        { quoted: m }
      );
    }
  },

  // Function to handle answer checking
  async checkAnswer(sock, m, userAnswer) {
    try {
      const chatId = m.key.remoteJid;
      const userId = m.key.participant || m.key.remoteJid;
      const userName = m.pushName || "User";

      const session = tebaklirikSessions.get(chatId);
      if (!session) return false;

      const cleanUserAnswer = cleanAnswer(userAnswer);
      const cleanCorrectAnswer = cleanAnswer(session.jawaban);

      // Add participant to session
      session.participants.add(userId);

      if (cleanUserAnswer === cleanCorrectAnswer) {
        // Correct answer!
        const timeTaken = Math.floor((Date.now() - session.startTime) / 1000);
        const timeBonus = Math.max(0, Math.floor((60 - timeTaken) / 10) * 2);
        const totalReward = session.reward + timeBonus;

        // Update user balance and exp
        await updateBalance(userId, totalReward);
        await addExp(userId, 20);

        // Add game stats
        await addGameStats(userId, "tebaklirik", true);

        // Send success message
        await sock.sendMessage(
          chatId,
          {
            text: `🎉 *JAWABAN BENAR!* 🎉\n\n👤 Pemenang: ${userName}\n📝 Soal: ${session.soal}\n✅ Jawaban: *${session.jawaban}*\n⏱️ Waktu: ${timeTaken} detik\n💰 Hadiah: ${totalReward} balance\n⭐ Bonus: +20 EXP\n\n🎵 Selamat! Kamu berhasil menebak lirik dengan tepat!`,
          },
          { quoted: m }
        );

        // Clean up session
        tebaklirikSessions.delete(chatId);

        logger.info(
          `🎵 ${userName} won tebak lirik game in ${chatId} - Time: ${timeTaken}s, Reward: ${totalReward}`
        );
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error checking tebaklirik answer: ${error.message}`);
      return false;
    }
  },

  // Function to get active sessions (for debugging)
  getActiveSessions() {
    return tebaklirikSessions;
  },

  // Function to clear session (for surrender functionality)
  clearSession(chatId) {
    const session = tebaklirikSessions.get(chatId);
    if (session) {
      tebaklirikSessions.delete(chatId);
      return {
        soal: session.soal,
        jawaban: session.jawaban,
        participants: session.participants.size,
        duration: Math.floor((Date.now() - session.startTime) / 1000),
      };
    }
    return null;
  },

  // Function to check if session exists
  hasSession(chatId) {
    return tebaklirikSessions.has(chatId);
  },
};
