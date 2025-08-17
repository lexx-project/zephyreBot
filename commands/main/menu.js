import config from "../../config/setting.js";
import {
  timeFormatter,
  logger,
  messageFormatter,
} from "../../utils/helpers.js";
import { getUser, getUserStatus, getLevelInfo } from "../../utils/database.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  name: "menu",
  description: "Menampilkan menu utama bot dengan informasi user dan bot",
  usage: ".menu",
  category: "info",
  cooldown: 3,
  ownerOnly: false,
  limitExempt: true, // Tidak menggunakan limit
  groupOnly: false,
  privateOnly: false,

  async execute(sock, message, args) {
    try {
      const sender = message.key.participant || message.key.remoteJid;
      const senderNumber = sender.split("@")[0];

      // Fungsi untuk menghitung total fitur secara asinkron
      async function countFeatures() {
        const commandsPath = path.join(__dirname, "../../commands");
        let total = 0;
        try {
          const categories = await fs.readdir(commandsPath);
          for (const category of categories) {
            const categoryPath = path.join(commandsPath, category);
            try {
              const stat = await fs.stat(categoryPath);
              if (stat.isDirectory()) {
                const files = await fs.readdir(categoryPath);
                total += files.filter((file) => file.endsWith(".js")).length;
              } else if (stat.isFile() && category.endsWith(".js")) {
                total += 1; // Hitung file di root folder commands
              }
            } catch (err) {
              // Abaikan jika tidak bisa membaca sub-direktori/file
            }
          }
        } catch (error) {
          logger.error("❌ Error saat menghitung total fitur:", error);
          return 0; // Kembalikan 0 jika direktori utama tidak ada
        }
        return total;
      }

      const totalFitur = await countFeatures();

      // Hitung runtime bot
      const uptime = process.uptime();
      const runtime = timeFormatter.formatUptime(uptime);

      // Data user dari database
      const user = getUser(sender);
      const userStatus = getUserStatus(sender);
      const levelInfo = getLevelInfo(sender);

      // Pastikan data user valid
      const userLevel = user?.level || 1;
      const userExp = user?.exp || 0;
      const userBalance = user?.balance || 0;
      const requiredExp = levelInfo?.requiredExp || 100;

      // Fungsi baru untuk mendapatkan rank dinamis dari level
      function getRankFromLevel(level) {
        const rankTiers = [
          { name: "Warrior", emoji: "🥉" }, // Level 1-10
          { name: "Elite", emoji: "🥈" }, // Level 11-20
          { name: "Master", emoji: "🏅" }, // Level 21-30
          { name: "Grandmaster", emoji: "🎖️" }, // Level 31-40
          { name: "Epic", emoji: "⚔️" }, // Level 41-50
          { name: "Legend", emoji: "🛡️" }, // Level 51-60
          { name: "Mythic", emoji: "🔮" }, // Level 61-70
          { name: "Mythical Honor", emoji: "✨" }, // Level 71-80
          { name: "Mythical Glory", emoji: "🌟" }, // Level 81-90
          { name: "Mythical Immortal", emoji: "🔱" }, // Level 91-100
          { name: "Celestial", emoji: "🌌" }, // Level 101+
        ];

        if (level <= 0) return "Unranked";

        // Tentukan tier utama berdasarkan blok 10 level
        const tierIndex = Math.floor((level - 1) / 10);
        const tier = rankTiers[Math.min(tierIndex, rankTiers.length - 1)];

        // Tentukan sub-rank (1-5) di dalam tier tersebut (setiap 2 level naik)
        const subRank = Math.floor(((level - 1) % 10) / 2) + 1;

        return `${tier.name} ${subRank} ${tier.emoji}`;
      }

      // Tentukan rank berdasarkan status dan level
      let rank;
      if (userStatus === "owner") {
        rank = "The Creator 👑";
      } else {
        // Untuk user Premium dan Free, rank ditentukan oleh level
        rank = getRankFromLevel(userLevel);
      }

      const userData = {
        username: senderNumber,
        saldo: userBalance.toLocaleString(),
        rank: rank,
        level: userLevel.toString(),
        exp: `${userExp}/${requiredExp}`,
      };

      // Daftar menu untuk tombol
      const menuButtonsData = [
        { id: "mainmenu", text: "📖 MAIN MENU" },
        { id: "ownermenu", text: "👑 OWNER MENU" },
        { id: "downloadmenu", text: "📥 DOWNLOAD MENU" },
        { id: "groupmenu", text: "👥 GROUP MENU" },
        { id: "stickermenu", text: "🎨 STICKER MENU" },
        { id: "aimenu", text: "🤖 AI MENU" },
        { id: "othermenu", text: "⚙️ OTHER MENU" },
        { id: "gamemenu", text: "🎮 GAME MENU" },
        { id: "rpgmenu", text: "⚔️ RPG MENU" },
        { id: "funmenu", text: "😂 FUN MENU" },
      ];

      // Buat tombol interaktif dengan list menu (Native Flow)
      const buttons = [
        {
          buttonId: "show_menu_list", // ID ini tidak dieksekusi, hanya sebagai placeholder
          buttonText: {
            displayText: "📜 LIHAT SEMUA MENU",
          },
          type: 4, // Tipe untuk Native Flow Message
          nativeFlowInfo: {
            name: "single_select",
            paramsJson: JSON.stringify({
              title: `📜 Daftar Menu ${config.namaBot}`,
              sections: [
                {
                  title: "Silakan pilih salah satu kategori di bawah ini",
                  rows: menuButtonsData.map((btn) => {
                    const [emoji, ...textParts] = btn.text.split(" ");
                    const title = textParts.join(" ");
                    return {
                      header: emoji,
                      title: title,
                      description: `Menampilkan semua perintah di ${title}.`,
                      id: `${config.prefix}${btn.id}`, // ID ini yang akan dikirim sebagai pesan saat dipilih
                    };
                  }),
                },
              ],
            }),
          },
        },
      ];

      // Teks utama untuk menu
      const menuText = `
┏─━─𓊈𝐈𝐍𝐅𝐎 • 𝐔𝐒𝐄𝐑𝐒𓊉━─━─━─⋉
│┏─━─━─━─━─━─━─━─━─┓
┃✘ ➤ Username : ${userData.username}
│✘ ➤ Saldo    : ${userData.saldo}
┃✘ ➤ Rank     : ${userData.rank}
│✘ ➤ Level    : ${userData.level}
┃✘ ➤ Exp      : ${userData.exp} 
│┗─━─━─━─━─━─━─━─━─┛
┗─━─━─━─━─━─━─━─━─━─━─⋊

┏─━─𓊈𝐈𝐍𝐅𝐎 • 𝐁𝐎𝐓𓊉━─━─━─⋉
│┏─━─━─━─━─━─━─━─━─┓
┃✘ ➤ Runtime     : ${runtime}
│✘ ➤ Mode        : ${config.gcOnly ? "Group Only" : "Public"}
┃✘ ➤ Status      : ${
        userStatus === "owner"
          ? "Owner"
          : userStatus === "premium"
          ? "Premium"
          : "Free"
      }
│✘ ➤ Owner Name  : ${config.namaOwner}
┃✘ ➤ Bot Name    : ${config.namaBot}
│✘ ➤ Version     : ${config.version || "1.0.0"}
┃✘ ➤ Total Fitur : ${totalFitur}
│┗─━─━─━─━─━─━─━─━─┛
├─━─━─━─━─━─━─━─━─━─━─⋊
│ Bot ini di sponsori oleh *Zephyre.my.id*, Tempat nonton anime tanpa gangguan IKLAN
┗─━─━─━─━─━─━─━─━─━─━─⋊`;

      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: menuText,
          footer: `© ${config.namaBot} by ${config.namaOwner}`,
          buttons: buttons,
          headerType: 1,
          viewOnce: true,
        },
        { quoted: message }
      );

      logger.info(`📋 Menu ditampilkan untuk ${senderNumber}`);
    } catch (error) {
      logger.error("❌ Error saat menampilkan menu:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: messageFormatter.error(
            "❌ Terjadi kesalahan saat menampilkan menu!"
          ),
        },
        { quoted: message }
      );
    }
  },
};
