import config from "../../config/setting.js";
import { logger } from "../../utils/helpers.js";
import {
  getUser,
  updateBalance,
  addInventoryItem,
  addToolToInventory,
} from "../../utils/database.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Load all purchasable items ---
const baitData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../lib/rpg/bait.json"), "utf-8")
);
const toolData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../lib/rpg/tools.json"), "utf-8")
);

// Gabungkan semua item yang bisa dibeli ke dalam satu map
const baitItems = baitData.map((b) => ({ ...b, category: "bait" }));
const toolItems = toolData.map((t) => ({ ...t, category: "tools" }));
const itemMap = new Map([...baitItems, ...toolItems].map((i) => [i.id, i]));

export default {
  name: "buy",
  description: "Membeli item dari toko.",
  usage: `${config.prefix}buy <id_item> <jumlah>`,
  category: "rpg",
  cooldown: 5,

  async execute(sock, m, args) {
    try {
      const senderId = m.key.participant || m.key.remoteJid;
      const user = getUser(senderId);

      const itemId = args[0]?.toLowerCase();
      const buyAmount = args[1];

      if (!itemId || !buyAmount) {
        return await sock.sendMessage(
          m.key.remoteJid,
          {
            text: `Penggunaan: ${this.usage}\nContoh: ${config.prefix}buy cacing 10`,
          },
          { quoted: m }
        );
      }

      const itemToBuy = itemMap.get(itemId);
      if (!itemToBuy) {
        return await sock.sendMessage(
          m.key.remoteJid,
          { text: `❌ Item dengan ID \`${itemId}\` tidak ditemukan di toko.` },
          { quoted: m }
        );
      }

      const quantityToBuy = parseInt(buyAmount);
      if (isNaN(quantityToBuy) || quantityToBuy <= 0) {
        return await sock.sendMessage(
          m.key.remoteJid,
          { text: `❌ Jumlah tidak valid.` },
          { quoted: m }
        );
      }

      const totalCost = itemToBuy.price * quantityToBuy;

      if (user.balance < totalCost) {
        return await sock.sendMessage(
          m.key.remoteJid,
          {
            text: `❌ Saldo Anda tidak cukup! Butuh *${totalCost}*, Anda hanya punya *${user.balance}*.`,
          },
          { quoted: m }
        );
      }

      // Proses transaksi
      if (itemToBuy.category === "tools") {
        for (let i = 0; i < quantityToBuy; i++) {
          addToolToInventory(senderId, itemToBuy);
        }
      } else {
        addInventoryItem(senderId, itemToBuy.category, itemId, quantityToBuy);
      }
      const newBalance = updateBalance(
        senderId,
        -totalCost,
        `Beli ${quantityToBuy} ${itemToBuy.name}`
      );

      const successText = `🛒 *Pembelian Berhasil!*\n\nAnda telah membeli *${quantityToBuy} ${itemToBuy.name}* ${itemToBuy.emoji}\nTotal Biaya: *${totalCost} saldo*.\n\nSaldo Anda sekarang: *${newBalance} saldo*.`;
      await sock.sendMessage(
        m.key.remoteJid,
        { text: successText },
        { quoted: m }
      );
      logger.info(
        `[BUY] ${senderId} membeli ${quantityToBuy} ${itemId} seharga ${totalCost}`
      );
    } catch (error) {
      logger.error("Error in buy command:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "❌ Terjadi kesalahan saat membeli item." },
        { quoted: m }
      );
    }
  },
};
