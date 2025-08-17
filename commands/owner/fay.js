import config from "../../config/setting.js";
import { getFayConfig, writeFayConfig } from "../../utils/fayUtils.js";
import { logger } from "../../utils/helpers.js";

export default {
  name: "fay",
  description: "Mengaktifkan atau menonaktifkan asisten AI Fay.",
  usage: `${config.prefix}fay [on|off]`,
  category: "owner",
  cooldown: 3,
  ownerOnly: true,

  async execute(sock, message, args, ai_tool_params = {}) {
    // --- Otomatis ditambahkan oleh Skrip Modifikasi Fay ---
    const aiParams = ai_tool_params || {}; // Pastikan objek aiParams selalu ada
    // Variabel 'inputFromFay' akan berisi input utama dari AI atau dari args.
    const inputFromFay = aiParams.query || aiParams.url || aiParams.text || aiParams.prompt || 
                         aiParams.amount || aiParams.targetNumber || aiParams.itemId || 
                         aiParams.betAmount || aiParams.targetUser || aiParams.durationDays ||
                         aiParams.member_mention || aiParams.reason || aiParams.action ||
                         args.join(" "); // Fallback ke args.join(" ")

    // CATATAN PENTING:
    // Sekarang, Anda bisa mengganti baris pengambilan parameter 'args' Anda
    // dengan variabel 'inputFromFay' atau 'aiParams.nama_parameter_spesifik'.
    // Contoh:
    // SEBELUM:   const query = args.join(" ");
    // SESUDAH:   const query = inputFromFay;
    // SEBELUM:   const url = args[0];
    // SESUDAH:   const url = inputFromFay;
    // SEBELUM:   const targetNumber = args[0].replace(/\D/g, "");
    // SESUDAH:   const targetNumber = (aiParams.targetNumber || args[0])?.replace(/\D/g, ""); (jika butuh pemrosesan lebih lanjut)
    // --- Akhir Bagian Otomatis ---
    
    const action = args[0]?.toLowerCase();

    if (action !== "on" && action !== "off") {
      return await sock.sendMessage(
        m.key.remoteJid,
        { text: `Gunakan: ${this.usage}` },
        { quoted: m }
      );
    }

    try {
      const fayConfig = getFayConfig();
      fayConfig.status = action;
      writeFayConfig(fayConfig);

      const response = `Oke, Fay sekarang *${action.toUpperCase()}*! ${
        action === "on" ? "💖" : "😴"
      }`;
      await sock.sendMessage(
        m.key.remoteJid,
        { text: response },
        { quoted: m }
      );
      logger.info(
        `[FAY] Status diubah menjadi ${action.toUpperCase()} oleh owner.`
      );
    } catch (error) {
      logger.error("Error in fay command:", error);
    }
  },
};
