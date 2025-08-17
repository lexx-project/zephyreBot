import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
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

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Game sessions storage
const susunkata = {};

// Game settings
const gamewaktu = 60; // 60 seconds

// Helper function to pick random item
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper function to generate random number
function randomNomor(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default {
  name: "susunkata",
  description: "Game susun kata berdasarkan petunjuk",
  aliases: ["sk"],
  category: "game",
  usage: ".susunkata",
  cooldown: 3,

  async execute(sock, m) {
    try {
      const chatId = m.key.remoteJid;
      const userId = m.key.participant || m.key.remoteJid;
      const userName = m.pushName || "User";

      // Check if there's already an active session
      if (chatId in susunkata) {
        await sock.sendMessage(chatId, {
            text: "❌ Masih ada sesi yang belum diselesaikan!",
          }, { quoted: m });
        return;
      }

      // Load questions from JSON file
      const questionsPath = path.join(
        __dirname,
        "../../lib/game/susunkata.json"
      );
      const questionsData = JSON.parse(fs.readFileSync(questionsPath, "utf8"));

      // Pick random question
      const { index, soal, tipe, jawaban } = pickRandom(questionsData);

      console.log(`[SUSUN KATA] Jawaban: ${jawaban}`);
      logger.info(
        `[SUSUN KATA] ${userName} started game in ${chatId}. Answer: ${jawaban}`
      );

      // Create hint by replacing consonants with dashes
      const petunjuk = jawaban.replace(
        /[b|c|d|f|g|h|j|k|l|m|n|p|q|r|s|t|v|w|x|y|z]/gi,
        "-"
      );

      const hadiah = randomNomor(10, 20);

      const teks1 =
        `🔤 *GAME SUSUN KATA* 🔤

` +
        `📝 *Soal:* ${soal}
` +
        `🏷️ *Tipe:* ${tipe}
` +
        `💡 *Petunjuk:* ${petunjuk}
` +
        `⏰ *Waktu:* ${gamewaktu} detik
` +
        `🎁 *Hadiah:* ${hadiah} koin

` +
        `💡 Ketik *.nyerah* untuk menyerah`;

      await sock.sendMessage(chatId, {
          text: teks1,
        }, { quoted: m });

      // Store game session
      susunkata[chatId] = {
        soal: soal,
        jawaban: jawaban.toLowerCase(),
        hadiah: hadiah,
        startTime: Date.now(),
        userId: userId,
        userName: userName,
        waktu: setTimeout(function () {
          if (susunkata[chatId]) {
            sock.sendMessage(chatId, {
              text: `⏰ *WAKTU HABIS!*\n\nJawaban dari soal:\n${soal}\n\nAdalah: *${jawaban}*`,
            });
            logger.info(
              `[SUSUN KATA] Game timeout in ${chatId}. Answer was: ${susunkata[chatId].jawaban}`
            );
            delete susunkata[chatId];
          }
        }, gamewaktu * 1000),
      };
    } catch (error) {
      logger.error(`[SUSUN KATA] Error: ${error.message}`);
      await sock.sendMessage(m.key.remoteJid, {
          text: "❌ Terjadi kesalahan saat memulai game susun kata!",
        }, { quoted: m });
    }
  },

  // Handle susun kata answers
  async handleAnswer(sock, m, userAnswer) {
    try {
      const chatId = m.key.remoteJid;
      const userId = m.key.participant || m.key.remoteJid;
      const userName = m.pushName || "User";

      if (!susunkata[chatId]) return false;

      const gameData = susunkata[chatId];
      const answer = userAnswer.toLowerCase().trim();
      const correctAnswer = gameData.jawaban;

      if (answer === correctAnswer) {
        // Correct answer
        clearTimeout(gameData.waktu);
        const timeTaken = Math.round((Date.now() - gameData.startTime) / 1000);
        const bonusTime = Math.max(0, gamewaktu - timeTaken);
        const totalHadiah = gameData.hadiah + bonusTime;

        // Update user balance
        const newBalance = updateBalance(
          userId,
          totalHadiah,
          "Susun Kata reward"
        );

        // Add EXP reward
        const settings = getSettings();
        const expReward = settings.exp_rewards.susunkata;
        const expResult = addExp(userId, expReward);

        // Add game stats
        addGameStats(userId);

        let replyText = `🎉 *BENAR!* 🎉\n\n`;
        replyText += `👤 *Penjawab:* ${userName}\n`;
        replyText += `⏱️ *Waktu:* ${timeTaken} detik\n`;
        replyText += `🎁 *Hadiah:* ${totalHadiah} koin\n`;
        replyText += `💰 *Bonus waktu:* ${bonusTime} koin\n`;
        replyText += `⭐ *EXP:* +${expReward} EXP\n`;
        replyText += `💳 *Saldo:* ${newBalance} koin`;

        if (expResult.leveledUp) {
          replyText += `\n🎉 *LEVEL UP!* Level ${expResult.newLevel}`;
        }

        await sock.sendMessage(chatId, {
            text: replyText,
          }, { quoted: m });

        logger.info(
          `[SUSUN KATA] ${userName} answered correctly in ${chatId}. Time: ${timeTaken}s, Reward: ${totalHadiah}`
        );

        delete susunkata[chatId];
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`[SUSUN KATA] Handle answer error: ${error.message}`);
      return false;
    }
  },

  // Get active sessions
  getSessions() {
    return susunkata;
  },

  // Get specific session
  getSession(chatId) {
    return susunkata[chatId] || null;
  },

  // End session
  endSession(chatId) {
    if (susunkata[chatId]) {
      clearTimeout(susunkata[chatId].waktu);
      const sessionData = susunkata[chatId];
      delete susunkata[chatId];
      return sessionData;
    }
    return null;
  },
};
