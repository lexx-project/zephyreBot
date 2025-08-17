import config from "../../config/setting.js";
import { logger } from "../../utils/helpers.js";
import {
  getUser,
  addInventoryItem,
  addGameStats,
  updateToolDurability,
  setUserData,
} from "../../utils/database.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const toolData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../lib/rpg/tools.json"), "utf-8")
);
const oreData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../lib/rpg/ores.json"), "utf-8")
);

const toolMap = new Map(toolData.map((t) => [t.id, t]));
const miningCooldowns = new Map();

export default {
  name: "mining",
  aliases: ["tambang", "nambang"],
  description: "Menambang bijih dan batu berharga menggunakan pickaxe.",
  usage: `${config.prefix}mining`,
  category: "rpg",
  cooldown: 10, // Cooldown per user 10 detik

  async execute(sock, m, args) {
    const senderId = m.key.participant || m.key.remoteJid;
    const senderName = m.pushName || "User";
    const user = getUser(senderId);
    const inventory = user.inventory;

    // Cek cooldown
    if (miningCooldowns.has(senderId)) {
      const timeLeft = miningCooldowns.get(senderId) - Date.now();
      if (timeLeft > 0) {
        return await sock.sendMessage(
          m.key.remoteJid,
          {
            text: `⏳ Sabar, Anda baru saja menambang. Tunggu ${Math.ceil(
              timeLeft / 1000
            )} detik lagi.`,
          },
          { quoted: m }
        );
      }
    }

    // Cek apakah pickaxe terpasang
    const equippedPickaxeUniqueId = user.equipped.pickaxe;
    if (!equippedPickaxeUniqueId) {
      // Cek apakah user punya pickaxe di tas
      const userPickaxes = inventory.tools.filter(
        (tool) => toolMap.get(tool.id)?.type === "pickaxe"
      );

      if (userPickaxes.length > 0) {
        // User punya pickaxe tapi belum dipasang
        const firstPickaxe = toolMap.get(userPickaxes[0].id);
        return await sock.sendMessage(
          m.key.remoteJid,
          {
            text: `❌ Anda belum memasang pickaxe!\n\nAnda punya *${firstPickaxe.name}* di tas. Pasang dengan command:\n\`${config.prefix}equip ${firstPickaxe.id}\``,
          },
          { quoted: m }
        );
      } else {
        // User tidak punya pickaxe sama sekali
        return await sock.sendMessage(
          m.key.remoteJid,
          {
            text: `❌ Anda tidak punya pickaxe untuk menambang!\n\nBeli dulu di toko dengan command \`${config.prefix}shop\` lalu \`${config.prefix}buy <id_pickaxe> 1\`.`,
          },
          { quoted: m }
        );
      }
    }

    const pickaxeInstance = inventory.tools.find(
      (t) => t.uniqueId === equippedPickaxeUniqueId
    );

    if (!pickaxeInstance) {
      // Inkonsistensi data, alat yang terpasang tidak ada di tas.
      // Hapus dari slot terpasang dan beri tahu pengguna.
      user.equipped.pickaxe = null;
      setUserData(senderId, user);
      return await sock.sendMessage(
        m.key.remoteJid,
        {
          text: `❌ Pickaxe yang Anda pasang tidak ditemukan di tas. Silakan pasang ulang.`,
        },
        { quoted: m }
      );
    }

    const pickaxeInfo = toolMap.get(pickaxeInstance.id);

    // Set cooldown
    const cooldownTime = (Math.random() * 4 + 8) * 1000; // Cooldown dinamis 8-12 detik
    miningCooldowns.set(senderId, Date.now() + cooldownTime);

    await sock.sendMessage(
      m.key.remoteJid,
      {
        text: `⛏️ *${senderName}* mulai menambang dengan *${pickaxeInfo.name}*...`,
      },
      { quoted: m }
    );

    // Logika mendapatkan bijih
    setTimeout(async () => {
      try {
        // Kurangi durability
        const durabilityResult = updateToolDurability(
          senderId,
          equippedPickaxeUniqueId,
          1
        );

        if (durabilityResult.broke) {
          await sock.sendMessage(
            m.key.remoteJid,
            {
              text: `💥 Oh tidak! *${durabilityResult.brokenToolName}* Anda hancur!`,
            },
            { quoted: m }
          );
          return; // Hentikan proses menambang karena alat hancur
        }

        const luck = Math.random() + (pickaxeInfo.luck_bonus || 0);
        let oreRarity;

        // Tentukan kelangkaan bijih berdasarkan pickaxe
        // Target Peluang: Sampah/Murah: ~70%, Medium: ~25%, Langka: ~5%
        const probabilities = {
          pickaxe_kayu: {
            trash: 0.55, // Total Murah/Sampah: 75%
            common: 0.2,
            uncommon: 0.2, // Total Medium: 24%
            rare: 0.04,
            legendary: 0.01, // Total Langka: 1%
          },
          pickaxe_batu: {
            trash: 0.4, // Total Murah/Sampah: 70%
            common: 0.3,
            uncommon: 0.2, // Total Medium: 27%
            rare: 0.07,
            legendary: 0.03, // Total Langka: 3%
          },
          pickaxe_besi: {
            trash: 0.25, // Total Murah/Sampah: 65%
            common: 0.4,
            uncommon: 0.2, // Total Medium: 30%
            rare: 0.1,
            legendary: 0.05, // Total Langka: 5%
          },
        };

        const probs =
          probabilities[pickaxeInstance.id] || probabilities.pickaxe_kayu;
        if (luck < probs.trash) oreRarity = "trash";
        else if (luck < probs.trash + probs.common) oreRarity = "common";
        else if (luck < probs.trash + probs.common + probs.uncommon)
          oreRarity = "uncommon";
        else if (
          luck <
          probs.trash + probs.common + probs.uncommon + probs.rare
        )
          oreRarity = "rare";
        else oreRarity = "legendary";

        const possibleOres = oreData.filter((o) => o.rarity === oreRarity);
        if (possibleOres.length === 0) {
          possibleOres.push(oreData.find((o) => o.rarity === "trash"));
        }

        const caughtOre =
          possibleOres[Math.floor(Math.random() * possibleOres.length)];

        // Tambahkan bijih ke inventory
        addInventoryItem(senderId, "ores", caughtOre.id, 1);
        addGameStats(senderId);

        let resultText = `🎉 *Berhasil!* Anda mendapatkan:\n\n`;
        resultText += `${caughtOre.emoji} *${caughtOre.name}*\n`;
        resultText += `Kelangkaan: ${
          caughtOre.rarity.charAt(0).toUpperCase() + caughtOre.rarity.slice(1)
        }`;

        await sock.sendMessage(
          m.key.remoteJid,
          { text: resultText },
          { quoted: m }
        );
        logger.info(`[MINING] ${senderId} mendapatkan ${caughtOre.name}`);
      } catch (error) {
        logger.error("Error during mining result:", error);
        await sock.sendMessage(
          m.key.remoteJid,
          { text: "❌ Terjadi kesalahan saat menambang." },
          { quoted: m }
        );
      }
    }, Math.floor(Math.random() * 4000) + 3000); // Delay random 3-7 detik
  },
};
