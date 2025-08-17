import config from "../../config/setting.js";
import {
  logger,
  messageFormatter,
  timeFormatter,
} from "../../utils/helpers.js";
import { getUser, getUserStatus, getLevelInfo } from "../../utils/database.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandsRoot = path.join(__dirname, "..");

export default {
  name: "allmenu",
  aliases: ["menuall", "fullmenu", "helpall"],
  description:
    "Menampilkan semua command yang tersedia, dikelompokkan berdasarkan kategori.",
  usage: `${config.prefix}allmenu`,
  category: "main",
  cooldown: 5,

  async execute(sock, m, args) {
    try {
      const sender = m.key.remoteJid;
      const senderNumber = sender.split("@")[0];

      // --- Start: User and Bot Info ---
      const uptime = process.uptime();
      const runtime = timeFormatter.formatUptime(uptime);

      const user = getUser(sender);
      const userStatus = getUserStatus(sender);
      const levelInfo = getLevelInfo(sender);

      const userLevel = user?.level || 1;
      const userExp = user?.exp || 0;
      const userBalance = user?.balance || 0;
      const requiredExp = levelInfo?.requiredExp || 100;

      let rank = "Member";
      if (userStatus === "owner") {
        rank = "Owner";
      } else if (userStatus === "premium") {
        rank = "Premium";
      } else if (userLevel >= 50) {
        rank = "Legend";
      } else if (userLevel >= 30) {
        rank = "Expert";
      } else if (userLevel >= 20) {
        rank = "Advanced";
      } else if (userLevel >= 10) {
        rank = "Intermediate";
      }

      let totalFitur = 0;
      const commandFoldersForCount = fs
        .readdirSync(commandsRoot, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      for (const folder of commandFoldersForCount) {
        const commandFilesPath = path.join(commandsRoot, folder);
        const commandFiles = fs
          .readdirSync(commandFilesPath)
          .filter((file) => file.endsWith(".js"));
        totalFitur += commandFiles.length;
      }

      const headerText = `━─𓊈𝐈𝐍𝐅𝐎 • 𝐔𝐒𝐄𝐑𝐒𓊉━─━─━─⋉
│┏─━─━─━─━─━─━─━─━─┓
┃✘ ➤ Username : ${m.pushName || senderNumber}
│✘ ➤ Saldo    : ${userBalance.toLocaleString()}
┃✘ ➤ Rank     : ${rank}
│✘ ➤ Level    : ${userLevel}
┃✘ ➤ Exp      : ${userExp}/${requiredExp}
│┗─━─━─━─━─━─━─━─━─┛
┗─━─━─━─━─━─━─━─━─━─━─⋊

┏─━─𓊈𝐈𝐍𝐅𝐎 • 𝐁𝐎𝐓𓊉━─━─━─⋉
│┏─━─━─━─━─━─━─━─━─┓
┃✘ ➤ Runtime     : ${runtime}
│✘ ➤ Mode        : ${config.botSettings.selfBot ? "Self Bot" : "Public"}
┃✘ ➤ Status      : Online
│✘ ➤ Owner Name  : ${config.namaOwner}
┃✘ ➤ Bot Name    : ${config.namaBot}
│✘ ➤ Version     : 1.0.0
┃✘ ➤ Total Fitur : ${totalFitur}
│┗─━─━─━─━─━─━─━─━─┛
┗─━─━─━─━─━─━─━─━─━─━─⋊
`;
      // --- End: User and Bot Info ---

      let listContent = "";

      const commandFolders = fs
        .readdirSync(commandsRoot, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      for (const folder of commandFolders) {
        const commandFilesPath = path.join(commandsRoot, folder);
        const commandFiles = fs
          .readdirSync(commandFilesPath)
          .filter((file) => file.endsWith(".js"));

        if (commandFiles.length > 0) {
          const categoryName = folder.toUpperCase();
          listContent += `*${categoryName} MENU*\n`;

          const commandList = commandFiles
            .map((file) => file.replace(".js", ""))
            .filter((cmd) => !cmd.includes("menu")) // Menyembunyikan command menu
            .map((cmd) => `• ${config.prefix}${cmd}`)
            .join("\n");

          if (commandList) {
            listContent += `${commandList}\n\n`;
          }
        }
      }

      let menuText = "";
      if (listContent) {
        const title = "DAFTAR MENU";
        menuText += `\n┌─❐ 乂 ${title} 乂 ❐\n`;
        const lines = listContent.trim().split("\n");
        lines.forEach((line) => {
          // Tambahkan spasi jika baris kosong untuk menjaga format
          menuText += `│ ${line || " "}\n`;
        });
        menuText += `└╍╍╍╍╍╍╍╍╍╍╍╍╍╍╍`;
      }

      // Karakter "read more" untuk memotong pesan
      const readMore = "\u200C".repeat(4001);

      const fullMenuText = headerText + readMore + menuText;

      await sock.sendMessage(
        m.key.remoteJid,
        { text: fullMenuText },
        { quoted: m }
      );

      logger.info(
        `[ALLMENU] Menu lengkap ditampilkan untuk ${
          m.key.remoteJid.split("@")[0]
        }`
      );
    } catch (error) {
      logger.error("Error di command allmenu:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        {
          text: messageFormatter.error(
            "Terjadi kesalahan saat menampilkan menu."
          ),
        },
        { quoted: m }
      );
    }
  },
};
