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

// Storage untuk session game
const tebakbendera = {};

// Fungsi untuk memilih random
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Fungsi untuk generate angka random
function randomNomor(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default {
  name: "tebakbendera",
  description: "Game tebak bendera negara",
  usage: `${config.prefix}tebakbendera`,
  category: "game",
  cooldown: 3,
  ownerOnly: false,
  groupOnly: false,
  privateOnly: false,
  aliases: ["tb", "bendera"],

  async execute(sock, message, args) {
    try {
      const sender = message.key.remoteJid;
      const senderNumber = sender.split("@")[0];
      const chatId = sender;

      // Cek apakah sudah ada session aktif
      if (tebakbendera[chatId]) {
        await sock.sendMessage(
          sender,
          {
            text: "❌ Masih ada sesi yang belum diselesaikan!\n\nKetik `.nyerah` untuk menyerah atau jawab soal yang sedang berlangsung.",
          },
          { quoted: message }
        );
        return;
      }

      // Load data soal
      const questionsPath = path.join(
        __dirname,
        "../../lib/game/tebakbendera.json"
      );
      const questionsData = JSON.parse(fs.readFileSync(questionsPath, "utf8"));

      // Pilih soal random
      const { soal, jawaban } = pickRandom(questionsData);

      // Log jawaban untuk debugging
      console.log("Jawaban: " + jawaban);
      logger.info(
        `🏁 Tebak Bendera dimulai untuk ${senderNumber}, jawaban: ${jawaban}`
      );

      // Generate hint (ganti konsonan dengan dash)
      const hint = jawaban.replace(
        /[b|c|d|f|g|h|j|k|l|m|n|p|q|r|s|t|v|w|x|y|z]/gi,
        "-"
      );

      // Calculate reward
      const reward = randomNomor(10, 20);

      // Game duration (60 detik)
      const gamewaktu = 60;

      // Send game text
      const gameText = `*TEBAK BENDERA*

Soal: ${soal}
Petunjuk: ${hint}
Hadiah: ${reward} koin
Waktu: ${gamewaktu} detik

💡 Ketik jawabanmu atau \`.nyerah\` untuk menyerah`;

      await sock.sendMessage(
        sender,
        {
          text: gameText,
        },
        { quoted: message }
      );

      // Set session
      tebakbendera[chatId] = {
        soal: soal,
        jawaban: jawaban.toLowerCase(),
        hadiah: reward,
        waktu: setTimeout(function () {
          if (tebakbendera[chatId]) {
            sock.sendMessage(sender, {
              text: `⏰ *WAKTU HABIS!*\n\nJawaban dari soal:\n${soal}\n\nAdalah: *${jawaban}*\n\n_Coba lagi dengan_ \`${config.prefix}tebakbendera\``,
            });
            delete tebakbendera[chatId];
          }
        }, gamewaktu * 1000),
      };
    } catch (error) {
      logger.error(`❌ Error di tebakbendera: ${error.message}`);
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: "❌ Terjadi kesalahan saat memulai game tebak bendera.",
        },
        { quoted: message }
      );
    }
  },

  // Handle answer from user
  async handleAnswer(sock, message, userAnswer) {
    const chatId = message.key.remoteJid;
    const senderNumber = chatId.split("@")[0];
    const session = tebakbendera[chatId];

    if (!session) return false; // No active session

    const correctAnswer = session.jawaban.toLowerCase();
    const answer = userAnswer.toLowerCase().trim();

    if (answer === correctAnswer) {
      const reward = session.hadiah;
      clearTimeout(session.waktu);
      delete tebakbendera[chatId];

      // Update user balance
      const userId = message.key.participant || message.key.remoteJid;
      const newBalance = updateBalance(userId, reward, "Tebak Bendera reward");

      // Add EXP reward
      const settings = getSettings();
      const expReward = settings.exp_rewards.tebakbendera;
      const expResult = addExp(userId, expReward);

      // Add game stats
      addGameStats(userId);

      let responseText = `🎉 *BENAR!*\n\n`;
      responseText += `Jawaban: *${session.jawaban}*\n`;
      responseText += `💰 Kamu mendapat *${reward} koin*\n`;
      responseText += `⭐ *EXP:* +${expReward} EXP\n`;
      responseText += `💳 *Saldo:* ${newBalance} koin\n`;

      if (expResult.leveledUp) {
        responseText += `🎉 *LEVEL UP!* Level ${expResult.newLevel}\n`;
      }

      responseText += `\n_Coba lagi dengan_ \`${config.prefix}tebakbendera\``;

      await sock.sendMessage(
        chatId,
        {
          text: responseText,
        },
        { quoted: message }
      );

      logger.info(
        `🏁 ${senderNumber} berhasil menjawab tebak bendera: ${session.jawaban}`
      );
      return true;
    }

    return false; // Wrong answer, don't end session
  },

  // Check answer function
  checkAnswer(chatId, userAnswer) {
    const session = tebakbendera[chatId];
    if (!session) return null;

    const correctAnswer = session.jawaban.toLowerCase();
    const answer = userAnswer.toLowerCase().trim();

    if (answer === correctAnswer) {
      const reward = session.hadiah;
      clearTimeout(session.waktu);
      delete tebakbendera[chatId];
      return {
        correct: true,
        reward: reward,
        answer: session.jawaban,
      };
    }

    return { correct: false };
  },

  // Get active sessions
  getSessions() {
    return tebakbendera;
  },

  // Get specific session
  getSession(chatId) {
    return tebakbendera[chatId] || null;
  },

  // End session
  endSession(chatId) {
    if (tebakbendera[chatId]) {
      clearTimeout(tebakbendera[chatId].waktu);
      const sessionData = tebakbendera[chatId];
      delete tebakbendera[chatId];
      return sessionData;
    }
    return null;
  },
};
