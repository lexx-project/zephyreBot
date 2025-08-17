import config from "../../config/setting.js";
import { logger, messageFormatter } from "../../utils/helpers.js";
import { addGameStats } from "../../utils/database.js";

export default {
  name: "nyerah",
  aliases: ["surrender", "give up"],
  description: "Menyerah dari game yang sedang berlangsung",
  usage: `${config.prefix}nyerah`,
  category: "main",
  cooldown: 3,
  ownerOnly: false,
  groupOnly: true,
  privateOnly: false,

  async execute(sock, m, args) {
    try {
      const chatId = m.key.remoteJid;
      const userId = m.key.participant || m.key.remoteJid;
      const userName = m.pushName || "User";

      let gameEnded = false;
      let gameType = "";
      let gameData = null;

      // Import commands dynamically
      let kuisCommand,
        family100Command,
        tebakgambarCommand,
        susunkataCommand,
        tebakbenderaCommand,
        siapakahakuCommand,
        slotCommand,
        tebaklirikCommand,
        tebaklaguCommand;

      try {
        const kuisModule = await import("../game/kuis.js");
        kuisCommand = kuisModule.default;
      } catch (e) {
        // kuis command not found
      }

      try {
        const family100Module = await import("../game/family100.js");
        family100Command = family100Module.default;
      } catch (e) {
        // family100 command not found
      }

      try {
        const tebakgambarModule = await import("../game/tebakgambar.js");
        tebakgambarCommand = tebakgambarModule.default;
      } catch (e) {
        // tebakgambar command not found
      }

      try {
        const susunkataModule = await import("../game/susunkata.js");
        susunkataCommand = susunkataModule.default;
      } catch (e) {
        // susunkata command not found
      }

      try {
        const tebakbenderaModule = await import("../game/tebakbendera.js");
        tebakbenderaCommand = tebakbenderaModule.default;
      } catch (e) {
        // tebakbendera command not found
      }

      try {
        const siapakahakuModule = await import("../game/siapakahaku.js");
        siapakahakuCommand = siapakahakuModule.default;
      } catch (e) {
        // siapakahaku command not found
      }

      try {
        const slotModule = await import("../game/slot.js");
        slotCommand = slotModule.default;
      } catch (e) {
        // slot command not found
      }

      try {
        const tebaklirikModule = await import("../game/tebaklirik.js");
        tebaklirikCommand = tebaklirikModule.default;
      } catch (e) {
        // tebaklirik command not found
      }

      try {
        const tebaklaguModule = await import("../game/tebaklagu.js");
        tebaklaguCommand = tebaklaguModule.default;
      } catch (e) {
        // tebaklagu command not found
      }

      // Check for active kuis session
      if (kuisCommand && kuisCommand.getSession) {
        const kuisSession = kuisCommand.getSession(chatId);
        if (kuisSession) {
          gameData = kuisCommand.endSession(chatId);
          gameType = "kuis";
          gameEnded = true;
        }
      }

      // Check for active family100 session
      if (!gameEnded && family100Command && family100Command.getSession) {
        const family100Session = family100Command.getSession(chatId);
        if (family100Session) {
          gameData = family100Command.endSession(chatId);
          gameType = "family100";
          gameEnded = true;
        }
      }

      // Check for active tebakgambar session
      if (!gameEnded && tebakgambarCommand && tebakgambarCommand.getSession) {
        const tebakgambarSession = tebakgambarCommand.getSession(chatId);
        if (tebakgambarSession) {
          gameData = tebakgambarCommand.endSession(chatId);
          gameType = "tebakgambar";
          gameEnded = true;
        }
      }

      // Check for active susunkata session
      if (!gameEnded && susunkataCommand && susunkataCommand.getSession) {
        const susunkataSession = susunkataCommand.getSession(chatId);
        if (susunkataSession) {
          gameData = susunkataCommand.endSession(chatId);
          gameType = "susunkata";
          gameEnded = true;
        }
      }

      // Check for active tebakbendera session
      if (!gameEnded && tebakbenderaCommand && tebakbenderaCommand.getSession) {
        const tebakbenderaSession = tebakbenderaCommand.getSession(chatId);
        if (tebakbenderaSession) {
          gameData = tebakbenderaCommand.endSession(chatId);
          gameType = "tebakbendera";
          gameEnded = true;
        }
      }

      // Check for active siapakahaku session
      if (!gameEnded && siapakahakuCommand && siapakahakuCommand.surrender) {
        const surrendered = await siapakahakuCommand.surrender(sock, m);
        if (surrendered) {
          gameType = "siapakahaku";
          gameEnded = true;
          // siapakahaku handles its own surrender message, so we return early
          await addGameStats(userId, gameType, "surrendered");
          logger.info(
            `[SURRENDER] ${userName} surrendered ${gameType} game in ${chatId}`
          );
          return;
        }
      }

      // Check for active tebaklirik session
      if (!gameEnded && tebaklirikCommand && tebaklirikCommand.getSession) {
        const session = tebaklirikCommand.getSession(chatId);
        if (session) {
          gameData = session;
          gameType = "tebaklirik";
          gameEnded = true;
          tebaklirikCommand.clearSession(chatId);
          logger.info(
            `[SURRENDER] ${userName} surrendered ${gameType} game in ${chatId}`
          );
          return;
        }
      }

      // Check for active tebaklagu session
      if (!gameEnded && tebaklaguCommand && tebaklaguCommand.getSession) {
        const session = tebaklaguCommand.getSession(chatId);
        if (session) {
          gameData = session;
          gameType = "tebaklagu";
          gameEnded = true;
          tebaklaguCommand.clearSession(chatId);
          logger.info(
            `[SURRENDER] ${userName} surrendered ${gameType} game in ${chatId}`
          );
          return;
        }
      }

      // Check for active slot session
      if (!gameEnded && slotCommand && slotCommand.clearSession) {
        const sessionCleared = slotCommand.clearSession(chatId, userId);
        if (sessionCleared) {
          gameType = "slot";
          gameEnded = true;
        }
      }

      if (!gameEnded) {
        return await messageFormatter.sendMessage(sock, m, {
          text: "❌ Tidak ada game yang sedang berlangsung di grup ini!",
        });
      }

      // Add surrender stats
      await addGameStats(userId, gameType, "surrendered");

      let surrenderMessage = "🏳️ *MENYERAH!*\n\n";
      surrenderMessage += `👤 *Pemain:* ${userName}\n`;
      surrenderMessage += `🎮 *Game:* ${gameType.toUpperCase()}\n`;

      if (gameData) {
        if (gameType === "kuis") {
          surrenderMessage += `❓ *Soal:* ${gameData.soal}\n`;
          surrenderMessage += `✅ *Jawaban:* ${gameData.jawaban}\n`;
        } else if (gameType === "family100") {
          surrenderMessage += `❓ *Soal:* ${gameData.soal}\n`;
          if (gameData.jawaban && gameData.jawaban.length > 0) {
            surrenderMessage += `✅ *Jawaban yang belum terjawab:*\n`;
            gameData.jawaban.forEach((jawab, index) => {
              surrenderMessage += `${index + 1}. ${jawab}\n`;
            });
          }
        } else if (gameType === "tebakgambar") {
          surrenderMessage += `🖼️ *Gambar:* ${gameData.soal}\n`;
          surrenderMessage += `✅ *Jawaban:* ${gameData.jawaban}\n`;
        } else if (gameType === "tebaklirik") {
          surrenderMessage += `🎵 *Lirik:* ${gameData.soal}\n`;
          surrenderMessage += `✅ *Jawaban:* ${gameData.jawaban}\n`;
        } else if (gameType === "tebaklagu") {
          surrenderMessage += `🎵 *Lagu:* ${gameData.soal}\n`;
          surrenderMessage += `🎤 *Artis:* ${gameData.artis}\n`;
          surrenderMessage += `✅ *Jawaban:* ${gameData.jawaban}\n`;
        }
      }

      surrenderMessage += `\nCoba lagi dengan ${config.prefix}${gameType}!`;

      await messageFormatter.sendMessage(sock, m, { text: surrenderMessage });

      logger.info(
        `[SURRENDER] ${userName} surrendered ${gameType} game in ${chatId}`
      );
    } catch (error) {
      logger.error(`[SURRENDER] Error: ${error.message}`);
      await messageFormatter.sendMessage(sock, m, {
        text: "❌ Terjadi kesalahan saat menyerah dari game!",
      });
    }
  },
};
