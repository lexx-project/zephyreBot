import config from "../../config/setting.js";
import { getUser } from "../../utils/database.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Daftar semua file item yang bisa dijual
const itemFiles = {
  baits: path.join(__dirname, "../../lib/rpg/bait.json"),
  tools: path.join(__dirname, "../../lib/rpg/tools.json"),
};

export default {
  name: "shop",
  description: "Menampilkan daftar item yang tersedia di toko.",
  usage: `${config.prefix}shop`,
  category: "rpg",
  cooldown: 5,

  async execute(sock, m, args) {
    const senderId = m.key.participant || m.key.remoteJid;
    const user = getUser(senderId);

    let shopText = `┌───「 🏪 *TOKO ZEPHYRE* 」\n`;
    shopText += `│\n`;
    shopText += `│ Saldo Anda: *${user.balance.toLocaleString()}* 💰\n`;
    shopText += `│\n`;
    shopText += `├─ 🎣 *Umpan Pancing*\n`;

    const baitData = JSON.parse(fs.readFileSync(itemFiles.baits, "utf-8"));
    baitData.forEach((item) => {
      shopText += `│\n`;
      shopText += `├─ ${item.emoji} *${item.name}*\n`;
      shopText += `│  › ID: \`${item.id}\`\n`;
      shopText += `│  › Harga: ${item.price} saldo\n`;
    });

    shopText += `│\n`;
    shopText += `├─ 🛠️ *Peralatan*\n`;

    const toolData = JSON.parse(fs.readFileSync(itemFiles.tools, "utf-8"));
    toolData.forEach((item) => {
      shopText += `│\n`;
      shopText += `├─ ${item.emoji} *${item.name}*\n`;
      shopText += `│  › ID: \`${item.id}\`\n`;
      shopText += `│  › Harga: ${item.price} saldo\n`;
      shopText += `│  › Tipe: ${item.type}\n`;
    });

    shopText += `│\n`;
    shopText += `└─ ⬣ *Cara Beli & Jual:*\n`;
    shopText += `   \`${config.prefix}buy <id_item> <jumlah>\`\n`;
    shopText += `   \`${config.prefix}sell <id_item> <jumlah>\`\n\n`;
    shopText += `   *Contoh:*\n`;
    shopText += `   \`${config.prefix}buy pickaxe_kayu 1\`\n`;
    shopText += `   \`${config.prefix}sell berlian all\``;
    await sock.sendMessage(
      m.key.remoteJid,
      { text: shopText.trim() },
      { quoted: m }
    );
  },
};
