import config from "../../config/setting.js";
import { logger } from "../../utils/helpers.js";
import {
  updateBalance,
  getBalance,
  addGameStats,
  getSettings,
  addExp,
} from "../../utils/database.js";
import { genMath, modes } from "../../lib/game/math.js";

// Global game sessions storage
const mathSessions = new Map();

export default {
  name: "math",
  aliases: ["kuismath"],
  description:
    "Game kuis matematika - jawab soal dengan benar untuk mendapat hadiah!",
  usage: `${config.prefix}math <mode>`,
  category: "game",
  cooldown: 5,
  groupOnly: true,

  async execute(sock, m, args) {
    try {
      const chatId = m.key.remoteJid;
      const userId = m.key.participant || m.key.remoteJid;
      const userName = m.pushName || "User";
      const mode = args[0]?.toLowerCase();

      if (!mode) {
        let modeList = `*MODE TERSEDIA*\n\n`;
        modeList += `• ${Object.keys(modes).join("\n• ")}\n\n`;
        modeList += `*Contoh:* ${this.usage.replace("<mode>", "easy")}`;
        return await sock.sendMessage(
          chatId,
          { text: modeList },
          { quoted: m }
        );
      }

      if (!modes[mode]) {
        return await sock.sendMessage(
          chatId,
          {
            text: `❌ Mode \`${mode}\` tidak ditemukan. Silakan pilih mode yang valid.`,
          },
          { quoted: m }
        );
      }

      if (mathSessions.has(chatId)) {
        return await sock.sendMessage(
          chatId,
          {
            text: "⚠️ Masih ada sesi kuis matematika yang belum diselesaikan!",
          },
          { quoted: m }
        );
      }

      const { soal, jawaban, waktu, hadiah } = await genMath(mode);

      console.log(`[MATH] Jawaban: ${jawaban}`);
      logger.info(
        `[MATH] Game started in ${chatId} by ${userName}. Mode: ${mode}, Answer: ${jawaban}`
      );

      const gameMessage =
        `🔢 *GAME KUIS MATH* 🔢\n\n` +
        `Berapa hasil dari *${soal}*?\n\n` +
        `Mode: *${mode}*\n` +
        `Waktu: *${waktu / 1000} detik*\n` +
        `Hadiah: *~${hadiah} koin*\n\n` +
        `Ketik jawabanmu atau ketik \`${config.prefix}nyerah\` untuk menyerah.`;

      await sock.sendMessage(chatId, { text: gameMessage }, { quoted: m });

      const timeout = setTimeout(async () => {
        if (mathSessions.has(chatId)) {
          await sock.sendMessage(chatId, {
            text:
              `⏰ *WAKTU HABIS!*\n\n` +
              `Soal: ${soal}\n` +
              `Jawaban yang benar adalah: *${jawaban}*`,
          });
          mathSessions.delete(chatId);
        }
      }, waktu);

      mathSessions.set(chatId, {
        soal,
        jawaban: String(jawaban), // Ensure answer is a string for comparison
        hadiah,
        timeout,
        startTime: Date.now(),
        userId,
      });
    } catch (error) {
      logger.error(`[MATH] Error: ${error.message}`);
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "❌ Terjadi kesalahan saat memulai game kuis matematika!" },
        { quoted: m }
      );
    }
  },

  async handleAnswer(sock, m, userAnswer) {
    try {
      const chatId = m.key.remoteJid;
      const userId = m.key.participant || m.key.remoteJid;
      const userName = m.pushName || "User";

      const session = mathSessions.get(chatId);
      if (!session || isNaN(userAnswer)) return false;

      if (userAnswer.trim() === session.jawaban) {
        clearTimeout(session.timeout);
        const timeTaken = Math.round((Date.now() - session.startTime) / 1000);
        const totalReward = session.hadiah;
        const newBalance = await updateBalance(
          userId,
          totalReward,
          "Math game reward"
        );
        const settings = getSettings();
        const expReward = settings.exp_rewards.math || 15;
        const expResult = addExp(userId, expReward);
        await addGameStats(userId);

        let winMessage =
          `🎉 *JAWABAN BENAR!* 🎉\n\n` +
          `👤 *Penjawab:* ${userName}\n` +
          `✅ *Jawaban:* ${session.jawaban}\n` +
          `⏱️ *Waktu:* ${timeTaken} detik\n` +
          `💰 *Hadiah:* ${totalReward} koin\n` +
          `⭐ *EXP:* +${expReward} EXP\n` +
          `💳 *Saldo:* ${newBalance} koin`;
        if (expResult.leveledUp) {
          winMessage += `\n🎉 *LEVEL UP!* Level ${expResult.newLevel}`;
        }
        await sock.sendMessage(chatId, { text: winMessage }, { quoted: m });
        logger.info(
          `[MATH] ${userName} won in ${chatId} with answer: ${session.jawaban}`
        );
        mathSessions.delete(chatId);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`[MATH] Handle answer error: ${error.message}`);
      return false;
    }
  },

  getSession(chatId) {
    return mathSessions.get(chatId);
  },

  endSession(chatId) {
    const session = mathSessions.get(chatId);
    if (session) {
      clearTimeout(session.timeout);
      mathSessions.delete(chatId);
      return session;
    }
    return null;
  },
};
