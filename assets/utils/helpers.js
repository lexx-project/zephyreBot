import { config } from "../config/setting.js";

/**
 * Utility functions untuk WhatsApp Bot
 */

// Rate limiting untuk mencegah spam
const cooldowns = new Map();
const COOLDOWN_TIME = 3000; // 3 detik

export const rateLimiter = {
  /**
   * Cek apakah user masih dalam cooldown
   * @param {string} userId - ID user
   * @returns {boolean} - true jika masih cooldown
   */
  isOnCooldown(userId) {
    if (cooldowns.has(userId)) {
      const timeLeft = cooldowns.get(userId) - Date.now();
      return timeLeft > 0;
    }
    return false;
  },

  /**
   * Set cooldown untuk user
   * @param {string} userId - ID user
   * @param {number} duration - Durasi cooldown dalam ms (default: 3000)
   */
  setCooldown(userId, duration = COOLDOWN_TIME) {
    cooldowns.set(userId, Date.now() + duration);
  },

  /**
   * Get remaining cooldown time
   * @param {string} userId - ID user
   * @returns {number} - Sisa waktu cooldown dalam ms
   */
  getRemainingTime(userId) {
    if (cooldowns.has(userId)) {
      const timeLeft = cooldowns.get(userId) - Date.now();
      return Math.max(0, timeLeft);
    }
    return 0;
  },
};

// Utility untuk format pesan
export const messageFormatter = {
  /**
   * Format pesan error
   * @param {string} message - Pesan error
   * @returns {string} - Pesan error yang diformat
   */
  error(message) {
    return `❌ *Error:* ${message}`;
  },

  /**
   * Format pesan sukses
   * @param {string} message - Pesan sukses
   * @returns {string} - Pesan sukses yang diformat
   */
  success(message) {
    return `✅ *Sukses:* ${message}`;
  },

  /**
   * Format pesan info
   * @param {string} message - Pesan info
   * @returns {string} - Pesan info yang diformat
   */
  info(message) {
    return `ℹ️ *Info:* ${message}`;
  },

  /**
   * Format pesan warning
   * @param {string} message - Pesan warning
   * @returns {string} - Pesan warning yang diformat
   */
  warning(message) {
    return `⚠️ *Warning:* ${message}`;
  },

  /**
   * Kirim pesan sebagai reply untuk mencegah tenggelam
   * @param {object} sock - Socket WhatsApp
   * @param {string} chatId - ID chat
   * @param {string|object} message - Pesan yang akan dikirim
   * @param {object} originalMessage - Pesan asli untuk direply (optional)
   * @returns {Promise} - Promise hasil pengiriman pesan
   */
  async sendMessage(sock, chatId, message, originalMessage = null) {
    try {
      // Defensive check: if chatId is the full message object, extract the jid.
      // This makes the function more robust against incorrect calls.
      const jid =
        typeof chatId === "object" && chatId.key && chatId.key.remoteJid
          ? chatId.key.remoteJid
          : chatId;

      const messageOptions = {
        text: typeof message === "string" ? message : message.text || "",
      };

      // Jika ada originalMessage, kirim sebagai reply
      if (originalMessage) {
        // Prioritize explicit originalMessage
        messageOptions.quoted = originalMessage;
      } else if (typeof chatId === "object" && chatId.key) {
        // If the full message object was passed as chatId, use it for quoting
        messageOptions.quoted = chatId;
      }

      // Jika message adalah object dengan properties lain, merge
      if (typeof message === "object" && message !== null) {
        Object.assign(messageOptions, message);
      }

      return await sock.sendMessage(jid, messageOptions);
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  },
};

// Utility untuk validasi
export const validator = {
  /**
   * Cek apakah user adalah owner
   * @param {string} userId - ID user
   * @returns {boolean} - true jika user adalah owner
   */
  isOwner(userId) {
    const userNumber = userId.split("@")[0];
    return userNumber === config.nomorOwner;
  },

  /**
   * Cek apakah chat adalah grup
   * @param {string} chatId - ID chat
   * @returns {boolean} - true jika chat adalah grup
   */
  isGroup(chatId) {
    return chatId.endsWith("@g.us");
  },

  /**
   * Cek apakah chat adalah private
   * @param {string} chatId - ID chat
   * @returns {boolean} - true jika chat adalah private
   */
  isPrivate(chatId) {
    return chatId.endsWith("@s.whatsapp.net");
  },

  /**
   * Validasi nomor WhatsApp
   * @param {string} number - Nomor yang akan divalidasi
   * @returns {boolean} - true jika nomor valid
   */
  isValidWhatsAppNumber(number) {
    const cleanNumber = number.replace(/[^0-9]/g, "");
    return cleanNumber.length >= 10 && cleanNumber.length <= 15;
  },
};

// Utility untuk logging
export const logger = {
  /**
   * Log pesan dengan timestamp
   * @param {string} level - Level log (INFO, ERROR, WARNING, DEBUG)
   * @param {string} message - Pesan log
   * @param {any} data - Data tambahan (optional)
   */
  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;

    if (data) {
      console.log(logMessage, data);
    } else {
      console.log(logMessage);
    }
  },

  info(message, data = null) {
    this.log("INFO", message, data);
  },

  error(message, data = null) {
    this.log("ERROR", message, data);
  },

  warning(message, data = null) {
    this.log("WARNING", message, data);
  },

  debug(message, data = null) {
    this.log("DEBUG", message, data);
  },
};

// Utility untuk format waktu
export const timeFormatter = {
  /**
   * Format millisecond ke format yang mudah dibaca
   * @param {number} ms - Millisecond
   * @returns {string} - Waktu yang diformat
   */
  formatMs(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  },

  /**
   * Get timestamp sekarang
   * @returns {string} - Timestamp dalam format ISO
   */
  now() {
    return new Date().toISOString();
  },

  /**
   * Format tanggal ke format Indonesia
   * @param {Date} date - Tanggal
   * @returns {string} - Tanggal yang diformat
   */
  formatDate(date = new Date()) {
    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  },

  /**
   * Format uptime dalam detik ke format yang mudah dibaca
   * @param {number} seconds - Uptime dalam detik
   * @returns {string} - Uptime yang diformat
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0) parts.push(`${secs}s`);

    return parts.length > 0 ? parts.join(" ") : "0s";
  },
};

// Utility untuk string
export const stringUtils = {
  /**
   * Capitalize first letter
   * @param {string} str - String input
   * @returns {string} - String dengan huruf pertama kapital
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  /**
   * Truncate string jika terlalu panjang
   * @param {string} str - String input
   * @param {number} maxLength - Panjang maksimal
   * @returns {string} - String yang dipotong
   */
  truncate(str, maxLength = 100) {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + "...";
  },

  /**
   * Clean string dari karakter khusus
   * @param {string} str - String input
   * @returns {string} - String yang dibersihkan
   */
  clean(str) {
    return str.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  },
};

export default {
  rateLimiter,
  messageFormatter,
  validator,
  logger,
  timeFormatter,
  stringUtils,
};
