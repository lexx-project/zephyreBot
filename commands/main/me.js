import axios from "axios";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import config from "../../config/setting.js";
import { messageFormatter, logger } from "../../utils/helpers.js";
import { getUser, getLevelInfo, getUserStatus } from "../../utils/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  name: "me",
  aliases: ["profile", "myinfo"],
  description: "Menampilkan informasi profil pengguna.",
  usage: `${config.prefix}me`,
  category: "main",
  cooldown: 5,
  ownerOnly: false,
  groupOnly: false,
  privateOnly: false,

  async execute(sock, m, args) {
    try {
      const userId = m.key.participant || m.key.remoteJid;
      const senderNumber = userId.split("@")[0];
      const pushName = m.pushName || "User";

      const user = getUser(userId);
      const levelInfo = getLevelInfo(userId);
      const userStatus = getUserStatus(userId);

      // Menentukan rank berdasarkan status dan level
      let rank = "Member";
      if (userStatus === "owner") {
        rank = "Owner";
      } else if (userStatus === "premium") {
        rank = "Premium";
      } else if (levelInfo.level >= 50) {
        rank = "Legend";
      } else if (levelInfo.level >= 30) {
        rank = "Expert";
      } else if (levelInfo.level >= 20) {
        rank = "Advanced";
      } else if (levelInfo.level >= 10) {
        rank = "Intermediate";
      }

      // Menentukan batas limit maksimal
      const maxLimit =
        userStatus === "owner"
          ? "Unlimited"
          : userStatus === "premium"
          ? "500"
          : "50";

      const statusText =
        userStatus.charAt(0).toUpperCase() + userStatus.slice(1);

      const responseText = `─✎「 User Info 」 
│• Name: ${pushName}
│• Tag: @${senderNumber}
│• Api: ‪wa.me/${senderNumber}
│• Status: ${statusText}
│• Limit: ${user.limit}/${maxLimit}
│• Saldo: ${user.balance.toLocaleString()}
│• Level: ${levelInfo.level}
│• Rank: ${rank}
│• XP: ${levelInfo.exp}/${levelInfo.requiredExp}
╰─────────❍`;

      // --- Proses pembuatan gambar dengan bingkai ---
      const framePath = path.join(
        __dirname,
        "../../assets/images/bingkai-me.png"
      );

      let finalImageBuffer;

      try {
        // Ambil foto profil pengguna
        let profilePicUrl;
        let ppBuffer;
        try {
          profilePicUrl = await sock.profilePictureUrl(userId, "image");
          logger.info(`[ME] Mengunduh gambar profil dari URL...`);
          const ppResponse = await axios.get(profilePicUrl, {
            responseType: "arraybuffer",
            timeout: 15000,
          });
          ppBuffer = Buffer.from(ppResponse.data);
        } catch {
          logger.warning(
            `[ME] Gagal mengambil foto profil untuk ${senderNumber}, menggunakan gambar default lokal.`
          );
          const defaultPpPath = path.join(
            __dirname,
            "../../assets/images/default-pp.jpg"
          );
          if (fs.existsSync(defaultPpPath)) {
            ppBuffer = fs.readFileSync(defaultPpPath);
          } else {
            throw new Error(
              "Foto profil tidak ditemukan dan file default-pp.jpg juga tidak ada."
            );
          }
        }

        // Cek apakah file bingkai ada
        if (!fs.existsSync(framePath)) {
          logger.error(`[ME] File bingkai tidak ditemukan di: ${framePath}`);
          throw new Error("File bingkai lokal tidak ditemukan.");
        }

        // Muat buffer bingkai dari file lokal
        const frameBuffer = fs.readFileSync(framePath);

        logger.info(`[ME] Memproses dan menggabungkan gambar...`);

        // 1. Ubah ukuran gambar profil menjadi kotak seukuran bingkai
        const ppSize = 512; // Ukuran untuk gambar profil, sama dengan ukuran bingkai
        const squaredPpBuffer = await sharp(ppBuffer)
          .resize(ppSize, ppSize, {
            fit: sharp.fit.cover, // Crop untuk menghindari distorsi
            position: sharp.strategy.attention, // Fokus pada bagian paling menarik
          })
          .png() // Pastikan outputnya PNG untuk menjaga transparansi
          .toBuffer();

        // Pastikan bingkai juga di-resize ke ukuran yang sama untuk menghindari error
        const resizedFrameBuffer = await sharp(frameBuffer)
          .resize(ppSize, ppSize)
          .toBuffer();

        // 2. Jadikan foto profil sebagai dasar, lalu timpa dengan bingkai
        finalImageBuffer = await sharp(squaredPpBuffer)
          .composite([{ input: resizedFrameBuffer, blend: "over" }])
          .png() // Output akhir sebagai PNG untuk menjaga transparansi
          .toBuffer();
      } catch (imgError) {
        logger.error("[ME] Gagal memproses gambar:", imgError);
        throw new Error("Gagal membuat gambar profil dengan bingkai.");
      }

      // Kirim pesan dengan gambar dan caption
      await sock.sendMessage(
        m.key.remoteJid,
        {
          image: finalImageBuffer,
          caption: responseText,
          mentions: [userId],
        },
        { quoted: m }
      );

      logger.info(`[ME] Info profil ditampilkan untuk ${senderNumber}`);
    } catch (error) {
      logger.error("Error di command me:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        {
          text: messageFormatter.error(
            "❌ Terjadi kesalahan saat menampilkan profil!"
          ),
        },
        { quoted: m }
      );
    }
  },
};
