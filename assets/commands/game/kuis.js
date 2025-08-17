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
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global game sessions storage
const kuisSessions = new Map();
const gamewaktu = 60; // 60 seconds

// Helper function to pick random item from array
function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Helper function to generate random number
function randomNomor(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default {
  name: "kuis",
  aliases: ["quiz"],
  description:
    "Game kuis - jawab pertanyaan dengan benar untuk mendapat hadiah!",
  usage: `${config.prefix}kuis`,
  category: "game",
  cooldown: 5,
  ownerOnly: false,
  groupOnly: true,
  privateOnly: false,

  async execute(sock, m, args) {
    try {
      const chatId = m.key.remoteJid;
      const userId = m.key.participant || m.key.remoteJid;
      const userName = m.pushName || "User";

      // Check if there's already an active session
      if (kuisSessions.has(chatId)) {
        return await sock.sendMessage(
          chatId,
          {
            text: "⚠️ Masih ada sesi kuis yang belum diselesaikan!",
          },
          { quoted: m }
        );
      }

      // Load quiz data
      const kuisPath = path.join(__dirname, "../../lib/game/kuis.json");
      if (!fs.existsSync(kuisPath)) {
        return await sock.sendMessage(
          chatId,
          {
            text: "❌ File kuis tidak ditemukan! Hubungi admin untuk menambahkan soal kuis.",
          },
          { quoted: m }
        );
      }

      const kuisData = JSON.parse(fs.readFileSync(kuisPath, "utf8"));
      if (!kuisData || kuisData.length === 0) {
        return await sock.sendMessage(
          chatId,
          {
            text: "❌ Tidak ada soal kuis yang tersedia!",
          },
          { quoted: m }
        );
      }

      // Pick random question
      const { soal, jawaban } = pickRandom(kuisData);
      const hadiah = randomNomor(10, 20);

      // Log answer for debugging
      console.log(`[KUIS] Jawaban: ${jawaban}`);

      // Create hint by replacing consonants with dashes
      const petunjuk = jawaban.replace(
        /[b|c|d|f|g|h|j|k|l|m|n|p|q|r|s|t|v|w|x|y|z]/gi,
        "-"
      );

      // Send quiz question
      const quizMessage =
        `🧠 *GAME KUIS* 🧠\n\n` +
        `📝 *Soal:* ${soal}\n\n` +
        `💡 *Petunjuk:* ${petunjuk}\n` +
        `⏰ *Waktu:* ${gamewaktu} detik\n` +
        `💰 *Hadiah:* ${hadiah} koin\n\n` +
        `Ketik \`${config.prefix}nyerah\` untuk menyerah`;

      await sock.sendMessage(chatId, { text: quizMessage }, { quoted: m });

      // Create game session
      const timeout = setTimeout(async () => {
        if (kuisSessions.has(chatId)) {
          kuisSessions.delete(chatId);
          await sock.sendMessage(chatId, {
            text:
              `⏰ *WAKTU HABIS!*\n\n` +
              `❓ *Soal:* ${soal}\n` +
              `✅ *Jawaban:* ${jawaban}\n\n` +
              `Coba lagi dengan ${config.prefix}kuis`,
          });
        }
      }, gamewaktu * 1000);

      kuisSessions.set(chatId, {
        soal: soal,
        jawaban: jawaban.toLowerCase().trim(),
        hadiah: hadiah,
        timeout: timeout,
        startTime: Date.now(),
        userId: userId,
      });

      // Add game stats
      await addGameStats(userId, "kuis", "started");

      logger.info(`[KUIS] Game started in ${chatId} by ${userName}`);
    } catch (error) {
      logger.error(`[KUIS] Error: ${error.message}`);
      await sock.sendMessage(
        m.key.remoteJid,
        {
          text: "❌ Terjadi kesalahan saat memulai game kuis!",
        },
        { quoted: m }
      );
    }
  },

  // Handle quiz answers
  async handleAnswer(sock, m, userAnswer) {
    try {
      const chatId = m.key.remoteJid;
      const userId = m.key.participant || m.key.remoteJid;
      const userName = m.pushName || "User";

      const session = kuisSessions.get(chatId);
      if (!session) return false;

      const cleanAnswer = userAnswer.toLowerCase().trim();
      const correctAnswer = session.jawaban;

      if (cleanAnswer === correctAnswer) {
        // Correct answer
        clearTimeout(session.timeout);
        kuisSessions.delete(chatId);

        const timeTaken = Math.round((Date.now() - session.startTime) / 1000);
        const bonus = timeTaken < 30 ? 5 : 0; // Bonus for quick answer
        const totalReward = session.hadiah + bonus;

        // Update user balance
        await updateBalance(userId, totalReward);
        const newBalance = await getBalance(userId);

        // Add EXP reward
        const settings = getSettings();
        const expReward = settings.exp_rewards.kuis;
        const expResult = addExp(userId, expReward);

        // Add game stats
        await addGameStats(userId, "kuis", "won");

        let winMessage =
          `🎉 *JAWABAN BENAR!* 🎉\n\n` +
          `👤 *Penjawab:* ${userName}\n` +
          `✅ *Jawaban:* ${correctAnswer}\n` +
          `⏱️ *Waktu:* ${timeTaken} detik\n` +
          `💰 *Hadiah:* ${session.hadiah} koin` +
          (bonus > 0 ? `\n🚀 *Bonus cepat:* ${bonus} koin` : "") +
          `\n⭐ *EXP:* +${expReward} EXP` +
          `\n💳 *Saldo:* ${newBalance} koin`;

        if (expResult.leveledUp) {
          winMessage += `\n🎉 *LEVEL UP!* Level ${expResult.newLevel}`;
        }

        await sock.sendMessage(chatId, { text: winMessage });

        logger.info(
          `[KUIS] ${userName} won in ${chatId} with answer: ${correctAnswer}`
        );
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`[KUIS] Handle answer error: ${error.message}`);
      return false;
    }
  },

  // Get current session
  getSession(chatId) {
    return kuisSessions.get(chatId);
  },

  // End session (for surrender)
  endSession(chatId) {
    const session = kuisSessions.get(chatId);
    if (session) {
      clearTimeout(session.timeout);
      kuisSessions.delete(chatId);
      return session;
    }
    return null;
  },
};
