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
const family100Sessions = new Map();
const gameTimeout = 60; // 60 seconds

// Helper function to pick random item from array
function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Helper function to generate random number
function randomNomor(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper function to clean answers
function cleanAnswer(answer) {
  let cleaned = answer.includes("/") ? answer.split("/")[0] : answer;
  cleaned = cleaned.startsWith(" ") ? cleaned.replace(" ", "") : cleaned;
  cleaned = cleaned.endsWith(" ")
    ? cleaned.replace(cleaned.slice(-1), "")
    : cleaned;
  return cleaned.toLowerCase().trim();
}

export default {
  name: "family100",
  aliases: ["f100"],
  description:
    "Game tebak kata Family 100 - tebak semua jawaban yang tersedia!",
  usage: `${config.prefix}family100 atau ${config.prefix}f100`,
  category: "game",
  cooldown: 5,
  ownerOnly: false,
  groupOnly: true,
  privateOnly: false,

  async execute(sock, message, args) {
    try {
      const chatId = message.key.remoteJid;
      const senderNumber = message.key.remoteJid.split("@")[0];

      // Check if there's already an active game in this chat
      if (family100Sessions.has(chatId)) {
        await sock.sendMessage(
          chatId,
          {
            text: "❌ Masih ada game Family 100 yang sedang berlangsung di grup ini!\nSelesaikan game yang sedang berjalan terlebih dahulu.",
          },
          { quoted: message }
        );
        return;
      }

      // Load family100 questions
      const family100Path = path.join(
        __dirname,
        "../../lib/game/family100.json"
      );

      if (!fs.existsSync(family100Path)) {
        await sock.sendMessage(
          chatId,
          {
            text: "❌ Database game Family 100 tidak ditemukan!",
          },
          { quoted: message }
        );
        return;
      }

      const family100Data = JSON.parse(fs.readFileSync(family100Path, "utf8"));
      const { soal, jawaban } = pickRandom(family100Data);

      // Clean and prepare answers
      const cleanedAnswers = jawaban.map((answer) => cleanAnswer(answer));

      console.log("Jawaban:", jawaban); // For debugging

      // Create game session
      const gameSession = {
        soal: soal,
        originalAnswers: jawaban,
        answers: cleanedAnswers,
        foundAnswers: [],
        // Mengatur hadiah per jawaban agar berkisar 500
        hadiah: randomNomor(450, 550), // Hadiah per jawaban
        startTime: Date.now(),
        timeout: setTimeout(async () => {
          if (family100Sessions.has(chatId)) {
            const session = family100Sessions.get(chatId);
            const remainingAnswers = session.originalAnswers.filter(
              (_, index) => !session.foundAnswers.includes(index)
            );

            let timeoutText = `⏰ *WAKTU HABIS!*\n\n`;
            timeoutText += `📝 *Soal:* ${session.soal}\n\n`;
            timeoutText += `❌ *Jawaban yang belum terjawab:*\n`;
            remainingAnswers.forEach((answer, index) => {
              timeoutText += `${index + 1}. ${answer}\n`;
            });
            timeoutText += `\n🎯 *Jawaban yang berhasil ditebak:* ${session.foundAnswers.length}/${session.originalAnswers.length}`;

            await sock.sendMessage(chatId, {
              text: timeoutText,
            });
            family100Sessions.delete(chatId);
          }
        }, gameTimeout * 1000),
      };

      // Store game session
      family100Sessions.set(chatId, gameSession);

      // Send game start message
      const gameText =
        `🎮 *GAME FAMILY 100*\n\n` +
        `📝 *Soal:* ${soal}\n` +
        `🎯 *Total jawaban:* ${jawaban.length}\n` +
        `⏰ *Waktu:* ${gameTimeout} detik\n` +
        `💰 *Hadiah per jawaban:* ${gameSession.hadiah} poin\n\n` + // Mengubah teks untuk mencerminkan hadiah per jawaban
        `💡 *Cara bermain:*\n` +
        `• Ketik jawaban langsung tanpa command\n` +
        `• Jawaban tidak case sensitive\n` +
        `• Game berakhir jika semua jawaban ditemukan atau waktu habis\n\n` +
        `🚀 *Selamat bermain!*`;

      await sock.sendMessage(
        chatId,
        {
          text: gameText,
        },
        { quoted: message }
      );

      logger.info(
        `🎮 Game Family 100 dimulai di ${chatId} oleh ${senderNumber}`
      );
    } catch (error) {
      logger.error("❌ Error saat memulai game Family 100:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: "❌ Terjadi kesalahan saat memulai game Family 100!",
        },
        { quoted: message }
      );
    }
  },

  // Function to handle game answers (to be called from main message handler)
  async handleAnswer(sock, message, text) {
    const chatId = message.key.remoteJid;
    const senderNumber = message.key.remoteJid.split("@")[0];

    if (!family100Sessions.has(chatId)) return false;

    const session = family100Sessions.get(chatId);
    const userAnswer = cleanAnswer(text);

    // Check if answer matches any of the correct answers
    const answerIndex = session.answers.findIndex(
      (answer) =>
        answer === userAnswer &&
        !session.foundAnswers.includes(session.answers.indexOf(answer))
    );

    if (answerIndex !== -1) {
      // Correct answer found
      session.foundAnswers.push(answerIndex);

      // Get user ID and reward settings
      const userId = message.key.participant || message.key.remoteJid;
      const settings = getSettings(); // Tetap ambil settings untuk exp_rewards

      // Menggunakan nilai 'hadiah' dari sesi game sebagai reward per jawaban
      const reward = session.hadiah;

      // Add reward to user balance
      const newBalance = updateBalance(
        userId,
        reward,
        "Family 100 correct answer"
      );

      // Add EXP reward
      const expReward = settings.exp_rewards.family100;
      const expResult = addExp(userId, expReward);

      const correctAnswer = session.originalAnswers[answerIndex];
      let responseText = `✅ *BENAR!*\n\n`;
      responseText += `👤 *Dijawab oleh:* @${senderNumber}\n`;
      responseText += `💡 *Jawaban:* ${correctAnswer}\n`;
      responseText += `💰 *Reward:* +${reward} saldo\n`;
      responseText += `⭐ *EXP:* +${expReward} EXP\n`;
      responseText += `💳 *Saldo kamu:* ${newBalance}\n`;

      if (expResult.leveledUp) {
        responseText += `🎉 *LEVEL UP!* Level ${expResult.newLevel}\n`;
      }

      responseText += `🎯 *Progress:* ${session.foundAnswers.length}/${session.originalAnswers.length}\n\n`;

      // Check if all answers found
      if (session.foundAnswers.length === session.originalAnswers.length) {
        // Add game completion bonus
        // Bonus penyelesaian adalah 10x dari hadiah per jawaban
        const completionBonus = session.hadiah * 10;
        const finalBalance = updateBalance(
          userId,
          completionBonus,
          "Family 100 completion bonus"
        );
        addGameStats(userId);

        responseText += `� *SELAMAT! SEMUA JAWABAN BERHASIL DITEMUKAN!*\n`;
        responseText += `🎁 *Bonus penyelesaian:* +${completionBonus} saldo\n`;
        responseText += `💳 *Total saldo kamu:* ${finalBalance}\n`;
        responseText += `⏱️ *Waktu bermain:* ${Math.round(
          (Date.now() - session.startTime) / 1000
        )} detik`;

        // Clear timeout and remove session
        clearTimeout(session.timeout);
        family100Sessions.delete(chatId);

        logger.info(
          `🏆 Game Family 100 selesai di ${chatId} - semua jawaban ditemukan`
        );
      } else {
        const remaining =
          session.originalAnswers.length - session.foundAnswers.length;
        responseText += `🔍 *Sisa ${remaining} jawaban lagi!*`;
      }

      await sock.sendMessage(
        chatId,
        {
          text: responseText,
          mentions: [message.key.participant || message.key.remoteJid],
        },
        { quoted: message }
      );

      return true;
    }

    return false;
  },

  // Function to stop active game
  async stopGame(chatId) {
    if (family100Sessions.has(chatId)) {
      const session = family100Sessions.get(chatId);
      clearTimeout(session.timeout);
      family100Sessions.delete(chatId);
      return true;
    }
    return false;
  },

  // Function to get active sessions (for debugging)
  getActiveSessions() {
    return family100Sessions;
  },
};
