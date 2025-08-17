import config from "../../config/setting.js";
import {
  timeFormatter,
  logger,
  messageFormatter,
} from "../../utils/helpers.js";
import { addExp, addBalance } from "../../utils/database.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Game sessions storage
let siapakahaku = {};

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
  name: "siapakahaku",
  description: "Game tebak siapakah aku",
  usage: `${config.prefix}siapakahaku`,
  category: "game",
  cooldown: 3,
  ownerOnly: false,
  groupOnly: true,
  privateOnly: false,

  async execute(sock, message, args) {
    try {
      const sender = message.key.remoteJid;
      const senderNumber = sender.split("@")[0];
      const from = message.key.remoteJid;

      // Check if there's already an active session
      if (from in siapakahaku) {
        return sock.sendMessage(
          sender,
          {
            text: messageFormatter.error(
              "❌ Masih ada sesi yang belum diselesaikan!"
            ),
          },
          { quoted: message }
        );
      }

      // Load game data
      const gameDataPath = path.join(
        __dirname,
        "../../lib/game/siapakahaku.json"
      );

      if (!fs.existsSync(gameDataPath)) {
        return sock.sendMessage(
          sender,
          {
            text: messageFormatter.error(
              "❌ File game siapakahaku tidak ditemukan!"
            ),
          },
          { quoted: message }
        );
      }

      const gameData = JSON.parse(fs.readFileSync(gameDataPath, "utf8"));
      const { soal, jawaban } = pickRandom(gameData);

      console.log("Jawaban: " + jawaban);

      // Create hint by replacing consonants with dashes
      const petunjuk = jawaban.replace(
        /[b|c|d|f|g|h|j|k|l|m|n|p|q|r|s|t|v|w|x|y|z]/gi,
        "-"
      );

      const gameText =
        `🎯 *GAME SIAPAKAH AKU*\n\n` +
        `📝 *Soal:* ${soal}\n\n` +
        `💡 *Petunjuk:* ${petunjuk}\n` +
        `⏰ *Waktu:* ${gamewaktu} detik\n\n` +
        `💰 *Hadiah:* ${randomNomor(10, 20)} exp + saldo\n\n` +
        `Ketik \`${config.prefix}nyerah\` untuk menyerah`;

      await sock.sendMessage(
        sender,
        {
          text: gameText,
        },
        { quoted: message }
      );

      // Store game session
      const hadiah = randomNomor(1000, 2000);
      siapakahaku[from] = {
        soal: soal,
        jawaban: jawaban.toLowerCase(),
        hadiah: hadiah,
        waktu: setTimeout(async () => {
          if (siapakahaku[from]) {
            await sock.sendMessage(sender, {
              text:
                `⏰ *WAKTU HABIS!*\n\n` +
                `📝 *Soal:* ${soal}\n` +
                `✅ *Jawaban:* ${jawaban}`,
            });
            delete siapakahaku[from];
          }
        }, gamewaktu * 1000),
      };

      logger.info(`🎯 Game siapakahaku dimulai untuk ${senderNumber}`);
    } catch (error) {
      logger.error(`Error saat memulai game siapakahaku: ${error.message}`);
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: messageFormatter.error(
            "❌ Terjadi kesalahan saat memulai game"
          ),
        },
        { quoted: message }
      );
    }
  },

  // Function to check answer (called from message handler)
  checkAnswer: async (sock, message, userAnswer) => {
    const from = message.key.remoteJid;
    const senderId = message.key.remoteJid.endsWith("@g.us")
      ? message.key.participant
      : message.key.remoteJid;

    if (from in siapakahaku) {
      const session = siapakahaku[from];

      if (userAnswer.toLowerCase() === session.jawaban) {
        // Correct answer
        clearTimeout(session.waktu);

        // Add rewards
        await addExp(senderId, session.hadiah);
        await addBalance(senderId, session.hadiah);

        await sock.sendMessage(
          from,
          {
            text:
              `🎉 *JAWABAN BENAR!*\n\n` +
              `✅ *Jawaban:* ${session.jawaban}\n` +
              `🎁 *Hadiah:* +${session.hadiah} exp & saldo\n\n` +
              `Selamat! 🥳`,
          },
          { quoted: message }
        );

        delete siapakahaku[from];
        return true;
      }
    }
    return false;
  },

  // Function to surrender (called from nyerah command)
  surrender: async (sock, message) => {
    const from = message.key.remoteJid;

    if (from in siapakahaku) {
      const session = siapakahaku[from];
      clearTimeout(session.waktu);

      await sock.sendMessage(
        from,
        {
          text:
            `🏳️ *MENYERAH!*\n\n` +
            `📝 *Soal:* ${session.soal}\n` +
            `✅ *Jawaban:* ${session.jawaban}`,
        },
        { quoted: message }
      );

      delete siapakahaku[from];
      return true;
    }
    return false;
  },

  // Export game sessions for external access
  getSessions: () => siapakahaku,
};

// Export for use in message handler
export { siapakahaku };
