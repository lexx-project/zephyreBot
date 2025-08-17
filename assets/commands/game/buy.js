import config from "../../config/setting.js";
import { logger, messageFormatter } from "../../utils/helpers.js";
import {
  getUser,
  updateBalance,
  addInventoryItem,
} from "../../utils/database.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Gabungkan semua item yang bisa dibeli ke dalam satu map
const baitData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../lib/rpg/bait.json"), "utf-8")
);
// Nanti bisa ditambah item lain seperti:
// const toolData = JSON.parse(fs.readFileSync(path.join(__dirname, "../../lib/rpg/tools.json"), "utf-8"));

const allItems = [...baitData];
const itemMap = new Map(
  allItems.map((item) => [item.id, { ...item, type: "bait" }])
); // Tambahkan tipe item

export default {
  name: "buy",
  description: "Membeli item dari toko.",
  usage: `${config.prefix}buy <id_item> <jumlah>`,
  category: "rpg",
  cooldown: 5,

  async execute(sock, m, args) {
    const senderId = m.key.participant || m.key.remoteJid;
    const user = getUser(senderId);

    const itemId = args[0]?.toLowerCase();
    const quantity = parseInt(args[1]);

    if (!itemId || !quantity || quantity <= 0) {
      return await sock.sendMessage(
        m.key.remoteJid,
        {
          text: `Penggunaan salah. Lihat item di *${config.prefix}shop*.\n*Contoh:* ${config.prefix}buy cacing 10`,
        },
        { quoted: m }
      );
    }

    const itemToBuy = itemMap.get(itemId);
    if (!itemToBuy) {
      return await sock.sendMessage(
        m.key.remoteJid,
        { text: `❌ Item dengan ID \`${itemId}\` tidak ditemukan.` },
        { quoted: m }
      );
    }

    const totalCost = itemToBuy.price * quantity;

    if (user.balance < totalCost) {
      return await sock.sendMessage(
        m.key.remoteJid,
        {
          text: `💸 Saldo Anda tidak cukup! Butuh *${totalCost}*, Anda punya *${user.balance}*.`,
        },
        { quoted: m }
      );
    }

    // Proses pembelian
    const newBalance = updateBalance(
      senderId,
      -totalCost,
      `Beli ${itemToBuy.name}`
    );
    addInventoryItem(senderId, itemToBuy.type, itemId, quantity);

    const successText = `✅ *Pembelian Berhasil!*\n\nAnda telah membeli *${quantity} ${itemToBuy.name}* ${itemToBuy.emoji}\nTotal Biaya: *${totalCost} saldo*.\nSisa Saldo: *${newBalance} saldo*.`;

    await sock.sendMessage(
      m.key.remoteJid,
      { text: successText },
      { quoted: m }
    );
    logger.info(`[BUY] ${senderId} membeli ${quantity} ${itemId}`);
  },
};
