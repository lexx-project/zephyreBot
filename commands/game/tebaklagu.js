import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { addBalance, addExp, addGameStats } from "../../utils/database.js";
import config from "../../config/setting.js";
import {
  timeFormatter,
  logger,
  messageFormatter,
} from "../../utils/helpers.js";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Session storage
const tebaklaguSessions = new Map();

// Helper function to get random item
function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Helper function to generate random number
function randomNomor(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper function to create hint
function createHint(answer) {
  return answer.replace(/[b|c|d|f|g|h|j|k|l|m|n|p|q|r|s|t|v|w|x|y|z]/gi, "-");
}

export default {
  name: "tebaklagu",
  aliases: ["tebakmusik", "guesssong"],
  category: "game",
  description: "Game tebak lagu berdasarkan audio preview",
  usage: ".tebaklagu",
  cooldown: 3,

  async execute(sock, message, args) {
    try {
      const chatId = message.key.remoteJid;
      const userId = message.key.participant || message.key.remoteJid;
      const userName = message.pushName || "User";

      // Check if session already exists
      if (tebaklaguSessions.has(chatId)) {
        return await sock.sendMessage(
          chatId,
          {
            text: "❌ Masih ada sesi yang belum diselesaikan!",
          },
          { quoted: message }
        );
      }

      // Load questions from JSON file
      const questionsPath = path.join(
        __dirname,
        "../../lib/game/tebaklagu.json"
      );
      let questions;

      try {
        const questionsData = fs.readFileSync(questionsPath, "utf8");
        questions = JSON.parse(questionsData);
      } catch (error) {
        logger.error(`Failed to load tebaklagu questions: ${error.message}`);
        return await sock.sendMessage(
          chatId,
          {
            text: "❌ Gagal memuat data lagu. Silakan coba lagi nanti.",
          },
          { quoted: message }
        );
      }

      if (!questions || questions.length === 0) {
        return await sock.sendMessage(
          chatId,
          {
            text: "❌ Tidak ada data lagu yang tersedia.",
          },
          { quoted: message }
        );
      }

      // Pick random question
      const { soal, artis, jawaban } = pickRandom(questions);

      // Check if audio URL is valid
      if (
        jawaban.toLowerCase() ===
        "audio tidak ditemukan, silahkan request ulang!"
      ) {
        return await sock.sendMessage(
          chatId,
          {
            text: "❌ Terjadi kesalahan dalam memuat audio lagu.",
          },
          { quoted: message }
        );
      }

      const gameTimeout = 60; // 60 seconds
      const reward = randomNomor(1000, 2000);
      const hint = createHint(jawaban);

      // Create session
      const session = {
        soal: soal,
        jawaban: jawaban.toLowerCase(),
        artis: artis,
        reward: reward,
        startTime: Date.now(),
        timeout: setTimeout(async () => {
          if (tebaklaguSessions.has(chatId)) {
            await sock.sendMessage(chatId, {
              text: `⏰ *WAKTU HABIS!*\n\n🎵 *Jawaban:* ${jawaban}\n🎤 *Artis:* ${artis}\n\nCoba lagi dengan ${
                process.env.PREFIX || "."
              }tebaklagu!`,
            });
            tebaklaguSessions.delete(chatId);

            // Add game stats
            await addGameStats(userId, "tebaklagu", "timeout");

            logger.info(`[TEBAKLAGU] Game timeout in ${chatId}`);
          }
        }, gameTimeout * 1000),
      };

      tebaklaguSessions.set(chatId, session);

      // Send audio message
      try {
        await sock.sendMessage(
          chatId,
          {
            audio: { url: soal },
            mimetype: "audio/mpeg",
            ptt: true,
          },
          { quoted: message }
        );
      } catch (error) {
        logger.error(`Failed to send audio: ${error.message}`);
        tebaklaguSessions.delete(chatId);
        clearTimeout(session.timeout);
        return await sock.sendMessage(
          chatId,
          {
            text: "❌ Gagal mengirim audio lagu. Silakan coba lagi.",
          },
          { quoted: message }
        );
      }

      // Send game info
      const gameText =
        `🎵 *GAME TEBAK LAGU*\n\n` +
        `💡 *Petunjuk:* ${hint}\n` +
        `🎤 *Artis:* ${artis}\n` +
        `⏰ *Waktu:* ${gameTimeout} detik\n` +
        `💰 *Hadiah:* ${reward} balance + EXP\n\n` +
        `Ketik ${process.env.PREFIX || "."}nyerah untuk menyerah`;

      await sock.sendMessage(
        chatId,
        {
          text: gameText,
        },
        { quoted: message }
      );

      logger.info(`[TEBAKLAGU] Game started in ${chatId} by ${userName}`);
      logger.info(`[TEBAKLAGU] Answer: ${jawaban}`);
    } catch (error) {
      logger.error(`Error in tebaklagu command: ${error.message}`);
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: "❌ Terjadi kesalahan saat memulai game. Silakan coba lagi.",
        },
        { quoted: message }
      );
    }
  },

  async checkAnswer(sock, message, text) {
    try {
      const chatId = message.key.remoteJid;
      const userId = message.key.participant || message.key.remoteJid;
      const userName = message.pushName || "User";

      const session = tebaklaguSessions.get(chatId);
      if (!session) {
        return false; // No active session
      }

      const userAnswer = text.toLowerCase().trim();
      const correctAnswer = session.jawaban;

      // Check if answer is correct
      if (userAnswer === correctAnswer) {
        // Clear timeout
        clearTimeout(session.timeout);
        tebaklaguSessions.delete(chatId);

        // Calculate time taken
        const timeTaken = Math.round((Date.now() - session.startTime) / 1000);

        // Add rewards
        await addBalance(userId, session.reward);
        await addExp(userId, session.reward);
        await addGameStats(userId, "tebaklagu", "win");

        // Send success message
        const successText =
          `🎉 *JAWABAN BENAR!*\n\n` +
          `👤 *Pemain:* ${userName}\n` +
          `🎵 *Lagu:* ${session.jawaban}\n` +
          `🎤 *Artis:* ${session.artis}\n` +
          `⏱️ *Waktu:* ${timeTaken} detik\n` +
          `💰 *Hadiah:* +${session.reward} balance\n` +
          `⭐ *EXP:* +${session.reward}\n\n` +
          `Mainkan lagi dengan ${process.env.PREFIX || "."}tebaklagu!`;

        await sock.sendMessage(
          chatId,
          {
            text: successText,
          },
          { quoted: message }
        );

        logger.info(
          `[TEBAKLAGU] ${userName} answered correctly in ${chatId} (${timeTaken}s)`
        );
        return true; // Answer was processed
      }

      return false; // Wrong answer, continue processing
    } catch (error) {
      logger.error(`Error in tebaklagu checkAnswer: ${error.message}`);
      return false;
    }
  },

  getSession(chatId) {
    return tebaklaguSessions.get(chatId);
  },

  clearSession(chatId) {
    const session = tebaklaguSessions.get(chatId);
    if (session) {
      clearTimeout(session.timeout);
      tebaklaguSessions.delete(chatId);
      return true;
    }
    return false;
  },

  // Get all active sessions (for debugging)
  getAllSessions() {
    return Array.from(tebaklaguSessions.keys());
  },
};
