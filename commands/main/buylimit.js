import config from "../../config/setting.js";
import { messageFormatter } from "../../utils/helpers.js";
import {
  getUser,
  updateBalance,
  isOwner,
  getUserStatus,
  addLimit,
} from "../../utils/database.js";

export default {
  name: "buylimit",
  aliases: ["buycommand", "belilimit"],
  description: "Membeli limit tambahan dengan saldo",
  usage: `${config.prefix}buylimit <jumlah>`,
  category: "main",
  cooldown: 5,
  limitExempt: true, // Tidak menggunakan limit
  ownerOnly: false,
  groupOnly: false,
  privateOnly: false,

  async execute(sock, message, args) {
    try {
      const userId = message.key.participant || message.key.remoteJid;
      const user = getUser(userId);

      // Owner tidak perlu membeli limit
      if (isOwner(userId)) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: messageFormatter.warning(
              "👑 Owner memiliki limit unlimited, tidak perlu membeli limit!"
            ),
          },
          { quoted: message }
        );
        return;
      }

      // Validasi input
      if (!args[0] || isNaN(args[0]) || parseInt(args[0]) <= 0) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: `📝 *Penggunaan:* ${config.prefix}buylimit <jumlah>\n💡 *Contoh:* ${config.prefix}buylimit 5\n\n> *Harga:* 1000 Saldo per limit`,
          },
          { quoted: message }
        );
        return;
      }

      const amount = parseInt(args[0]);
      const pricePerLimit = 1000;
      const totalCost = amount * pricePerLimit;

      // Cek saldo mencukupi
      if (user.balance < totalCost) {
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: messageFormatter.warning(
              `💸 *Saldo tidak mencukupi!*\n\n` +
                `💰 *Saldo Anda:* ${user.balance.toLocaleString()}\n` +
                `💳 *Dibutuhkan:* ${totalCost.toLocaleString()}\n` +
                `📊 *Kurang:* ${(
                  totalCost - user.balance
                ).toLocaleString()}\n\n` +
                `🎮 *Tip:* Main game untuk mendapatkan saldo!`
            ),
          },
          { quoted: message }
        );
        return;
      }

      // Cek batas maksimal limit
      const userStatus = getUserStatus(userId);
      const maxLimit = userStatus === "premium" ? 500 : 50;
      const currentLimit = user.limit;
      const newLimit = currentLimit + amount;

      if (newLimit > maxLimit) {
        const availableSlots = maxLimit - currentLimit;
        await sock.sendMessage(
          message.key.remoteJid,
          {
            text: messageFormatter.warning(
              `⚠️ *Melebihi batas maksimal!*\n\n` +
                `📊 *Limit saat ini:* ${currentLimit}/${maxLimit}\n` +
                `🛒 *Ingin beli:* ${amount} limit\n` +
                `❌ *Hasil:* ${newLimit}/${maxLimit} (melebihi batas)\n\n` +
                `✅ *Maksimal bisa beli:* ${availableSlots} limit\n` +
                `💡 *Saran:* ${
                  availableSlots > 0
                    ? `Gunakan ${config.prefix}buylimit ${availableSlots}`
                    : "Limit sudah penuh!"
                }`
            ),
          },
          { quoted: message }
        );
        return;
      }

      // Proses pembelian langsung tanpa konfirmasi
      updateBalance(userId, -totalCost);
      addLimit(userId, amount);

      // Ambil data user yang sudah diupdate
      const updatedUser = getUser(userId);

      const successText =
        `✅ *PEMBELIAN BERHASIL!*\n\n` +
        `🎉 *Selamat!* Anda berhasil membeli ${amount} limit\n` +
        `📊 *Limit baru:* ${updatedUser.limit}/${maxLimit}\n` +
        `💰 *Saldo tersisa:* ${updatedUser.balance.toLocaleString()}\n\n` +
        `🎮 *Sekarang Anda bisa main game lebih banyak!*\n` +
        `📅 *Limit akan reset jam 00:00 WIB*`;

      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: successText,
        },
        { quoted: message }
      );
    } catch (error) {
      console.error("Error in buylimit command:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: messageFormatter.error(
            "Terjadi kesalahan saat memproses pembelian limit!"
          ),
        },
        { quoted: message }
      );
    }
  },
};
