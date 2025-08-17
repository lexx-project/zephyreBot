import config from "../../config/setting.js";
import { logger, validator } from "../../utils/helpers.js";
import { addGroupRental } from "../../utils/database.js";

export default {
  name: "addsewa",
  description: "Menambahkan bot ke grup dengan durasi sewa.",
  usage: `${config.prefix}addsewa <link_grup> <durasi_hari>`,
  category: "owner",
  cooldown: 10,
  ownerOnly: true,

  async execute(sock, m, args) {
    try {
      // Validasi owner
      if (!validator.isOwner(m.key.remoteJid)) {
        return await sock.sendMessage(
          m.key.remoteJid,
          { text: "❌ Command ini hanya untuk Owner!" },
          { quoted: m }
        );
      }

      if (args.length < 2) {
        return await sock.sendMessage(
          m.key.remoteJid,
          { text: `Penggunaan: ${this.usage}` },
          { quoted: m }
        );
      }

      const link = args[0];
      const duration = parseInt(args[1]);

      if (!link.includes("chat.whatsapp.com/")) {
        return await sock.sendMessage(
          m.key.remoteJid,
          { text: "❌ Link grup tidak valid." },
          { quoted: m }
        );
      }

      if (isNaN(duration) || duration <= 0) {
        return await sock.sendMessage(
          m.key.remoteJid,
          { text: "❌ Durasi hari tidak valid." },
          { quoted: m }
        );
      }

      // Ekstrak kode undangan dari link, hapus parameter URL jika ada
      const codeWithParams = link.split("chat.whatsapp.com/")[1];
      const code = codeWithParams.split("?")[0];

      await sock.sendMessage(
        m.key.remoteJid,
        { text: `⏳ Mendapatkan info grup dan mengatur sewa...` },
        { quoted: m }
      );

      // Dapatkan info grup dari kode undangan untuk mendapatkan JID
      const groupInfo = await sock.groupGetInviteInfo(code);
      const groupId = groupInfo.id;

      if (!groupId) {
        throw new Error("Tidak dapat menemukan ID grup dari link undangan.");
      }

      // Tambahkan sewa ke DB segera
      const expiryDate = addGroupRental(groupId, duration, m.key.remoteJid);
      logger.info(
        `[SEWA] Sewa untuk grup ${groupId} telah diatur selama ${duration} hari.`
      );

      // Coba bergabung ke grup
      try {
        await sock.groupAcceptInvite(code);
        logger.info(
          `[SEWA] Berhasil mengirim permintaan bergabung ke grup: ${groupId}`
        );

        // Siapkan pesan selamat datang
        const welcomeMessage = `
👋 Halo semua!

Terima kasih telah menyewa *${config.namaBot}*.
Bot ini akan aktif di grup ini selama *${duration} hari*.

🗓️ *Masa Sewa Berakhir:*
${expiryDate.toLocaleDateString("id-ID", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
})}

*Peraturan Penggunaan Bot:*
1.  Gunakan prefix \`${config.prefix}\` untuk semua command.
2.  Dilarang keras melakukan spam command.
3.  Patuhi cooldown setiap command untuk menghindari lag.

Ketik \`${
          config.prefix
        }menu\` untuk melihat daftar command yang tersedia. Selamat menikmati! 😊`;

        // Coba kirim pesan selamat datang
        await sock.sendMessage(groupId, { text: welcomeMessage.trim() });

        // Konfirmasi ke owner
        await sock.sendMessage(
          m.key.remoteJid,
          {
            text: `✅ Bot berhasil ditambahkan ke grup dan masa sewa telah diatur selama ${duration} hari.`,
          },
          { quoted: m }
        );
      } catch (joinError) {
        // Blok ini menangani kasus di mana bot tidak bisa langsung bergabung/mengirim pesan.
        // Kemungkinan besar karena pengaturan "setujui anggota baru".
        logger.warning(
          `[SEWA] Gagal mengirim pesan ke grup ${groupId}, kemungkinan join pending. Error: ${joinError.message}`
        );
        await sock.sendMessage(
          m.key.remoteJid,
          {
            text: `✅ Sewa berhasil diatur untuk ${duration} hari.\n\n⚠️ Bot telah mengirim permintaan untuk bergabung dan sedang *menunggu persetujuan admin grup*. Pesan selamat datang akan dikirim setelah disetujui.`,
          },
          { quoted: m }
        );
      }
    } catch (error) {
      logger.error("Error in addsewa command:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        {
          text: `❌ Gagal menambahkan sewa. Mungkin link tidak valid atau bot sudah ada di grup.\n\nError: ${error.message}`,
        },
        { quoted: m }
      );
    }
  },
};
