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
const tebakgambar = {};

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
  name: "tebakgambar",
  description: "Game tebak gambar berdasarkan petunjuk",
  category: "game",
  usage: ".tebakgambar",
  cooldown: 3,

  async execute(sock, m, args) {
    try {
      const chatId = m.key.remoteJid;
      const userId = m.key.participant || m.key.remoteJid;
      const userName = m.pushName || "User";

      // Check if there's already an active session
      if (tebakgambar[chatId]) {
        await sock.sendMessage(
          chatId,
          {
            text: "❌ Masih ada sesi yang belum diselesaikan!",
          },
          { quoted: m }
        );
        return;
      }

      // Load questions from JSON file
      const questionsPath = path.join(
        __dirname,
        "../../lib/game/tebakgambar.json"
      );
      const questionsData = JSON.parse(fs.readFileSync(questionsPath, "utf8"));

      // Pick random question
      const { img, jawaban, deskripsi } = pickRandom(questionsData);

      console.log(`[TEBAK GAMBAR] Jawaban: ${jawaban}`);
      logger.info(
        `[TEBAK GAMBAR] ${userName} started game in ${chatId}. Answer: ${jawaban}`
      );

      // Create hint by replacing consonants with dashes
      const petunjuk = jawaban.replace(
        /[b|c|d|f|g|h|j|k|l|m|n|p|q|r|s|t|v|w|x|y|z]/gi,
        "-"
      );

      const hadiah = randomNomor(10, 20);

      const teks1 =
        `🖼️ *GAME TEBAK GAMBAR* 🖼️

` +
        `📝 *Petunjuk:* ${petunjuk}
` +
        `💡 *Deskripsi:* ${deskripsi}
` +
        `⏰ *Waktu:* ${gamewaktu} detik
` +
        `🎁 *Hadiah:* ${hadiah} koin

` +
        `💡 Ketik *.nyerah* untuk menyerah`;

      // Send image with caption
      await sock.sendMessage(
        chatId,
        {
          image: { url: img },
          caption: teks1,
        },
        { quoted: m }
      );

      // Store game session
      tebakgambar[chatId] = {
        soal: img,
        jawaban: jawaban.toLowerCase(),
        hadiah: hadiah,
        startTime: Date.now(),
        waktu: setTimeout(async () => {
          if (tebakgambar[chatId]) {
            await sock.sendMessage(chatId, {
              text:
                `⏰ *WAKTU HABIS!*\n\n` +
                `✅ *Jawaban yang benar:* ${tebakgambar[chatId].jawaban}\n` +
                `🖼️ *Gambar:* ${tebakgambar[chatId].soal}`,
            });

            logger.info(
              `[TEBAK GAMBAR] Game timeout in ${chatId}. Answer was: ${tebakgambar[chatId].jawaban}`
            );
            delete tebakgambar[chatId];
          }
        }, gamewaktu * 1000),
      };
    } catch (error) {
      logger.error(`[TEBAK GAMBAR] Error: ${error.message}`);
      await sock.sendMessage(
        m.key.remoteJid,
        {
          text: "❌ Terjadi kesalahan saat memulai game tebak gambar!",
        },
        { quoted: m }
      );
    }
  },

  // Handle tebak gambar answers
  async handleAnswer(sock, m, userAnswer) {
    try {
      const chatId = m.key.remoteJid;
      const userId = m.key.participant || m.key.remoteJid;
      const userName = m.pushName || "User";

      const session = tebakgambar[chatId];
      if (!session) return false;

      const answer = userAnswer.toLowerCase().trim();
      const correctAnswer = session.jawaban;

      if (answer === correctAnswer) {
        // Clear timeout
        clearTimeout(session.waktu);

        // Calculate time taken
        const timeTaken = Math.floor((Date.now() - session.startTime) / 1000);

        // Award points (bonus for quick answers)
        let finalHadiah = session.hadiah;
        if (timeTaken <= 10) {
          finalHadiah += 5; // Bonus for very quick answer
        } else if (timeTaken <= 30) {
          finalHadiah += 2; // Small bonus for quick answer
        }

        // Update user balance
        const newBalance = updateBalance(
          userId,
          finalHadiah,
          "Tebak Gambar reward"
        );

        // Add EXP reward
        const settings = getSettings();
        const expReward = settings.exp_rewards.tebakgambar;
        const expResult = addExp(userId, expReward);

        // Add game stats
        addGameStats(userId);

        let responseText = `🎉 *SELAMAT!* 🎉\n\n`;
        responseText += `👤 *Penjawab:* ${userName}\n`;
        responseText += `✅ *Jawaban:* ${correctAnswer}\n`;
        responseText += `⏱️ *Waktu:* ${timeTaken} detik\n`;
        responseText += `🎁 *Hadiah:* ${finalHadiah} koin\n`;
        responseText += `⭐ *EXP:* +${expReward} EXP\n`;
        responseText += `💳 *Saldo:* ${newBalance} koin\n`;

        if (expResult.leveledUp) {
          responseText += `🎉 *LEVEL UP!* Level ${expResult.newLevel}\n`;
        }

        responseText += `\n🏆 Jawaban benar! Kamu mendapat ${finalHadiah} koin!`;

        await sock.sendMessage(
          chatId,
          {
            text: responseText,
          },
          { quoted: m }
        );

        logger.info(
          `[TEBAK GAMBAR] ${userName} answered correctly in ${chatId}. Time: ${timeTaken}s, Reward: ${finalHadiah}`
        );

        delete tebakgambar[chatId];
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`[TEBAK GAMBAR] Handle answer error: ${error.message}`);
      return false;
    }
  },

  // Get active session
  getSession(chatId) {
    return tebakgambar[chatId];
  },

  // End session (for surrender)
  endSession(chatId) {
    if (tebakgambar[chatId]) {
      clearTimeout(tebakgambar[chatId].waktu);
      const session = tebakgambar[chatId];
      delete tebakgambar[chatId];
      return session;
    }
    return null;
  },
};
