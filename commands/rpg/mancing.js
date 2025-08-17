import config from "../../config/setting.js";
import { logger } from "../../utils/helpers.js";
import {
  getUser,
  removeInventoryItem,
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
const baitData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../lib/rpg/bait.json"), "utf-8")
);
const fishData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../lib/rpg/fish.json"), "utf-8")
);
const toolData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../lib/rpg/tools.json"), "utf-8")
);
const toolMap = new Map(toolData.map((t) => [t.id, t]));

const fishingCooldowns = new Map();

export default {
  name: "mancing",
  description: "Memancing ikan menggunakan umpan.",
  usage: `${config.prefix}mancing <nama_umpan>`,
  category: "rpg",
  cooldown: 7, // Cooldown per user 7 detik

  async execute(sock, m, args) {
    const senderId = m.key.participant || m.key.remoteJid;
    const senderName = m.pushName || "User";
    const user = getUser(senderId);

    // Cek cooldown mancing
    if (fishingCooldowns.has(senderId)) {
      const timeLeft = fishingCooldowns.get(senderId) - Date.now();
      if (timeLeft > 0) {
        return await sock.sendMessage(
          m.key.remoteJid,
          {
            text: `⏳ Sabar, Anda baru saja memancing. Tunggu ${Math.ceil(
              timeLeft / 1000
            )} detik lagi.`,
          },
          { quoted: m }
        );
      }
    }

    // Cek apakah pancingan terpasang
    const equippedRodUniqueId = user.equipped.fishing_rod;
    if (!equippedRodUniqueId) {
      const userRods = user.inventory.tools.filter(
        (tool) => toolMap.get(tool.id)?.type === "fishing_rod"
      );

      if (userRods.length > 0) {
        const firstRod = toolMap.get(userRods[0].id);
        return await sock.sendMessage(
          m.key.remoteJid,
          {
            text: `❌ Anda belum memasang pancingan!\n\nAnda punya *${firstRod.name}* di tas. Pasang dengan command:\n\`${config.prefix}equip ${firstRod.id}\``,
          },
          { quoted: m }
        );
      } else {
        return await sock.sendMessage(
          m.key.remoteJid,
          {
            text: `❌ Anda tidak punya pancingan!\n\nBeli dulu di toko dengan command \`${config.prefix}shop\` lalu \`${config.prefix}buy <id_pancingan> 1\`.`,
          },
          { quoted: m }
        );
      }
    }

    const rodInstance = user.inventory.tools.find(
      (t) => t.uniqueId === equippedRodUniqueId
    );

    if (!rodInstance) {
      // Inkonsistensi data, alat yang terpasang tidak ada di tas.
      user.equipped.fishing_rod = null;
      setUserData(senderId, user);
      return await sock.sendMessage(
        m.key.remoteJid,
        {
          text: `❌ Pancingan yang Anda pasang tidak ditemukan di tas. Silakan pasang ulang.`,
        },
        { quoted: m }
      );
    }

    const baitId = args[0]?.toLowerCase();
    if (!baitId) {
      let usageText = `Penggunaan: ${this.usage}\n\n*Umpan yang tersedia:*\n`;
      baitData.forEach((b) => (usageText += `- \`${b.id}\` (${b.name})\n`));
      return await sock.sendMessage(
        m.key.remoteJid,
        { text: usageText.trim() },
        { quoted: m }
      );
    }

    const baitUsed = baitData.find((b) => b.id === baitId);
    if (!baitUsed) {
      return await sock.sendMessage(
        m.key.remoteJid,
        { text: `❌ Umpan dengan ID \`${baitId}\` tidak ditemukan.` },
        { quoted: m }
      );
    }

    // Cek dan gunakan umpan
    if (!removeInventoryItem(senderId, "bait", baitId, 1)) {
      return await sock.sendMessage(
        m.key.remoteJid,
        {
          text: `🪱 Anda tidak punya ${baitUsed.name}. Beli dulu dengan *${config.prefix}buy ${baitId} 1*.`,
        },
        { quoted: m }
      );
    }

    // Set cooldown
    const cooldownTime = (Math.random() * 3 + 5) * 1000; // Cooldown dinamis 5-8 detik
    fishingCooldowns.set(senderId, Date.now() + cooldownTime);

    await sock.sendMessage(
      m.key.remoteJid,
      {
        text: `🎣 *${senderName}* melempar pancing dengan *${baitUsed.name}*...`,
      },
      { quoted: m }
    );

    // Logika menangkap ikan
    setTimeout(async () => {
      try {
        // Kurangi durability pancingan
        const durabilityResult = updateToolDurability(
          senderId,
          equippedRodUniqueId,
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
          return; // Hentikan proses karena pancingan hancur
        }

        const rodInfo = toolMap.get(rodInstance.id);
        const luck = Math.random() + (rodInfo.luck_bonus || 0);
        let fishRarity;

        // Tentukan kelangkaan ikan berdasarkan umpan
        const baitProbabilities = {
          lumut: {
            trash: 0.25,
            common: 0.68,
            uncommon: 0.07,
            rare: 0,
            legendary: 0,
          },
          pelet: {
            trash: 0.3,
            common: 0.65,
            uncommon: 0.05,
            rare: 0,
            legendary: 0,
          },
          cacing: {
            trash: 0.2,
            common: 0.6,
            uncommon: 0.2,
            rare: 0,
            legendary: 0,
          },
          udang: {
            trash: 0.1,
            common: 0.4,
            uncommon: 0.45,
            rare: 0.05,
            legendary: 0,
          },
          premium: {
            trash: 0.05,
            common: 0.15,
            uncommon: 0.5,
            rare: 0.29,
            legendary: 0.01,
          },
          legendaris: {
            trash: 0,
            common: 0,
            uncommon: 0.2,
            rare: 0.7,
            legendary: 0.1,
          },
        };

        const probs = baitProbabilities[baitId] || baitProbabilities.cacing;
        if (luck < probs.trash) fishRarity = "trash";
        else if (luck < probs.trash + probs.common) fishRarity = "common";
        else if (luck < probs.trash + probs.common + probs.uncommon)
          fishRarity = "uncommon";
        else if (
          luck <
          probs.trash + probs.common + probs.uncommon + probs.rare
        )
          fishRarity = "rare";
        else fishRarity = "legendary";

        const possibleFish = fishData.filter((f) => f.rarity === fishRarity);
        if (possibleFish.length === 0) {
          // Fallback jika tidak ada ikan di rarity tsb
          const fallbackFish = fishData.find((f) => f.rarity === "common");
          possibleFish.push(fallbackFish);
        }

        const caughtFish =
          possibleFish[Math.floor(Math.random() * possibleFish.length)];

        // Tambahkan ikan ke inventory
        addInventoryItem(senderId, "fish", caughtFish.id, 1);
        addGameStats(senderId);

        let resultText = `🎉 *Berhasil!* Anda mendapatkan:\n\n`;
        resultText += `${caughtFish.emoji} *${caughtFish.name}*\n`;
        resultText += `Rarity: ${
          caughtFish.rarity.charAt(0).toUpperCase() + caughtFish.rarity.slice(1)
        }`;

        await sock.sendMessage(
          m.key.remoteJid,
          { text: resultText },
          { quoted: m }
        );
        logger.info(`[MANCING] ${senderId} menangkap ${caughtFish.name}`);
      } catch (error) {
        logger.error("Error during fishing result:", error);
        await sock.sendMessage(
          m.key.remoteJid,
          { text: "❌ Terjadi kesalahan saat menarik pancing." },
          { quoted: m }
        );
      }
    }, Math.floor(Math.random() * 3000) + 2000); // Delay random 2-5 detik
  },
};
