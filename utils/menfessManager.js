import { logger } from "./helpers.js";

// Map ini akan menyimpan sesi menfess yang aktif.
// Key: JID partisipan, Value: object sesi { partnerJid: string }
const menfessSessions = new Map();

// Map ini akan menyimpan permintaan yang tertunda untuk menghindari spam.
// Key: JID target, Value: JID pengirim
const pendingRequests = new Map();

export const menfessManager = {
  /**
   * Membuat permintaan sesi menfess baru yang tertunda.
   * @param {string} senderJid - JID pengguna yang mengirim permintaan.
   * @param {string} targetJid - JID pengguna yang menerima permintaan.
   * @returns {boolean} - True jika permintaan dibuat, false jika target sudah memiliki permintaan tertunda.
   */
  createRequest(senderJid, targetJid) {
    if (pendingRequests.has(targetJid)) {
      return false; // Target sudah memiliki permintaan tertunda.
    }
    pendingRequests.set(targetJid, senderJid);
    return true;
  },

  /**
   * Menerima permintaan menfess dan memulai sesi.
   * @param {string} targetJid - JID pengguna yang menerima.
   * @returns {string|null} - JID pengirim jika berhasil, jika tidak null.
   */
  acceptRequest(targetJid) {
    const senderJid = pendingRequests.get(targetJid);
    if (!senderJid) {
      return null; // Tidak ada permintaan tertunda untuk target ini.
    }

    // Buat sesi dua arah
    menfessSessions.set(senderJid, { partnerJid: targetJid });
    menfessSessions.set(targetJid, { partnerJid: senderJid });

    pendingRequests.delete(targetJid); // Hapus permintaan tertunda
    logger.info(`[MENFESS] Session started between ${senderJid} and ${targetJid}`);
    return senderJid;
  },

  /**
   * Menolak permintaan menfess.
   * @param {string} targetJid - JID pengguna yang menolak.
   * @returns {string|null} - JID pengirim jika berhasil, jika tidak null.
   */
  declineRequest(targetJid) {
    const senderJid = pendingRequests.get(targetJid);
    if (!senderJid) return null;
    pendingRequests.delete(targetJid);
    return senderJid;
  },

  /**
   * Menemukan sesi aktif untuk seorang pengguna.
   * @param {string} userId - JID pengguna.
   * @returns {object|null} - Objek sesi atau null jika tidak dalam sesi.
   */
  findSession(userId) {
    return menfessSessions.get(userId) || null;
  },

  /**
   * Mengakhiri sesi menfess untuk pengguna dan partnernya.
   * @param {string} userId - JID pengguna yang mengakhiri sesi.
   * @returns {string|null} - JID partner jika sesi diakhiri, jika tidak null.
   */
  endSession(userId) {
    const session = this.findSession(userId);
    if (!session) return null;
    const partnerJid = session.partnerJid;
    menfessSessions.delete(userId);
    menfessSessions.delete(partnerJid);
    logger.info(`[MENFESS] Session ended between ${userId} and ${partnerJid}`);
    return partnerJid;
  },
};