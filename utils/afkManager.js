import { timeFormatter } from "./helpers.js";

const afkUsers = new Map();

/**
 * Generates a unique key for the AFK map.
 * @param {string} chatId - The group ID.
 * @param {string} userId - The user ID.
 * @returns {string} - The unique key.
 */
function getKey(chatId, userId) {
  return `${chatId}_${userId}`;
}

/**
 * Sets a user's AFK status.
 * @param {string} chatId - The group ID.
 * @param {string} userId - The user ID.
 * @param {string} reason - The reason for being AFK.
 */
function setAfk(chatId, userId, reason) {
  const key = getKey(chatId, userId);
  afkUsers.set(key, {
    reason: reason,
    time: Date.now(),
  });
}

/**
 * Removes a user's AFK status.
 * @param {string} chatId - The group ID.
 * @param {string} userId - The user ID.
 * @returns {object|null} - The AFK data if the user was AFK, otherwise null.
 */
function removeAfk(chatId, userId) {
  const key = getKey(chatId, userId);
  if (afkUsers.has(key)) {
    const data = afkUsers.get(key);
    afkUsers.delete(key);
    return data;
  }
  return null;
}

/**
 * Gets a user's AFK data.
 * @param {string} chatId - The group ID.
 * @param {string} userId - The user ID.
 * @returns {object|null} - The AFK data if the user is AFK, otherwise null.
 */
function getAfkData(chatId, userId) {
  const key = getKey(chatId, userId);
  return afkUsers.get(key) || null;
}

export const afkManager = {
  setAfk,
  removeAfk,
  isAfk: (chatId, userId) => afkUsers.has(getKey(chatId, userId)),
  getAfkData,
};
