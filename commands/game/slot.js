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

// Global game sessions storage
const slotSessions = new Map();

// Slot symbols with their weights (adjusted for 65% loss rate)
const slotSymbols = [
  { symbol: "🍒", weight: 40, name: "Cherry" },
  { symbol: "🍋", weight: 35, name: "Lemon" },
  { symbol: "🍊", weight: 35, name: "Orange" },
  { symbol: "🍇", weight: 25, name: "Grape" },
  { symbol: "🔔", weight: 15, name: "Bell" },
  { symbol: "💎", weight: 8, name: "Diamond" },
  { symbol: "7️⃣", weight: 4, name: "Seven" },
  { symbol: "🎰", weight: 3, name: "Jackpot" },
];

// Winning combinations with adjusted probabilities (65% loss rate, max 2x = 20% chance)
const winningCombinations = {
  "🍒🍒🍒": { multiplier: 1.2, name: "Triple Cherry", probability: 8 },
  "🍋🍋🍋": { multiplier: 1.3, name: "Triple Lemon", probability: 6 },
  "🍊🍊🍊": { multiplier: 1.3, name: "Triple Orange", probability: 6 },
  "🍇🍇🍇": { multiplier: 1.5, name: "Triple Grape", probability: 4 },
  "🔔🔔🔔": { multiplier: 1.7, name: "Triple Bell", probability: 3 },
  "💎💎💎": { multiplier: 1.8, name: "Triple Diamond", probability: 2 },
  "7️⃣7️⃣7️⃣": { multiplier: 2.0, name: "Triple Seven", probability: 1 },
  "🎰🎰🎰": { multiplier: 2.0, name: "JACKPOT!", probability: 1 },
  // Two of a kind (smaller multipliers)
  "🍒🍒": { multiplier: 1.05, name: "Double Cherry", probability: 4 },
  "🍋🍋": { multiplier: 1.05, name: "Double Lemon", probability: 3 },
  "🍊🍊": { multiplier: 1.05, name: "Double Orange", probability: 3 },
  "🍇🍇": { multiplier: 1.1, name: "Double Grape", probability: 2 },
  "🔔🔔": { multiplier: 1.15, name: "Double Bell", probability: 1.5 },
  "💎💎": { multiplier: 1.2, name: "Double Diamond", probability: 1 },
  "7️⃣7️⃣": { multiplier: 1.3, name: "Double Seven", probability: 0.5 },
  "🎰🎰": { multiplier: 1.4, name: "Double Jackpot", probability: 0.5 },
};

// Helper function to get weighted random symbol
function getRandomSymbol() {
  const totalWeight = slotSymbols.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of slotSymbols) {
    random -= item.weight;
    if (random <= 0) {
      return item.symbol;
    }
  }
  return slotSymbols[0].symbol; // fallback
}

// Helper function to determine win based on probability (60% loss rate, 40% win rate)
function determineWin(betAmount) {
  const winChance = Math.random() * 100;

  // 60% chance to lose
  if (winChance > 40) {
    return null;
  }

  // 40% chance to win - distribute among different multipliers
  const winType = Math.random() * 100;

  // Probability distribution for wins (total 40%)
  // 2x multiplier = 20% dari 40% win chance = 8% total
  // 1.5x-1.8x multiplier = 30% dari 40% win chance = 12% total
  // 1.2x-1.3x multiplier = 50% dari 40% win chance = 20% total

  if (winType <= 50) {
    // 50% dari win chance (20% total) - small wins (1.2x-1.3x)
    const smallWins = ["🍒🍒", "🍋🍋", "🍊🍊", "🍒🍒🍒", "🍋🍋🍋", "🍊🍊🍊"];
    const combination = smallWins[Math.floor(Math.random() * smallWins.length)];
    return winningCombinations[combination];
  } else if (winType <= 80) {
    // 30% dari win chance (12% total) - medium wins (1.5x-1.8x)
    const mediumWins = ["🍇🍇", "🍇🍇🍇", "🔔🔔", "🔔🔔🔔", "💎💎", "💎💎💎"];
    const combination =
      mediumWins[Math.floor(Math.random() * mediumWins.length)];
    return winningCombinations[combination];
  } else {
    // 20% dari win chance (8% total) - jackpot (2x multiplier)
    const jackpots = ["7️⃣7️⃣", "7️⃣7️⃣7️⃣", "🎰🎰", "🎰🎰🎰"];
    const combination = jackpots[Math.floor(Math.random() * jackpots.length)];
    return winningCombinations[combination];
  }
}

// Helper function to generate symbols based on win result
function generateSymbols(winResult) {
  if (!winResult) {
    // Generate losing combination
    let symbols;
    do {
      symbols = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
    } while (checkWinFromSymbols(symbols));
    return symbols;
  }

  // Generate winning combination based on result
  const combinations = {
    "Double Cherry": ["🍒", "🍒", getRandomSymbol()],
    "Double Lemon": ["🍋", "🍋", getRandomSymbol()],
    "Double Orange": ["🍊", "🍊", getRandomSymbol()],
    "Double Grape": ["🍇", "🍇", getRandomSymbol()],
    "Double Bell": ["🔔", "🔔", getRandomSymbol()],
    "Double Diamond": ["💎", "💎", getRandomSymbol()],
    "Double Seven": ["7️⃣", "7️⃣", getRandomSymbol()],
    "Double Jackpot": ["🎰", "🎰", getRandomSymbol()],
    "Triple Cherry": ["🍒", "🍒", "🍒"],
    "Triple Lemon": ["🍋", "🍋", "🍋"],
    "Triple Orange": ["🍊", "🍊", "🍊"],
    "Triple Grape": ["🍇", "🍇", "🍇"],
    "Triple Bell": ["🔔", "🔔", "🔔"],
    "Triple Diamond": ["💎", "💎", "💎"],
    "Triple Seven": ["7️⃣", "7️⃣", "7️⃣"],
    "JACKPOT!": ["🎰", "🎰", "🎰"],
  };

  let symbols = combinations[winResult.name];

  // For double combinations, ensure third symbol is different
  if (winResult.name.includes("Double")) {
    let thirdSymbol;
    do {
      thirdSymbol = getRandomSymbol();
    } while (thirdSymbol === symbols[0]);
    symbols[2] = thirdSymbol;
  }

  return symbols;
}

// Helper function to check winning combinations from symbols
function checkWinFromSymbols(symbols) {
  const [s1, s2, s3] = symbols;

  // Check for triple match
  if (s1 === s2 && s2 === s3) {
    const combination = s1 + s2 + s3;
    return winningCombinations[combination] || null;
  }

  // Check for double match
  if (s1 === s2) {
    const combination = s1 + s2;
    return winningCombinations[combination] || null;
  }
  if (s2 === s3) {
    const combination = s2 + s3;
    return winningCombinations[combination] || null;
  }
  if (s1 === s3) {
    const combination = s1 + s3;
    return winningCombinations[combination] || null;
  }

  return null;
}

// Helper function to create slot animation
function createSlotAnimation() {
  const frames = [
    "🎰 [ 🎲 | 🎲 | 🎲 ] 🎰",
    "🎰 [ 🔄 | 🔄 | 🔄 ] 🎰",
    "🎰 [ ⚡ | ⚡ | ⚡ ] 🎰",
    "🎰 [ 🌟 | 🌟 | 🌟 ] 🎰",
    "🎰 [ 💫 | 💫 | 💫 ] 🎰",
  ];
  return frames;
}

export default {
  name: "slot",
  aliases: ["slots", "mesin"],
  description: "Game slot machine - taruh taruhan dan putar untuk menang!",
  usage: `${config.prefix}slot <jumlah_taruhan>`,
  category: "game",
  cooldown: 3,
  ownerOnly: false,
  groupOnly: true,
  privateOnly: false,

  async execute(sock, m, args) {
    try {
      const chatId = m.key.remoteJid;
      const userId = m.key.participant || m.key.remoteJid;
      const userName = m.pushName || "User";

      // Check if there's already an active session for this user
      const sessionKey = `${chatId}_${userId}`;
      if (slotSessions.has(sessionKey)) {
        await sock.sendMessage(chatId, {
            text: "❌ Kamu masih memiliki game slot yang sedang berlangsung!\nTunggu sampai selesai.",
          }, { quoted: m });
        return;
      }

      // Check if bet amount is provided
      if (!args[0]) {
        await sock.sendMessage(chatId, {
            text: `❌ Masukkan jumlah taruhan!\n\n📖 *Cara bermain:*\n${config.prefix}slot <jumlah>\n${config.prefix}slot all (untuk all-in)\n\n💰 *Contoh:* ${config.prefix}slot 100\n💰 *All-in:* ${config.prefix}slot all\n\n🎯 *Kombinasi Menang:*\n🍒🍒🍒 = 1.2x\n🍋🍋🍋 = 1.3x\n🍊🍊🍊 = 1.3x\n🍇🍇🍇 = 1.5x\n🔔🔔🔔 = 1.7x\n💎💎💎 = 1.8x\n7️⃣7️⃣7️⃣ = 2.0x\n🎰🎰🎰 = 2.0x (JACKPOT!)\n\n*Double symbols juga bisa menang dengan multiplier lebih kecil!*\n\n📊 *Win Rate: 40%* | *Min Bet: 10* | *Max Bet: Unlimited*`,
          }, { quoted: m });
        return;
      }

      // Get user balance first
      const userBalance = await getBalance(userId);

      // Parse bet amount or handle 'all' command
      let betAmount;
      if (args[0].toLowerCase() === "all") {
        betAmount = userBalance;
        if (betAmount < 10) {
          await sock.sendMessage(chatId, {
              text: `❌ Balance tidak cukup untuk all-in!\n💰 Balance kamu: ${userBalance.toLocaleString()}\n🎯 Minimum bet: 10`,
            }, { quoted: m });
          return;
        }
      } else {
        betAmount = parseInt(args[0]);
        if (isNaN(betAmount) || betAmount <= 0) {
          await sock.sendMessage(chatId, {
              text: "❌ Jumlah taruhan harus berupa angka positif atau 'all' untuk all-in!",
            }, { quoted: m });
          return;
        }

        // Check minimum bet
        if (betAmount < 10) {
          await sock.sendMessage(chatId, {
              text: "❌ Taruhan minimum adalah 10 balance!",
            }, { quoted: m });
          return;
        }

        // Check user balance
        if (userBalance < betAmount) {
          await sock.sendMessage(chatId, {
              text: `❌ Balance tidak cukup!\n💰 Balance kamu: ${userBalance.toLocaleString()}\n🎯 Taruhan: ${betAmount.toLocaleString()}`,
            }, { quoted: m });
          return;
        }
      }

      // Deduct bet amount from balance
      await updateBalance(userId, -betAmount);

      // Create session
      slotSessions.set(sessionKey, {
        userId,
        userName,
        betAmount,
        startTime: Date.now(),
      });

      // Send initial message
      const isAllIn = args[0].toLowerCase() === "all";
      const initialMsg = await sock.sendMessage(chatId, {
          text: `🎰 *SLOT MACHINE* 🎰\n\n👤 Player: ${userName}\n💰 Taruhan: ${betAmount.toLocaleString()}${
            isAllIn ? " 🔥 (ALL-IN!)" : ""
          }\n\n🎲 Memutar slot...`,
        }, { quoted: m });

      // Create animation frames
      const animationFrames = createSlotAnimation();

      // Show animation
      for (let i = 0; i < animationFrames.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        await sock.sendMessage(chatId, {
          edit: initialMsg.key,
          text: `🎰 *SLOT MACHINE* 🎰\n\n👤 Player: ${userName}\n💰 Taruhan: ${betAmount.toLocaleString()}${
            isAllIn ? " 🔥 (ALL-IN!)" : ""
          }\n\n${animationFrames[i]}`,
        });
      }

      // Generate final result using probability system
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const winResult = determineWin(betAmount);
      const finalSymbols = generateSymbols(winResult);

      let resultText = `🎰 *SLOT MACHINE* 🎰\n\n👤 Player: ${userName}\n💰 Taruhan: ${betAmount.toLocaleString()}${
        isAllIn ? " 🔥 (ALL-IN!)" : ""
      }\n\n🎰 [ ${finalSymbols.join(" | ")} ] 🎰\n\n`;

      if (winResult) {
        const winAmount = Math.floor(betAmount * winResult.multiplier);
        const profit = winAmount - betAmount;

        // Add winnings to balance
        await updateBalance(userId, winAmount);

        // Add exp for winning
        await addExp(userId, 15);

        // Add game stats
        await addGameStats(userId, "slot", true);

        resultText += `🎉 *${
          winResult.name
        }!*\n💰 Kemenangan: ${winAmount.toLocaleString()}\n📈 Profit: +${profit.toLocaleString()}\n⭐ +15 EXP`;

        logger.info(
          `🎰 ${userName} won slot game with ${winResult.name} - Bet: ${betAmount}, Win: ${winAmount}`
        );
      } else {
        // Add exp for playing
        await addExp(userId, 5);

        // Add game stats
        await addGameStats(userId, "slot", false);

        resultText += `😔 *Tidak ada kombinasi menang*\n💸 Kehilangan: -${betAmount.toLocaleString()}\n⭐ +5 EXP\n\n🍀 Coba lagi untuk menang!`;

        logger.info(`🎰 ${userName} lost slot game - Bet: ${betAmount}`);
      }

      // Show final result
      await sock.sendMessage(chatId, {
        edit: initialMsg.key,
        text: resultText,
      });

      // Clean up session
      slotSessions.delete(sessionKey);
    } catch (error) {
      logger.error(`Error in slot game: ${error.message}`);

      // Clean up session on error
      const sessionKey = `${m.key.remoteJid}_${
        m.key.participant || m.key.remoteJid
      }`;
      slotSessions.delete(sessionKey);

      await sock.sendMessage(chatId, {
          text: "❌ Terjadi kesalahan saat bermain slot. Silakan coba lagi!",
        }, { quoted: m });
    }
  },

  // Function to check active sessions (for debugging)
  getActiveSessions() {
    return slotSessions;
  },

  // Function to clear session (for surrender functionality)
  clearSession(chatId, userId) {
    const sessionKey = `${chatId}_${userId}`;
    return slotSessions.delete(sessionKey);
  },
};
