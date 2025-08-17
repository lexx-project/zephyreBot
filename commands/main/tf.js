import config from "../../config/setting.js";
import {
  messageFormatter,
  logger,
  timeFormatter,
} from "../../utils/helpers.js";
import { getUser, updateBalance } from "../../utils/database.js";

export default {
  name: "tf",
  aliases: ["transfer", "kirimsaldo"],
  description: "Transfer saldo ke pengguna lain.",
  usage: `${config.prefix}tf <@mention/nomor> <jumlah>`,
  category: "main",
  cooldown: 10,

  async execute(sock, m, args) {
    try {
      const senderId = m.key.participant || m.key.remoteJid;
      const senderData = getUser(senderId);

      // --- Dapatkan Target User & Jumlah (Logika Baru yang Lebih Andal) ---
      let targetId;
      let amount;
      const mentionedJid =
        m.message?.extendedTextMessage?.contextInfo?.mentionedJid;
      const quotedMessage =
        m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const participant =
        m.message?.extendedTextMessage?.contextInfo?.participant;

      if (mentionedJid && mentionedJid.length > 0) {
        // Case 1: User menggunakan mention (@user)
        targetId = mentionedJid[0];
        amount = parseInt(args[1]);
      } else if (quotedMessage && participant) {
        // Case 2: User membalas (reply) pesan
        targetId = participant;
        amount = parseInt(args[0]);
      } else {
        // Case 3: User mengetik nomor manual
        const targetNumber = args[0]?.replace(/[^0-9]/g, "");
        if (!targetNumber || !args[1] || isNaN(args[1])) {
          return await sock.sendMessage(
            m.key.remoteJid,
            {
              text:
                `*Cara Penggunaan Command Transfer*\n\n` +
                `*1. Dengan Mention:*\n` +
                `\`${config.prefix}tf @user 1000\`\n\n` +
                `*2. Dengan Reply Pesan:*\n` +
                `Balas pesan target dengan \`${config.prefix}tf 1000\`\n\n` +
                `*3. Dengan Nomor:*\n` +
                `\`${config.prefix}tf 628xxxx 1000\``,
            },
            { quoted: m }
          );
        }
        targetId = `${targetNumber}@s.whatsapp.net`;
        amount = parseInt(args[1]);
      }

      // --- Validasi Lanjutan ---
      if (isNaN(amount)) {
        return await sock.sendMessage(
          m.key.remoteJid,
          {
            text: messageFormatter.error(
              "Jumlah transfer tidak valid. Pastikan Anda memasukkan angka."
            ),
          },
          { quoted: m }
        );
      }

      if (amount <= 0) {
        return await sock.sendMessage(
          m.key.remoteJid,
          { text: messageFormatter.error("Jumlah transfer harus positif.") },
          { quoted: m }
        );
      }

      if (targetId === senderId) {
        return await sock.sendMessage(
          m.key.remoteJid,
          {
            text: messageFormatter.error(
              "Anda tidak bisa transfer ke diri sendiri."
            ),
          },
          { quoted: m }
        );
      }

      if (senderData.balance < amount) {
        return await sock.sendMessage(
          m.key.remoteJid,
          {
            text: messageFormatter.warning(
              `💸 *Saldo tidak mencukupi!*\n\n` +
                `💰 *Saldo Anda:* ${senderData.balance.toLocaleString()}\n` +
                `💳 *Ingin transfer:* ${amount.toLocaleString()}\n` +
                `📊 *Kurang:* ${(amount - senderData.balance).toLocaleString()}`
            ),
          },
          { quoted: m }
        );
      }

      // --- Proses Transaksi ---
      const targetData = getUser(targetId); // Pastikan user target ada di DB

      updateBalance(
        senderId,
        -amount,
        `transfer_out_to_${targetId.split("@")[0]}`
      );
      updateBalance(
        targetId,
        amount,
        `transfer_in_from_${senderId.split("@")[0]}`
      );

      // --- Buat Struk Transaksi ---
      const transactionId = `TF-${Date.now()}`;
      const transactionDate = timeFormatter.formatDate(new Date());

      const receipt = `
┌─「 *TRANSAKSI BERHASIL* 」
│
│ *Nomor Transaksi:*
│ \`${transactionId}\`
│ *Tanggal:*
│ \`${transactionDate}\`
│
├─- - - - - - - - - - - - - -
│
│ *PENGIRIM:*
│  • Nama: @${senderId.split("@")[0]}
│
│ *PENERIMA:*
│  • Nama: @${targetId.split("@")[0]}
│
├─- - - - - - - - - - - - - -
│
│ *DETAIL TRANSFER:*
│  • Jumlah: ${amount.toLocaleString()} Saldo
│  • Biaya Admin: 0 Saldo
│  • *Total:* *${amount.toLocaleString()} Saldo*
│
└─「 © ${config.namaBot} 」
      `;

      await sock.sendMessage(
        m.key.remoteJid,
        { text: receipt.trim(), mentions: [senderId, targetId] },
        { quoted: m }
      );

      logger.info(
        `[TRANSFER] ${senderId.split("@")[0]} sent ${amount} to ${
          targetId.split("@")[0]
        }`
      );
    } catch (error) {
      logger.error("Error in tf command:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        {
          text: messageFormatter.error(
            "Terjadi kesalahan saat melakukan transfer."
          ),
        },
        { quoted: m }
      );
    }
  },
};
