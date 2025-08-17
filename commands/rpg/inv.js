import config from "../../config/setting.js";
import { logger } from "../../utils/helpers.js";
import { getUser } from "../../utils/database.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baitData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../lib/rpg/bait.json"), "utf-8")
);
const fishData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../lib/rpg/fish.json"), "utf-8")
);
const oreData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../lib/rpg/ores.json"), "utf-8")
);
const toolData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../lib/rpg/tools.json"), "utf-8")
);

const baitMap = new Map(baitData.map((b) => [b.id, b]));
const fishMap = new Map(fishData.map((f) => [f.id, f]));
const oreMap = new Map(oreData.map((o) => [o.id, o]));
const toolMap = new Map(toolData.map((t) => [t.id, t]));

export default {
  name: "inv",
  aliases: ["inventory", "tas"],
  description: "Melihat isi tas/inventaris RPG Anda.",
  usage: `${config.prefix}inv`,
  category: "rpg",
  cooldown: 5,

  async execute(sock, m, args) {
    const senderId = m.key.participant || m.key.remoteJid;
    const user = getUser(senderId);
    const inventory = user.inventory;
    const equipped = user.equipped;

    let invText = `*${m.pushName || "User"} Inventory* 🎒\n\n`;

    // Tampilkan Peralatan yang Dipakai
    const equippedRodData = equipped.fishing_rod
      ? inventory.tools.find((t) => t.uniqueId === equipped.fishing_rod)
      : null;
    const equippedPickaxeData = equipped.pickaxe
      ? inventory.tools.find((t) => t.uniqueId === equipped.pickaxe)
      : null;

    invText += `*Pancingan Terpasang:* ${
      equippedRodData
        ? `${toolMap.get(equippedRodData.id).emoji} ${
            toolMap.get(equippedRodData.id).name
          } (${equippedRodData.durability}/${equippedRodData.max_durability})`
        : "Tidak ada"
    }\n`;
    invText += `*Pickaxe Terpasang:* ${
      equippedPickaxeData
        ? `${toolMap.get(equippedPickaxeData.id).emoji} ${
            toolMap.get(equippedPickaxeData.id).name
          } (${equippedPickaxeData.durability}/${
            equippedPickaxeData.max_durability
          })`
        : "Tidak ada"
    }\n\n`;

    // Tampilkan Umpan
    invText += "🪱 *Umpan:*\n";
    if (inventory.bait && Object.keys(inventory.bait).length > 0) {
      for (const [id, qty] of Object.entries(inventory.bait)) {
        const bait = baitMap.get(id);
        if (bait) {
          invText += `   - ${bait.emoji} ${bait.name}: ${qty} buah\n`;
        }
      }
    } else {
      invText += "   - Kosong\n";
    }

    invText += "\n";

    // Tampilkan Ikan
    invText += "🐟 *Ikan:*\n";
    if (inventory.fish && Object.keys(inventory.fish).length > 0) {
      for (const [id, qty] of Object.entries(inventory.fish)) {
        const fish = fishMap.get(id);
        if (fish) {
          invText += `   - ${fish.emoji} ${fish.name}: ${qty} ekor\n`;
        }
      }
    } else {
      invText += "   - Kosong\n";
    }

    invText += "\n";

    // Tampilkan Ores
    invText += "💎 *Bijih & Batu Mulia:*\n";
    if (inventory.ores && Object.keys(inventory.ores).length > 0) {
      for (const [id, qty] of Object.entries(inventory.ores)) {
        const ore = oreMap.get(id);
        if (ore) {
          invText += `   - ${ore.emoji} ${ore.name}: ${qty} buah\n`;
        }
      }
    } else {
      invText += "   - Kosong\n";
    }
    invText += "\n";

    // Tampilkan Peralatan
    invText += "🛠️ *Peralatan:*\n";
    if (inventory.tools && inventory.tools.length > 0) {
      for (const toolInstance of inventory.tools) {
        const toolInfo = toolMap.get(toolInstance.id);
        if (toolInfo) {
          invText += `   - ${toolInfo.emoji} ${toolInfo.name} (${toolInstance.durability}/${toolInstance.max_durability})\n`;
        }
      }
    } else {
      invText += "   - Kosong\n";
    }

    await sock.sendMessage(
      m.key.remoteJid,
      { text: invText.trim() },
      { quoted: m }
    );
  },
};
