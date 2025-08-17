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

// Global werewolf sessions storage - exported for use in wwpc.js
export const werewolfSessions = new Map();

// Thumbnail images
const thumbs = [
  "https://user-images.githubusercontent.com/72728486/235316834-f9f84ba0-8df3-4444-81d8-db5270995e6d.jpg",
  "https://user-images.githubusercontent.com/72728486/235316834-f9f84ba0-8df3-4444-81d8-db5270995e6d.jpg",
  "https://user-images.githubusercontent.com/72728486/235316834-f9f84ba0-8df3-4444-81d8-db5270995e6d.jpg",
  "https://user-images.githubusercontent.com/72728486/235316834-f9f84ba0-8df3-4444-81d8-db5270995e6d.jpg",
  "https://user-images.githubusercontent.com/72728486/235316834-f9f84ba0-8df3-4444-81d8-db5270995e6d.jpg",
  "https://user-images.githubusercontent.com/72728486/235316834-f9f84ba0-8df3-4444-81d8-db5270995e6d.jpg",
];

// Helper functions
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emoji_role(role) {
  const emojis = {
    warga: "👱‍♂️",
    seer: "👳",
    guardian: "👼",
    sorcerer: "🔮",
    werewolf: "🐺",
  };
  return emojis[role] || "";
}

function findObject(obj = {}, key, value) {
  const result = [];
  const recursiveSearch = (obj = {}) => {
    if (!obj || typeof obj !== "object") return;
    if (obj[key] === value) result.push(obj);
    Object.keys(obj).forEach((k) => recursiveSearch(obj[k]));
  };
  recursiveSearch(obj);
  return result;
}

// Game session functions
function sesi(from, data) {
  return data.get(from) || false;
}

function playerOnGame(sender, data) {
  for (const [chatId, session] of data) {
    const player = session.player.find((p) => p.id === sender);
    if (player) return true;
  }
  return false;
}

function playerOnRoom(sender, from, data) {
  const session = sesi(from, data);
  if (!session) return false;
  return session.player.some((p) => p.id === sender);
}

function dataPlayer(sender, data) {
  for (const [chatId, session] of data) {
    const player = session.player.find((p) => p.id === sender);
    if (player) return player;
  }
  return false;
}

function getPlayerById(from, sender, id, data) {
  const session = sesi(from, data);
  if (!session) return false;
  const player = session.player.find((p) => p.number === id);
  if (!player) return false;
  return { db: player, index: session.player.indexOf(player) };
}

function roleAmount(playerCount) {
  const roles = {
    4: { werewolf: 1, seer: 1, guardian: 1, warga: 1, sorcerer: 0 },
    5: { werewolf: 1, seer: 1, guardian: 1, warga: 2, sorcerer: 0 },
    6: { werewolf: 2, seer: 1, guardian: 1, warga: 2, sorcerer: 0 },
    7: { werewolf: 2, seer: 1, guardian: 1, warga: 3, sorcerer: 0 },
    8: { werewolf: 2, seer: 1, guardian: 1, warga: 4, sorcerer: 0 },
    9: { werewolf: 2, seer: 1, guardian: 1, warga: 4, sorcerer: 1 },
    10: { werewolf: 2, seer: 1, guardian: 1, warga: 5, sorcerer: 1 },
    11: { werewolf: 2, seer: 1, guardian: 2, warga: 5, sorcerer: 1 },
    12: { werewolf: 2, seer: 1, guardian: 2, warga: 6, sorcerer: 1 },
    13: { werewolf: 2, seer: 1, guardian: 1, warga: 7, sorcerer: 1 },
    14: { werewolf: 2, seer: 2, guardian: 2, warga: 7, sorcerer: 1 },
    15: { werewolf: 3, seer: 2, guardian: 3, warga: 6, sorcerer: 1 },
  };
  return roles[playerCount] || roles[5];
}

function roleShuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function roleGenerator(from, data) {
  const session = sesi(from, data);
  if (!session) return false;

  const roles = roleAmount(session.player.length);
  const roleTypes = ["werewolf", "seer", "guardian", "warga", "sorcerer"];

  roleTypes.forEach((roleType) => {
    for (let i = 0; i < roles[roleType]; i++) {
      const availablePlayers = session.player.filter((p) => !p.role);
      if (availablePlayers.length === 0) break;

      const randomPlayer =
        availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
      randomPlayer.role = roleType;
    }
  });

  return true;
}

function vote(from, targetId, sender, data) {
  const session = sesi(from, data);
  if (!session) return false;

  const voter = session.player.find((p) => p.id === sender);
  const target = session.player.find((p) => p.number === targetId);

  if (!voter || !target || voter.isvote) return false;

  voter.isvote = true;
  target.vote += 1;
  return true;
}

function voteResult(from, data) {
  const session = sesi(from, data);
  if (!session) return false;

  session.player.sort((a, b) => b.vote - a.vote);

  if (session.player[0].vote === 0) return 0;
  if (session.player[0].vote === session.player[1]?.vote) return 1;

  return session.player[0];
}

function clearAllVote(from, data) {
  const session = sesi(from, data);
  if (!session) return false;

  session.player.forEach((p) => {
    p.vote = 0;
    p.isvote = false;
  });
}

function getWinner(from, data) {
  const session = sesi(from, data);
  if (!session) return false;

  let werewolfCount = 0;
  let villagerCount = 0;

  session.player.forEach((p) => {
    if (!p.isdead) {
      if (p.role === "werewolf" || p.role === "sorcerer") {
        werewolfCount++;
      } else {
        villagerCount++;
      }
    }
  });

  if (werewolfCount === 0) {
    return { status: true, winner: "villagers" }; // Villagers win
  } else if (werewolfCount >= villagerCount) {
    return { status: false, winner: "werewolves" }; // Werewolves win
  }

  return { status: null, winner: null }; // Game continues
}

export default {
  name: "werewolf",
  aliases: ["ww"],
  description:
    "Game Werewolf - Permainan sosial yang berlangsung dalam beberapa putaran",
  usage: `${config.prefix}werewolf [create|join|start|exit|delete|player|vote|kill|dreamy|deff|sorcerer]`,
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
      const value = args[0]?.toLowerCase();
      const target = args[1];

      const thumb = thumbs[Math.floor(Math.random() * thumbs.length)];

      if (value === "create") {
        if (werewolfSessions.has(chatId)) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Group masih dalam sesi permainan werewolf!",
            },
            { quoted: m }
          );
        }

        if (playerOnGame(userId, werewolfSessions)) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Kamu masih dalam sesi game lain!",
            },
            { quoted: m }
          );
        }

        werewolfSessions.set(chatId, {
          room: chatId,
          owner: userId,
          status: false,
          iswin: null,
          cooldown: null,
          day: 0,
          time: "malem",
          player: [],
          dead: [],
          voting: false,
          seer: false,
          guardian: [],
        });

        await sock.sendMessage(
          chatId,
          {
            text: `🎮 *WEREWOLF GAME*\n\n✅ Room berhasil dibuat!\n\n📝 Ketik *${config.prefix}ww join* untuk bergabung`,
          },
          { quoted: m }
        );
      } else if (value === "join") {
        const session = sesi(chatId, werewolfSessions);
        if (!session) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Belum ada sesi permainan werewolf!",
            },
            { quoted: m }
          );
        }

        if (session.status) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Sesi permainan sudah dimulai!",
            },
            { quoted: m }
          );
        }

        if (session.player.length >= 15) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Maaf, jumlah player telah penuh (maksimal 15)!",
            },
            { quoted: m }
          );
        }

        if (playerOnRoom(userId, chatId, werewolfSessions)) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Kamu sudah join dalam room ini!",
            },
            { quoted: m }
          );
        }

        if (playerOnGame(userId, werewolfSessions)) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Kamu masih dalam sesi game lain!",
            },
            { quoted: m }
          );
        }

        const playerData = {
          id: userId,
          number: session.player.length + 1,
          sesi: chatId,
          status: false,
          role: false,
          effect: [],
          vote: 0,
          isdead: false,
          isvote: false,
        };

        session.player.push(playerData);

        let playerList = "\n*🎮 WEREWOLF PLAYERS*\n\n";
        let mentions = [];

        session.player.forEach((player, index) => {
          playerList += `${player.number}) @${player.id.replace(
            "@s.whatsapp.net",
            ""
          )}\n`;
          mentions.push(player.id);
        });

        playerList +=
          "\n📊 Jumlah player minimal: 5\n📊 Jumlah player maksimal: 15";

        await sock.sendMessage(
          chatId,
          {
            text: playerList,
            contextInfo: {
              mentionedJid: mentions,
            },
          },
          { quoted: m }
        );
      } else if (value === "start") {
        const session = sesi(chatId, werewolfSessions);
        if (!session) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Belum ada sesi permainan werewolf!",
            },
            { quoted: m }
          );
        }

        if (session.player.length === 0) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Room belum memiliki player!",
            },
            { quoted: m }
          );
        }

        if (session.player.length < 5) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Jumlah player belum memenuhi syarat (minimal 5)!",
            },
            { quoted: m }
          );
        }

        if (!playerOnRoom(userId, chatId, werewolfSessions)) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Kamu belum join dalam room ini!",
            },
            { quoted: m }
          );
        }

        if (session.status) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Sesi permainan telah dimulai!",
            },
            { quoted: m }
          );
        }

        if (session.owner !== userId) {
          return await sock.sendMessage(
            chatId,
            {
              text: `❌ Hanya @${
                session.owner.split("@")[0]
              } yang dapat memulai permainan!`,
            },
            { quoted: m }
          );
        }

        // Generate roles
        roleGenerator(chatId, werewolfSessions);
        session.status = true;
        session.cooldown = Date.now() + 90 * 1000;

        let playerList = "";
        let werewolfList = "";
        let mentions = [];

        session.player.forEach((player) => {
          playerList += `(${player.number}) @${player.id.replace(
            "@s.whatsapp.net",
            ""
          )}\n`;
          if (player.role === "werewolf" || player.role === "sorcerer") {
            werewolfList += `(${player.number}) @${player.id.replace(
              "@s.whatsapp.net",
              ""
            )} [${player.role}]\n`;
          }
          mentions.push(player.id);
        });

        // Send role messages to each player
        for (const player of session.player) {
          if (player.role === "werewolf") {
            await sock.sendMessage(player.id, {
              text: `🐺 *WEREWOLF ROLE*\n\nHai ${userName}, kamu terpilih sebagai *Werewolf* ${emoji_role(
                "werewolf"
              )}!\n\nTugas: Bunuh semua warga desa\n\n*LIST PLAYER:*\n${werewolfList}\n\nKetik *${
                config.prefix
              }wwpc kill [nomor]* untuk membunuh player`,
            });
          } else if (player.role === "seer") {
            await sock.sendMessage(player.id, {
              text: `👳 *SEER ROLE*\n\nHai ${userName}, kamu terpilih sebagai *Penerawang* ${emoji_role(
                "seer"
              )}!\n\nKemampuan: Melihat role player lain\n\n*LIST PLAYER:*\n${playerList}\n\nKetik *${
                config.prefix
              }wwpc dreamy [nomor]* untuk melihat role player`,
            });
          } else if (player.role === "guardian") {
            await sock.sendMessage(player.id, {
              text: `👼 *GUARDIAN ROLE*\n\nHai ${userName}, kamu terpilih sebagai *Malaikat Pelindung* ${emoji_role(
                "guardian"
              )}!\n\nKemampuan: Melindungi player dari serangan werewolf\n\n*LIST PLAYER:*\n${playerList}\n\nKetik *${
                config.prefix
              }wwpc deff [nomor]* untuk melindungi player`,
            });
          } else if (player.role === "sorcerer") {
            await sock.sendMessage(player.id, {
              text: `🔮 *SORCERER ROLE*\n\nHai ${userName}, kamu terpilih sebagai *Penyihir* ${emoji_role(
                "sorcerer"
              )}!\n\nTim: Werewolf\nKemampuan: Melihat role player lain\n\n*LIST PLAYER:*\n${werewolfList}\n\nKetik *${
                config.prefix
              }wwpc sorcerer [nomor]* untuk melihat role player`,
            });
          } else {
            await sock.sendMessage(player.id, {
              text: `👱‍♂️ *VILLAGER ROLE*\n\nHai ${userName}, kamu adalah *Warga Desa* ${emoji_role(
                "warga"
              )}!\n\nTugas: Temukan dan singkirkan semua werewolf\n\n*LIST PLAYER:*\n${playerList}\n\nTetap waspada, werewolf mungkin akan menyerangmu malam ini!`,
            });
          }
        }

        await sock.sendMessage(
          chatId,
          {
            text: `🎮 *WEREWOLF GAME STARTED*\n\n🌙 Game telah dimulai! Para player telah mendapat role masing-masing.\n\n📱 Silakan cek chat pribadi untuk melihat role kalian.\n\n⚠️ Berhati-hatilah para warga, malam ini mungkin adalah malam terakhir untuk kalian...`,
          },
          { quoted: m }
        );

        // Start night phase
        await sleep(3000);
        await this.startNightPhase(sock, chatId, werewolfSessions);
      } else if (value === "exit") {
        const session = sesi(chatId, werewolfSessions);
        if (!session) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Tidak ada sesi permainan werewolf!",
            },
            { quoted: m }
          );
        }

        if (!playerOnRoom(userId, chatId, werewolfSessions)) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Kamu tidak dalam sesi permainan!",
            },
            { quoted: m }
          );
        }

        if (session.status) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Permainan sudah dimulai, kamu tidak bisa keluar!",
            },
            { quoted: m }
          );
        }

        const playerIndex = session.player.findIndex((p) => p.id === userId);
        if (playerIndex !== -1) {
          session.player.splice(playerIndex, 1);
          // Update player numbers
          session.player.forEach((player, index) => {
            player.number = index + 1;
          });
        }

        await sock.sendMessage(
          chatId,
          {
            text: `🚪 @${userId.split("@")[0]} keluar dari permainan werewolf`,
            contextInfo: {
              mentionedJid: [userId],
            },
          },
          { quoted: m }
        );
      } else if (value === "delete") {
        const session = sesi(chatId, werewolfSessions);
        if (!session) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Tidak ada sesi permainan werewolf!",
            },
            { quoted: m }
          );
        }

        if (session.owner !== userId) {
          return await sock.sendMessage(
            chatId,
            {
              text: `❌ Hanya @${
                session.owner.split("@")[0]
              } yang dapat menghapus sesi permainan!`,
              contextInfo: { mentionedJid: [session.owner] },
            },
            { quoted: m }
          );
        }

        werewolfSessions.delete(chatId);
        await sock.sendMessage(
          chatId,
          {
            text: "🗑️ Sesi permainan werewolf berhasil dihapus!",
          },
          { quoted: m }
        );
      } else if (value === "player") {
        const session = sesi(chatId, werewolfSessions);
        if (!session) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Tidak ada sesi permainan werewolf!",
            },
            { quoted: m }
          );
        }

        if (!playerOnRoom(userId, chatId, werewolfSessions)) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Kamu tidak dalam sesi permainan!",
            },
            { quoted: m }
          );
        }

        if (session.player.length === 0) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Sesi permainan belum memiliki player!",
            },
            { quoted: m }
          );
        }

        let playerList = "\n*🎮 WEREWOLF PLAYERS*\n\n";
        let mentions = [];

        session.player.forEach((player) => {
          const status = player.isdead ? " ☠️" : "";
          const role =
            session.status && player.isdead ? ` [${player.role}]` : "";
          playerList += `(${player.number}) @${player.id.replace(
            "@s.whatsapp.net",
            ""
          )}${status}${role}\n`;
          mentions.push(player.id);
        });

        await sock.sendMessage(
          chatId,
          {
            text: playerList,
            contextInfo: {
              mentionedJid: mentions,
            },
          },
          { quoted: m }
        );
      } else if (value === "vote") {
        const session = sesi(chatId, werewolfSessions);
        if (!session) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Belum ada sesi permainan werewolf!",
            },
            { quoted: m }
          );
        }

        if (!session.status) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Sesi permainan belum dimulai!",
            },
            { quoted: m }
          );
        }

        if (session.time !== "voting") {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Sesi voting belum dimulai!",
            },
            { quoted: m }
          );
        }

        if (!playerOnRoom(userId, chatId, werewolfSessions)) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Kamu bukan player!",
            },
            { quoted: m }
          );
        }

        const voter = dataPlayer(userId, werewolfSessions);
        if (voter.isdead) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Kamu sudah mati!",
            },
            { quoted: m }
          );
        }

        if (!target || isNaN(target)) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Masukan nomor player yang valid!",
            },
            { quoted: m }
          );
        }

        if (voter.isvote) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Kamu sudah melakukan voting!",
            },
            { quoted: m }
          );
        }

        const targetPlayer = getPlayerById(
          chatId,
          userId,
          parseInt(target),
          werewolfSessions
        );
        if (!targetPlayer) {
          return await sock.sendMessage(
            chatId,
            {
              text: "❌ Player tidak terdaftar!",
            },
            { quoted: m }
          );
        }

        if (targetPlayer.db.isdead) {
          return await sock.sendMessage(
            chatId,
            {
              text: `❌ Player ${target} sudah mati!`,
            },
            { quoted: m }
          );
        }

        vote(chatId, parseInt(target), userId, werewolfSessions);
        await sock.sendMessage(
          chatId,
          {
            text: "✅ Vote berhasil!",
          },
          { quoted: m }
        );
      } else {
        // Show help menu
        const helpText = `\n*🎮 WEREWOLF GAME*\n\nPermainan sosial yang berlangsung dalam beberapa putaran. Para pemain dituntut untuk mencari seorang penjahat yang ada di permainan.\n\n*📋 COMMANDS:*\n• ${config.prefix}ww create - Buat room\n• ${config.prefix}ww join - Bergabung\n• ${config.prefix}ww start - Mulai game\n• ${config.prefix}ww exit - Keluar room\n• ${config.prefix}ww delete - Hapus room\n• ${config.prefix}ww player - Lihat player\n• ${config.prefix}ww vote [nomor] - Vote player\n\n📊 Permainan ini dapat dimainkan oleh 5-15 orang.`;

        const thumb = thumbs[Math.floor(Math.random() * thumbs.length)];

        await sock.sendMessage(
          chatId,
          {
            text: helpText,
            contextInfo: {
              externalAdReply: {
                title: "W E R E W O L F - G A M E",
                body: "Permainan Sosial Yang Berlangsung Dalam Beberapa Putaran/ronde. Para Pemain Dituntut Untuk Mencari Seorang Penjahat Yang Ada Dipermainan. Para Pemain Diberi Waktu, Peran, Serta Kemampuannya Masing-masing Untuk Bermain Permainan Ini",
                mediaType: 1,
                renderLargerThumbnail: true,
                thumbnailUrl: thumb,
                sourceUrl: "vapisz.web.app",
                mediaUrl: thumb,
              },
            },
          },
          { quoted: m }
        );
      }
    } catch (error) {
      logger.error("Error in werewolf command:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        {
          text: "❌ Terjadi kesalahan saat menjalankan command werewolf!",
        },
        { quoted: m }
      );
    }
  },

  async startNightPhase(sock, chatId, data) {
    const session = sesi(chatId, data);
    if (!session) return;

    session.time = "malem";
    session.day += 1;

    const thumb = thumbs[Math.floor(Math.random() * thumbs.length)];
    let mentions = session.player.map((p) => p.id);

    await sock.sendMessage(chatId, {
      text: `🌙 *MALAM HARI ${session.day}*\n\n🌃 Malam telah tiba, semua warga tertidur lelap. Namun ada yang bergerak dalam kegelapan...\n\n⏰ Para pemain dengan kemampuan khusus memiliki 90 detik untuk menggunakan skill mereka.`,
      contextInfo: {
        mentionedJid: mentions,
      },
    });

    // Reset player status for night actions
    session.player.forEach((p) => {
      p.status = false;
      p.effect = [];
    });

    // Wait for night actions (90 seconds)
    await sleep(90000);

    // Process night results and start day phase
    await this.startDayPhase(sock, chatId, data);
  },

  async startDayPhase(sock, chatId, data) {
    const session = sesi(chatId, data);
    if (!session) return;

    session.time = "pagi";

    // Process deaths from werewolf attacks
    const deadPlayers = [];
    const protectedPlayers = [];

    session.dead.forEach((playerId) => {
      const player = session.player.find((p) => p.number === playerId);
      if (player) {
        if (player.effect.includes("guardian")) {
          protectedPlayers.push(player);
        } else {
          player.isdead = true;
          deadPlayers.push(player);
        }
      }
    });

    // Clear night data
    session.dead = [];
    session.guardian = [];
    session.seer = false;

    const thumb = thumbs[Math.floor(Math.random() * thumbs.length)];
    let mentions = session.player.map((p) => p.id);

    let dayMessage = `☀️ *PAGI HARI ${session.day}*\n\n`;

    if (deadPlayers.length === 0 && protectedPlayers.length === 0) {
      dayMessage +=
        "🌅 Mentari telah terbit, tidak ada korban berjatuhan malam ini. Warga kembali melakukan aktivitas seperti biasa.";
    } else {
      if (deadPlayers.length > 0) {
        const deadNames = deadPlayers
          .map((p) => `@${p.id.replace("@s.whatsapp.net", "")}`)
          .join(", ");
        dayMessage += `💀 Pagi telah tiba, warga desa menemukan ${
          deadPlayers.length > 1 ? "beberapa" : "1"
        } mayat di tumpukan puing dan darah berceceran. ${deadNames} telah mati!\n\n`;
      }

      if (protectedPlayers.length > 0) {
        const protectedNames = protectedPlayers
          .map((p) => `@${p.id.replace("@s.whatsapp.net", "")}`)
          .join(", ");
        dayMessage += `🛡️ ${protectedNames} hampir dibunuh, namun *Guardian Angel* berhasil melindunginya.\n\n`;
      }
    }

    dayMessage +=
      "\n🗣️ Warga desa memiliki 90 detik untuk berdiskusi sebelum voting dimulai.";

    await sock.sendMessage(chatId, {
      text: dayMessage,
    });

    // Check win condition
    const winResult = getWinner(chatId, data);
    if (winResult.status !== null) {
      return await this.endGame(sock, chatId, data, winResult);
    }

    // Wait for discussion (90 seconds)
    await sleep(90000);

    // Start voting phase
    await this.startVotingPhase(sock, chatId, data);
  },

  async startVotingPhase(sock, chatId, data) {
    const session = sesi(chatId, data);
    if (!session) return;

    session.time = "voting";
    session.voting = true;

    // Clear previous votes
    clearAllVote(chatId, data);

    const thumb = thumbs[Math.floor(Math.random() * thumbs.length)];
    let mentions = session.player.filter((p) => !p.isdead).map((p) => p.id);

    let playerList = "";
    session.player.forEach((p) => {
      if (!p.isdead) {
        playerList += `(${p.number}) @${p.id.replace("@s.whatsapp.net", "")}\n`;
      }
    });

    const voteMessage = `🗳️ *VOTING TIME*\n\n⏰ Senja telah tiba, saatnya warga desa menentukan siapa yang akan dieksekusi hari ini.\n\n*PLAYERS HIDUP:*\n${playerList}\n\n📝 Ketik *${config.prefix}ww vote [nomor]* untuk memilih\n⏰ Waktu voting: 90 detik`;

    await sock.sendMessage(chatId, {
      text: voteMessage,
    });

    // Wait for voting (90 seconds)
    await sleep(90000);

    // Process voting results
    await this.processVotingResults(sock, chatId, data);
  },

  async processVotingResults(sock, chatId, data) {
    const session = sesi(chatId, data);
    if (!session) return;

    session.voting = false;

    const result = voteResult(chatId, data);
    const thumb = thumbs[Math.floor(Math.random() * thumbs.length)];
    let mentions = session.player.map((p) => p.id);

    let resultMessage = "📊 *HASIL VOTING*\n\n";

    if (result === 0) {
      resultMessage +=
        "❌ Tidak ada yang divote, tidak ada yang dieksekusi hari ini.";
    } else if (result === 1) {
      resultMessage +=
        "🤝 Hasil voting seri, tidak ada yang dieksekusi hari ini.";
    } else {
      result.isdead = true;
      resultMessage += `⚰️ @${result.id.replace(
        "@s.whatsapp.net",
        ""
      )} telah dieksekusi oleh warga desa!\n\n🎭 Role: ${
        result.role
      } ${emoji_role(result.role)}`;
    }

    await sock.sendMessage(chatId, {
      text: resultMessage,
    });

    // Check win condition
    const winResult = getWinner(chatId, data);
    if (winResult.status !== null) {
      return await this.endGame(sock, chatId, data, winResult);
    }

    // Continue to next night
    await sleep(5000);
    await this.startNightPhase(sock, chatId, data);
  },

  async endGame(sock, chatId, data, winResult) {
    const session = sesi(chatId, data);
    if (!session) return;

    const thumb = thumbs[Math.floor(Math.random() * thumbs.length)];
    let mentions = session.player.map((p) => p.id);

    let endMessage = "🎉 *GAME OVER*\n\n";

    if (winResult.winner === "villagers") {
      endMessage +=
        "👱‍♂️ **VILLAGERS WIN!**\n\n✅ Semua werewolf telah disingkirkan!";
    } else {
      endMessage +=
        "🐺 **WEREWOLVES WIN!**\n\n✅ Werewolf berhasil menguasai desa!";
    }

    endMessage += "\n\n*🎭 ROLE REVEAL:*\n";
    session.player.forEach((p) => {
      const status = p.isdead ? " ☠️" : " ❤️";
      endMessage += `(${p.number}) @${p.id.replace("@s.whatsapp.net", "")} - ${
        p.role
      } ${emoji_role(p.role)}${status}\n`;
    });

    await sock.sendMessage(chatId, {
      text: endMessage,
    });

    // Clean up session
    data.delete(chatId);
  },
};
