import fs from "fs";
import path from "path";
import config from "../config/setting.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "../database.json");

// Load database
function loadDatabase() {
  try {
    if (!fs.existsSync(dbPath)) {
      const defaultDb = {
        users: {},
        groups: {},
        settings: {
          family100_reward: 15,
          daily_limit: 10000,
          default_balance: 0,
          exp_rewards: {
            family100: 15,
            kuis: 10,
            tebakgambar: 12,
            susunkata: 8,
            tebakbendera: 10,
          },
        },
      };
      fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2));
      return defaultDb;
    }
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch (error) {
    console.error("Error loading database:", error);
    return {
      users: {},
      settings: {
        groups: {},
        family100_reward: 15,
        daily_limit: 10000,
        default_balance: 0,
        exp_rewards: {
          family100: 15,
          kuis: 10,
          tebakgambar: 12,
          susunkata: 8,
          tebakbendera: 10,
        },
      },
    };
  }
}

// Save database
function saveDatabase(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("Error saving database:", error);
    return false;
  }
}

// Get user data
function getUser(userId) {
  const db = loadDatabase();
  if (!db.users[userId]) {
    db.users[userId] = {
      balance: db.settings.default_balance,
      lastDaily: null,
      totalEarned: 0,
      gamesPlayed: 0,
      exp: 0,
      level: 1,
      limit: 50,
      lastLimitReset: new Date().toDateString(),
      isPremium: false,
      premiumExpiry: null,
      banned: {
        status: false,
        reason: null,
        expiry: null,
      },
      inventory: {
        bait: {},
        fish: {},
        tools: [], // Diubah menjadi array
        ores: {},
      },
      equipped: {
        fishing_rod: null,
        pickaxe: null,
      },
    };
    saveDatabase(db);
  }

  // Ensure inventory object exists to prevent crashes
  if (!db.users[userId].inventory) {
    db.users[userId].inventory = { bait: {}, fish: {}, tools: [], ores: {} };
  }

  // Migrasi untuk user lama yang tools-nya masih object
  if (
    db.users[userId].inventory &&
    !Array.isArray(db.users[userId].inventory.tools)
  ) {
    db.users[userId].inventory.tools = [];
  }

  if (!db.users[userId].inventory.ores) {
    db.users[userId].inventory.ores = {};
    saveDatabase(db);
  }
  if (!db.users[userId].equipped) {
    db.users[userId].equipped = { fishing_rod: null, pickaxe: null };
    saveDatabase(db);
  }

  // This block ensures every user object has a valid 'banned' property.
  // It handles cases where 'banned' is missing, null, or an old boolean type,
  // preventing crashes when other functions try to access `user.banned.status`.
  if (
    typeof db.users[userId].banned !== "object" ||
    db.users[userId].banned === null
  ) {
    console.log(
      `[DB MIGRATION/FIX] Initializing/fixing 'banned' status for user ${userId}`
    );
    const oldStatus =
      typeof db.users[userId].banned === "boolean"
        ? db.users[userId].banned
        : false;
    db.users[userId].banned = {
      status: oldStatus,
      reason: null,
      expiry: null,
    };
    saveDatabase(db);
  }

  // Check if premium expired
  if (db.users[userId].isPremium && db.users[userId].premiumExpiry) {
    const now = new Date();
    const expiry = new Date(db.users[userId].premiumExpiry);
    if (now > expiry) {
      db.users[userId].isPremium = false;
      db.users[userId].premiumExpiry = null;
      saveDatabase(db);
    }
  }

  // Reset limit jika sudah lewat hari
  const today = new Date().toDateString();
  if (db.users[userId].lastLimitReset !== today) {
    // Check if user is owner
    const cleanUserId = userId.replace("@s.whatsapp.net", "");
    const isOwnerUser = cleanUserId === config.nomorOwner;

    if (isOwnerUser) {
      db.users[userId].limit = 999999; // Unlimited for owner
    } else if (db.users[userId].isPremium) {
      db.users[userId].limit = 500; // Premium limit
    } else {
      db.users[userId].limit = 50; // Free user limit
    }
    db.users[userId].lastLimitReset = today;
    saveDatabase(db);
  }

  // --- Level & EXP Integrity Check and Processing ---
  // This block ensures level/exp exist and processes any pending level-ups.
  // It's a "self-healing" mechanism for user profiles.
  let needsSave = false;
  if (typeof db.users[userId].level === "undefined") {
    db.users[userId].level = 1;
    console.log(`[DB-FIX] Initialized level for ${userId}`);
    needsSave = true;
  }
  if (typeof db.users[userId].exp === "undefined") {
    db.users[userId].exp = 0;
    console.log(`[DB-FIX] Initialized exp for ${userId}`);
    needsSave = true;
  }
  // Process level-ups for accumulated EXP
  while (db.users[userId].exp >= getRequiredExp(db.users[userId].level)) {
    db.users[userId].exp -= getRequiredExp(db.users[userId].level);
    db.users[userId].level += 1;
    console.log(
      `[DB-FIX] User ${userId} leveled up to ${db.users[userId].level} upon data retrieval.`
    );
    needsSave = true;
  }
  if (needsSave) {
    saveDatabase(db);
  }

  return db.users[userId];
}

// Get group data
function getGroup(groupId) {
  const db = loadDatabase();
  if (!db.groups) {
    db.groups = {};
  }
  if (!db.groups[groupId]) {
    db.groups[groupId] = {
      // Default settings for a new group
      jadwalsholat: {
        enabled: false,
        city: null,
      },
    };
    saveDatabase(db);
  }
  return db.groups[groupId];
}

// Update user balance
function updateBalance(userId, amount, reason = "unknown") {
  const db = loadDatabase();
  const user = getUser(userId);

  user.balance += amount;
  if (amount > 0) {
    user.totalEarned += amount;
  }

  db.users[userId] = user;
  saveDatabase(db);

  console.log(
    `Balance updated for ${userId}: ${
      amount > 0 ? "+" : ""
    }${amount} (${reason})`
  );
  return user.balance;
}

// Get user balance
function getBalance(userId) {
  const user = getUser(userId);
  return user.balance;
}

// Add game stats
function addGameStats(userId) {
  const db = loadDatabase();
  const user = getUser(userId);
  user.gamesPlayed += 1;
  db.users[userId] = user;
  saveDatabase(db);
}

// Get settings
function getSettings() {
  const db = loadDatabase();
  return db.settings;
}

// Calculate required EXP for next level
function getRequiredExp(level) {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

// Add EXP to user
function addExp(userId, expAmount) {
  const db = loadDatabase();
  const user = getUser(userId);

  user.exp += expAmount;

  // Check for level up
  let leveledUp = false;
  while (user.exp >= getRequiredExp(user.level)) {
    user.exp -= getRequiredExp(user.level);
    user.level += 1;
    leveledUp = true;
  }

  db.users[userId] = user;
  saveDatabase(db);

  return { leveledUp, newLevel: user.level };
}

// Use limit
function useLimit(userId) {
  const db = loadDatabase();
  const user = getUser(userId);

  if (user.limit <= 0) {
    return false; // No limit remaining
  }

  user.limit -= 1;
  db.users[userId] = user;
  saveDatabase(db);

  return true; // Limit used successfully
}

// Check if user has limit
function hasLimit(userId) {
  const user = getUser(userId);
  return user.limit > 0;
}

// Cek apakah user diban
function isBanned(userId) {
  const db = loadDatabase();
  const user = getUser(userId); // Ini akan membuat user jika belum ada

  if (!user.banned || !user.banned.status) {
    return false;
  }

  // Cek masa berlaku ban
  if (user.banned.expiry) {
    const now = new Date();
    const expiry = new Date(user.banned.expiry);
    if (now > expiry) {
      // Ban sudah berakhir, unban user secara otomatis
      user.banned = { status: false, reason: null, expiry: null };
      db.users[userId] = user;
      saveDatabase(db);
      return false;
    }
  }

  // Jika status true dan expiry null (permanen) atau belum berakhir
  return true;
}

// Fungsi untuk membanned user
function banUser(userId, durationDays = null, reason = "No reason provided") {
  const db = loadDatabase();
  const user = getUser(userId);

  user.banned = {
    status: true,
    reason: reason,
    expiry: null,
  };

  if (durationDays) {
    const now = new Date();
    const expiry = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    user.banned.expiry = expiry.toISOString();
  }

  db.users[userId] = user;
  saveDatabase(db);
  return user.banned;
}

// Fungsi untuk unban user
function unbanUser(userId) {
  const db = loadDatabase();
  const user = getUser(userId);

  if (!user.banned || !user.banned.status) {
    return false; // User not banned
  }

  user.banned = {
    status: false,
    reason: null,
    expiry: null,
  };

  db.users[userId] = user;
  saveDatabase(db);
  return true; // Unbanned successfully
}

// Fungsi untuk mendapatkan daftar user yang diban
function getBannedUsers() {
  const db = loadDatabase();
  const bannedUsers = [];
  const now = new Date();

  for (const userId in db.users) {
    const user = db.users[userId];
    if (user.banned && user.banned.status) {
      // Cek dan unban otomatis jika sudah expired
      if (isBanned(userId)) {
        bannedUsers.push({ id: userId, ...user.banned });
      }
    }
  }
  saveDatabase(db); // Simpan perubahan jika ada unban otomatis
  return bannedUsers;
}

// --- Inventory Functions ---

/**
 * Menambah item ke inventory user.
 * @param {string} userId - ID User.
 * @param {'bait'|'fish'|'tools'|'ores'} category - Kategori item.
 * @param {string} itemId - ID item.
 * @param {number} quantity - Jumlah yang ditambahkan.
 */
function addInventoryItem(userId, category, itemId, quantity) {
  if (category === "tools") {
    console.warn(
      `[DB-WARN] addInventoryItem tidak boleh digunakan untuk 'tools'. Gunakan addToolToInventory.`
    );
    return;
  }

  const db = loadDatabase();
  const user = getUser(userId);
  if (!user.inventory[category]) {
    user.inventory[category] = {};
  }
  user.inventory[category][itemId] =
    (user.inventory[category][itemId] || 0) + quantity;
  db.users[userId] = user;
  saveDatabase(db);
}

/**
 * Menghapus item dari inventory user.
 * @param {string} userId - ID User.
 * @param {'bait'|'fish'|'tools'|'ores'} category - Kategori item.
 * @param {string} itemId - ID item.
 * @param {number} quantity - Jumlah yang dihapus.
 * @returns {boolean} - True jika berhasil, false jika item tidak cukup.
 */
function removeInventoryItem(userId, category, itemId, quantity) {
  if (category === "tools") {
    console.warn(
      `[DB-WARN] removeInventoryItem tidak boleh digunakan untuk 'tools'. Gunakan updateToolDurability atau fungsi spesifik lainnya.`
    );
    return false;
  }

  const db = loadDatabase();
  const user = getUser(userId);
  if (
    !user.inventory[category] ||
    !user.inventory[category][itemId] ||
    user.inventory[category][itemId] < quantity
  ) {
    return false; // Item tidak ada atau tidak cukup
  }
  user.inventory[category][itemId] -= quantity;
  if (user.inventory[category][itemId] <= 0) {
    delete user.inventory[category][itemId];
  }
  db.users[userId] = user;
  saveDatabase(db);
  return true;
}

/**
 * Menambah tool baru ke inventory user dengan durability.
 * @param {string} userId - ID User.
 * @param {object} toolInfo - Informasi tool dari tools.json (harus mengandung id, durability).
 */
function addToolToInventory(userId, toolInfo) {
  const db = loadDatabase();
  const user = getUser(userId);

  const newTool = {
    uniqueId: `${toolInfo.id}_${Date.now()}`, // ID unik untuk setiap item tool
    id: toolInfo.id,
    durability: toolInfo.durability,
    max_durability: toolInfo.durability,
  };

  user.inventory.tools.push(newTool);
  db.users[userId] = user;
  saveDatabase(db);
}

/**
 * Mengurangi durability tool dan menghapusnya jika hancur.
 * @param {string} userId - ID User.
 * @param {string} uniqueToolId - ID unik dari tool yang digunakan.
 * @param {number} amountToDecrease - Jumlah durability yang dikurangi (misal: 1).
 * @returns {{updated: boolean, broke: boolean, brokenToolName: string|null}} - Status pembaruan.
 */
function updateToolDurability(userId, uniqueToolId, amountToDecrease) {
  const db = loadDatabase();
  const user = getUser(userId);
  const toolIndex = user.inventory.tools.findIndex(
    (t) => t.uniqueId === uniqueToolId
  );

  if (toolIndex === -1)
    return { updated: false, broke: false, brokenToolName: null };

  const tool = user.inventory.tools[toolIndex];
  tool.durability -= amountToDecrease;

  let broke = false;
  let brokenToolName = null;
  if (tool.durability <= 0) {
    const toolData = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../lib/rpg/tools.json"), "utf-8")
    );
    brokenToolName = toolData.find((t) => t.id === tool.id)?.name || "Alat";
    user.inventory.tools.splice(toolIndex, 1); // Hapus tool dari inventory
    if (user.equipped.pickaxe === uniqueToolId) user.equipped.pickaxe = null;
    if (user.equipped.fishing_rod === uniqueToolId)
      user.equipped.fishing_rod = null;
    broke = true;
  }

  db.users[userId] = user;
  saveDatabase(db);
  return { updated: true, broke, brokenToolName };
}

/**
 * Menyimpan seluruh objek data user.
 * @param {string} userId - ID User.
 * @param {object} data - Objek data user yang lengkap.
 * @returns {boolean} - True jika berhasil.
 */
function setUserData(userId, data) {
  const db = loadDatabase();
  if (db.users[userId]) {
    db.users[userId] = data;
    return saveDatabase(db);
  }
  return false;
}

// Get user level info
function getLevelInfo(userId) {
  const user = getUser(userId);
  const requiredExp = getRequiredExp(user.level);

  return {
    level: user.level,
    exp: user.exp,
    requiredExp: requiredExp,
    progress: Math.floor((user.exp / requiredExp) * 100),
  };
}

// Check if user is owner
function isOwner(userId) {
  const cleanUserId = userId.replace("@s.whatsapp.net", "");
  return cleanUserId === config.nomorOwner;
}

// Check if user is premium
function isPremium(userId) {
  const user = getUser(userId);
  if (!user.isPremium) return false;

  if (user.premiumExpiry) {
    const now = new Date();
    const expiry = new Date(user.premiumExpiry);
    return now <= expiry;
  }

  return user.isPremium;
}

// Get user status
function getUserStatus(userId) {
  const cleanUserId = userId.replace("@s.whatsapp.net", "");

  if (cleanUserId === config.nomorOwner) {
    return "owner";
  }

  if (isPremium(userId)) {
    return "premium";
  }

  return "free";
}

// Set premium status
function setPremium(userId, duration = 30) {
  const db = loadDatabase();
  const user = getUser(userId);

  const now = new Date();
  let newExpiry;

  if (user.isPremium && user.premiumExpiry) {
    const currentExpiry = new Date(user.premiumExpiry);
    if (currentExpiry > now) {
      newExpiry = new Date(
        currentExpiry.getTime() + duration * 24 * 60 * 60 * 1000
      );
    } else {
      newExpiry = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
    }
  } else {
    newExpiry = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
  }

  user.isPremium = true;
  user.premiumExpiry = newExpiry.toISOString();
  user.limit = 500;

  db.users[userId] = user;
  saveDatabase(db);

  return newExpiry;
}

// Add balance to user
function addBalance(userId, amount) {
  const db = loadDatabase();
  const user = getUser(userId);
  user.balance += amount;
  if (amount > 0) {
    user.totalEarned += amount;
  }
  db.users[userId] = user;
  saveDatabase(db);
  return user.balance;
}

// Add limit to user
function addLimit(userId, amount) {
  const db = loadDatabase();
  const user = getUser(userId);
  user.limit += amount;
  db.users[userId] = user;
  saveDatabase(db);
  return user.limit;
}

// Check if gcOnly mode is enabled
function isGcOnlyEnabled() {
  const db = loadDatabase();
  return db.settings.gcOnly || false;
}

// Check if user can receive gcOnly notification (rate limiting)
function canReceiveGcOnlyNotification(userId) {
  const db = loadDatabase();
  if (!db.users[userId]) {
    getUser(userId); // Initialize user
  }

  const user = db.users[userId];
  const now = Date.now();
  const lastNotification = user.lastGcOnlyNotification || 0;
  const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds

  return now - lastNotification >= thirtyMinutes;
}

// Set gcOnly notification timestamp
function setGcOnlyNotificationTime(userId) {
  const db = loadDatabase();
  if (!db.users[userId]) {
    getUser(userId); // Initialize user
  }

  db.users[userId].lastGcOnlyNotification = Date.now();
  saveDatabase(db);
}

/**
 * Menambah atau memperbarui data sewa grup.
 * @param {string} groupId - ID Grup.
 * @param {number} durationDays - Durasi sewa dalam hari.
 * @param {string} ownerId - ID user yang menyewa.
 * @param {string} welcomeMessage - Pesan selamat datang yang akan dikirim.
 * @returns {Date} - Tanggal kedaluwarsa yang baru.
 */
function addGroupRental(groupId, durationDays, ownerId, welcomeMessage) {
  const db = loadDatabase();
  if (!db.groups) {
    db.groups = {};
  }

  const now = new Date();
  let newExpiry;

  if (db.groups[groupId] && db.groups[groupId].expiry) {
    // Perpanjang sewa yang sudah ada
    const currentExpiry = new Date(db.groups[groupId].expiry);
    if (currentExpiry > now) {
      // Sewa masih aktif, perpanjang dari tanggal expiry
      newExpiry = new Date(
        currentExpiry.getTime() + durationDays * 24 * 60 * 60 * 1000
      );
    } else {
      // Sewa sudah kedaluwarsa, mulai dari sekarang
      newExpiry = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    }
  } else {
    // Sewa baru
    newExpiry = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  }

  db.groups[groupId] = {
    expiry: newExpiry.toISOString(),
    owner: ownerId,
    addedOn: now.toISOString(),
    welcomeMessage: welcomeMessage,
  };

  saveDatabase(db);
  return newExpiry;
}

/**
 * Menghapus data sewa grup.
 * @param {string} groupId - ID Grup.
 * @returns {boolean} - True jika berhasil dihapus.
 */
function removeGroupRental(groupId) {
  const db = loadDatabase();
  if (db.groups && db.groups[groupId]) {
    delete db.groups[groupId];
    return saveDatabase(db);
  }
  return false;
}

/**
 * Menghapus/membersihkan pesan selamat datang dari data sewa grup setelah dikirim.
 * @param {string} groupId - ID Grup.
 * @returns {boolean} - True jika berhasil.
 */
function clearWelcomeMessage(groupId) {
  const db = loadDatabase();
  if (db.groups && db.groups[groupId]) {
    db.groups[groupId].welcomeMessage = null;
    return saveDatabase(db);
  }
  return false;
}

/**
 * Mendapatkan semua data sewa grup.
 * @returns {object} - Objek berisi semua grup yang menyewa.
 */
function getGroupRentals() {
  const db = loadDatabase();
  return db.groups || {};
}

/**
 * Mendapatkan semua data user.
 * @returns {object} - Objek berisi semua user.
 */
function getAllUsers() {
  const db = loadDatabase();
  return db.users || {};
}

export {
  loadDatabase,
  saveDatabase,
  getUser,
  getGroup,
  updateBalance,
  getBalance,
  addGameStats,
  getSettings,
  addExp,
  useLimit,
  hasLimit,
  getLevelInfo,
  getRequiredExp,
  isOwner,
  isPremium,
  getUserStatus,
  setPremium,
  addBalance,
  addLimit,
  isGcOnlyEnabled,
  canReceiveGcOnlyNotification,
  setGcOnlyNotificationTime,
  isBanned,
  banUser,
  unbanUser,
  getBannedUsers,
  addInventoryItem,
  removeInventoryItem,
  addToolToInventory,
  updateToolDurability,
  setUserData,
  addGroupRental,
  removeGroupRental,
  clearWelcomeMessage,
  getGroupRentals,
  getAllUsers,
};
