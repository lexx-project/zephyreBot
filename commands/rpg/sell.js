import config from "../../config/setting.js";
import { logger } from "../../utils/helpers.js";
import {
  getUser,
  updateBalance,
  removeInventoryItem,
} from "../../utils/database.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fishData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../lib/rpg/fish.json"), "utf-8")
);
const oreData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../lib/rpg/ores.json"), "utf-8")
);

// Gabungkan semua item yang bisa dijual ke dalam satu map
const fishItems = fishData.map((f) => ({
  ...f,
  category: "fish",
  type: "Ikan",
}));
const oreItems = oreData.map((o) => ({
  ...o,
  category: "ores",
  type: "Bijih",
}));
const itemMap = new Map([...fishItems, ...oreItems].map((i) => [i.id, i]));

export default {
  name: "sell",
  description: "Menjual item dari inventaris untuk mendapatkan saldo.",
  usage: `${config.prefix}sell <id_item> <jumlah|all>`,
  category: "rpg",
  cooldown: 10,

  async execute(sock, m, args) {
    try {
      const senderId = m.key.participant || m.key.remoteJid;
      const user = getUser(senderId);
      const inventory = user.inventory;

      const itemId = args[0]?.toLowerCase();
      const sellAmount = args[1]?.toLowerCase();

      if (!itemId || !sellAmount) {
        let usageText = `Penggunaan: ${this.usage}\n\n*Item yang bisa dijual (dari tas Anda):*\n`;
        let hasItems = false;

        if (inventory.fish && Object.keys(inventory.fish).length > 0) {
          usageText += "\n*Ikan:*\n";
          for (const [id, qty] of Object.entries(inventory.fish)) {
            const item = itemMap.get(id);
            if (item)
              usageText += `- ${item.emoji} ${item.name} (ID: \`${item.id}\`) - Anda punya: ${qty}\n`;
            hasItems = true;
          }
        }
        if (inventory.ores && Object.keys(inventory.ores).length > 0) {
          usageText += "\n*Bijih & Batu:*\n";
          for (const [id, qty] of Object.entries(inventory.ores)) {
            const item = itemMap.get(id);
            if (item)
              usageText += `- ${item.emoji} ${item.name} (ID: \`${item.id}\`) - Anda punya: ${qty}\n`;
            hasItems = true;
          }
        }
        if (!hasItems)
          usageText += "   - Anda tidak punya item untuk dijual.\n";

        usageText += `\n*Contoh:* ${config.prefix}sell lele 5`;
        return await sock.sendMessage(
          m.key.remoteJid,
          { text: usageText.trim() },
          { quoted: m }
        );
      }

      const itemToSell = itemMap.get(itemId);
      if (!itemToSell) {
        return await sock.sendMessage(
          m.key.remoteJid,
          { text: `❌ Item dengan ID \`${itemId}\` tidak ditemukan.` },
          { quoted: m }
        );
      }

      const category = itemToSell.category;
      const userItemQty = inventory[category]?.[itemId] || 0;
      if (userItemQty === 0) {
        return await sock.sendMessage(
          m.key.remoteJid,
          { text: `❌ Anda tidak punya ${itemToSell.name} untuk dijual.` },
          { quoted: m }
        );
      }

      let quantityToSell;
      if (sellAmount === "all") {
        quantityToSell = userItemQty;
      } else {
        quantityToSell = parseInt(sellAmount);
        if (isNaN(quantityToSell) || quantityToSell <= 0) {
          return await sock.sendMessage(
            m.key.remoteJid,
            { text: `❌ Jumlah tidak valid.` },
            { quoted: m }
          );
        }
        if (quantityToSell > userItemQty) {
          return await sock.sendMessage(
            m.key.remoteJid,
            { text: `❌ Anda hanya punya ${userItemQty} ${itemToSell.name}.` },
            { quoted: m }
          );
        }
      }

      // Hitung pendapatan dengan harga acak antara min dan max
      let totalEarnings = 0;
      for (let i = 0; i < quantityToSell; i++) {
        totalEarnings +=
          Math.floor(
            Math.random() * (itemToSell.max_price - itemToSell.min_price + 1)
          ) + itemToSell.min_price;
      }

      // Proses transaksi
      removeInventoryItem(senderId, category, itemId, quantityToSell);
      const newBalance = updateBalance(
        senderId,
        totalEarnings,
        `Jual ${quantityToSell} ${itemToSell.name}`
      );

      const successText = `💰 *Penjualan Berhasil!*\n\nAnda telah menjual *${quantityToSell} ${itemToSell.name}* ${itemToSell.emoji}\nTotal Pendapatan: *${totalEarnings} saldo*.\n\nSaldo Anda sekarang: *${newBalance} saldo*.`;
      await sock.sendMessage(
        m.key.remoteJid,
        { text: successText },
        { quoted: m }
      );
      logger.info(
        `[SELL] ${senderId} menjual ${quantityToSell} ${itemId} seharga ${totalEarnings}`
      );
    } catch (error) {
      logger.error("Error in sell command:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "❌ Terjadi kesalahan saat menjual item." },
        { quoted: m }
      );
    }
  },
};
