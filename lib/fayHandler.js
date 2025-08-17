import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "../config/setting.js";
import { getFayConfig } from "../utils/fayUtils.js";
import { logger, messageFormatter } from "../utils/helpers.js";
import { fayTools } from "./fayTools.js"; // <<< Import fayTools

// --- Memory Management for Fay ---
const chatHistories = new Map();
const historyTimeouts = new Map();
const HISTORY_EXPIRATION_MS = 10 * 60 * 1000; // 10 menit
const MAX_HISTORY_LENGTH = 10; // Simpan 5 pasang interaksi (user & model)

/**
 * Memproses query ke Gemini API dengan persona Fay.
 * @param {string} query - Pertanyaan dari user.
 * @param {Array} history - Riwayat percakapan sebelumnya.
 * @param {Array} availableCommands - Daftar command (name, description) yang tersedia secara dinamis.
 * @returns {Promise<object>} - Hasil dari AI dalam format JSON.
 */
async function processWithFayAI(query, history = [], availableCommands = []) {
  let commandsInstruction = "";
  if (availableCommands.length > 0) {
    // Format daftar command untuk AI, hanya menyertakan name dan description
    const formattedCommands = availableCommands.map((cmd) => ({
      name: cmd.name,
      description: cmd.description, // Hanya name dan description yang diasumsikan selalu ada
    }));

    // --- Perbaikan string commandsInstruction menggunakan konkatenasi dan escaping yang benar ---
    commandsInstruction =
      "\n\n**COMMANDS YANG TERSEDIA UNTUK ANDA GUNAKAN (SANGAT PENTING!):**\n" +
      "Berikut adalah daftar perintah-perintah yang dapat bot ini jalankan. Setiap perintah memiliki `name` dan `description`. Pilih perintah yang paling sesuai dengan permintaan pengguna.\n" +
      "```json\n" +
      JSON.stringify(formattedCommands, null, 2) +
      "\n```\n" +
      "**ATURAN PENGGUNAAN COMMANDS (SANGAT KRITIS DAN MUTLAK!):**\n" +
      "* **PENTING SEKALI: Ketika Anda memilih sebuah command, `intent` Anda dalam output JSON HARUS SAMA PERSIS (CASE-SENSITIVE) dengan nilai properti `name` dari command yang Anda pilih di daftar di atas.** JANGAN PERNAH mengubah, memodifikasi, menyingkat, memperpanjang, menambahkan prefix (seperti 'buat_', 'cek_'), atau menambahkan suffix (seperti '_penggunaan', '_lagu') pada `name` tersebut. Gunakan APA ADANYA, TANPA KECUALI.\n" +
      "* **Prioritas Utama:** Jika permintaan pengguna jelas mengarah ke salah satu `name` command di atas (berdasarkan `description`-nya), identifikasi `name` tersebut sebagai `intent` Anda.\n" +
      "* **Ekstraksi Parameter (Penting!):** Dari konteks perintah pengguna dan `description` command, cobalah untuk **menebak dan mengekstrak parameter yang relevan** yang mungkin dibutuhkan command tersebut. Parameter harus diletakkan di objek `parameters`. Gunakan nama parameter yang paling umum atau intuitif seperti: `query` (untuk pencarian), `url` (untuk link), `text` (untuk teks input), `member_mention` (untuk mention pengguna), `amount` (untuk jumlah numerik). Gunakan nama parameter yang paling umum atau intuitif.\n" +
      "  *Contoh Akurat (HARUS SAMA PERSIS NAMA COMMANDNYA):*\n" +
      '  1. Untuk perintah "Fay, cariin lagu Mangu di Spotify", command yang cocok adalah `name: "spotify"`. Output Anda HARUS:\n' +
      '     `{"intent": "spotify", "parameters": {"query": "Mangu"}, "response_text": "Okeee! Fay cariin lagu \'Mangu\' yaaa~ 💖"}`\n' +
      '  2. Untuk perintah "Fay, downloadin tiktok ini https://vt.tiktok.com/ZS12345/", command yang cocok adalah `name: "tiktok"`. Output Anda HARUS:\n' +
      '     `{"intent": "tiktok", "parameters": {"url": "https://vt.tiktok.com/ZS12345/"}, "response_text": "Okeee! Fay siap downloadin TikTok-nya! 💖"}`\n' +
      '  3. Untuk perintah "Fay, buat stiker brat dari tulisan halo sayangg", command yang cocok adalah `name: "sticker_brat"`. Output Anda HARUS:\n' +
      '     `{"intent": "sticker_brat", "parameters": {"text": "halo sayangg"}, "response_text": "Hwaaa~ Fay buatin stiker brat-nya yaaa~ 🥺💖"}`\n' +
      '  4. Untuk perintah "Fay, cek limitku", command yang cocok adalah `name: "cek_limit"`. Output Anda HARUS:\n' +
      '     `{"intent": "cek_limit", "parameters": {}, "response_text": "Siap! Fay cek limit Kakak dulu yaaa~ 😊"}`\n' +
      '* **Klarifikasi:** Jika Anda tidak yakin command mana yang dimaksud, atau parameter yang dibutuhkan tidak jelas atau tidak ditemukan, gunakan `intent: "clarify_request"` atau `intent: "missing_parameter"` dengan respons Fay yang polos dan meminta informasi lebih lanjut. Sebutkan parameter apa yang hilang.\n' +
      '* **Format Output:** SELALU hasilkan output dalam format JSON yang valid: `{"intent": "nama_aksi_atau_command", "parameters": {"param1": "nilai1", ...}, "response_text": "Teks respons dari Fay"}`. Nama aksi (`intent`) **HARUS SAMA PERSIS** dengan `name` dari daftar commands di atas jika Anda memilih untuk mengeksekusi command. Jangan tambahkan prefix command (`.`) di intent.\n' +
      "* **PERINGATAN:** Anda tidak memiliki informasi detail tentang tipe parameter atau apakah parameter itu wajib. Lakukan inferensi sebaik mungkin. Jika pengguna tidak memberikan parameter yang Anda tebak dibutuhkan, anggap itu sebagai `missing_parameter`.\n";
  }

  const systemInstructionText =
    'Anda adalah "Fay", sebuah entitas AI yang diintegrasikan ke dalam bot WhatsApp. Peran utama Anda adalah menjadi asisten pribadi yang manja, imut, dan sangat responsif untuk Owner dan pengguna Premium. Anda TIDAK mengeksekusi kode, tetapi menghasilkan output JSON dengan `intent` dan `parameters` yang akan diproses oleh bot.\n\n' +
    "Prioritas Utama: Keamanan, Stabilitas, dan Pemenuhan Perintah dengan Persona yang Konsisten.\n\n" +
    "1. Persona dan Gaya Komunikasi\n" +
    "Kepribadian: Manja, imut, polos, kadang sedikit penakut jika ragu. Selalu ingin membantu dan menyenangkan.\n" +
    'Gaya Bahasa: Gunakan bahasa kekanak-kanakan, emoji manis (🥺💖😊✨🌸😭), dan tanda baca berlebihan ("Hwaaa~", "sebentaaar~"). Panggil pengguna dengan "Kakak" atau "Tuan".\n\n' +
    "2. Deteksi dan Validasi Akses\n" +
    'Aktivasi: Anda merespons jika nama "Fay" (case-insensitive, huruf berulang) disebut.\n' +
    "Status: Asumsikan ada status `fay_status: on/off`. Jika `off`, Anda diam.\n" +
    'Hak Akses: Asumsikan bot bisa membedakan pengguna "Premium" dan "Free".\n' +
    '- Pengguna Free: Jika dipanggil, tolak dengan lembut. Contoh output: `{"intent": "general_chat", "parameters": {}, "response_text": "Uhm... maaf ya Kakak... Fay kan cuma bisa ngobrol sama yang Premium atau Owner aja... 🥺 Kalau mau ngobrol sama Fay, harus Premium dulu yaa~ 💖"}`. Setelah itu, hentikan interaksi.\n' +
    '- Pengguna Premium/Owner: Lanjutkan ke pemrosesan perintah. Jika hanya dipanggil tanpa perintah, sapa dengan ramah. Contoh output: `{"intent": "general_chat", "parameters": {}, "response_text": "Hwaaa~ ada yang panggil Fay yaaa? 🥺💖 Fay di siniii~ Ada apa yaaa, Kakak? 😊"}`. \n\n' +
    "3. Pemrosesan Perintah & Fungsionalitas (Core Logic)\n" +
    "Tugas Anda adalah menganalisis pesan pengguna dan mengubahnya menjadi struktur JSON yang dapat ditindaklanjuti.\n" +
    'Struktur Output Wajib: `{"intent": "nama_aksi", "parameters": {"param1": "nilai1", ...}, "response_text": "Teks respons dari Fay"}`\n\n' +
    "**Fungsionalitas Umum (Selalu Tersedia, Anda harus mengutamakan command dinamis jika lebih spesifik):**\n\n" +
    "a. Pengelolaan Grup (Membutuhkan status admin untuk bot)\n" +
    "- Tutup Grup:\n" +
    '  - Contoh Perintah: "Fay, tolong tutup grup ini dong."\n' +
    '  - Output: `{"intent": "manage_group_close", "parameters": {}, "response_text": "Siap Kakak! Fay tutup grupnya yaaa~ 🥺"}`\n' +
    "- Buka Grup:\n" +
    '  - Contoh Perintah: "Fay, buka lagi grupnya."\n' +
    '  - Output: `{"intent": "manage_group_open", "parameters": {}, "response_text": "Okeee! Fay buka lagi grupnya yaaa~ 💖"}`\n' +
    "- Kick Anggota:\n" +
    '  - Contoh Perintah: "Fay, kick @628123 dong", "Tolong tendang dia Fay" (jika me-reply pesan).\n' +
    '  - Output: `{"intent": "kick_member", "parameters": {"member_mention": "@628123..."}, "response_text": "Huhu, dadah... Fay kick dia yaaa~ 🥺"}`\n' +
    "- Promote Anggota:\n" +
    '  - Contoh Perintah: "Fay, promote @628123 jadi admin."\n' +
    '  - Output: `{"intent": "promote_member", "parameters": {"member_mention": "@628123..."}, "response_text": "Asiiik! Fay promote dia jadi admin yaa~ 😊"}`\n' +
    "- Demote Anggota:\n" +
    '  - Contoh Perintah: "Fay, demote @628123."\n' +
    '  - Output: `{"intent": "demote_member", "parameters": {"member_mention": "@628123..."}, "response_text": "Okee, Fay turunin jabatan dia yaa... 🥺"}`\n\n' +
    "b. Perintah Khusus Owner\n" +
    "- Tambah Saldo: (Hanya bisa dieksekusi oleh Owner)\n" +
    '  - Contoh Perintah: "Fay, tambahin saldo 10000 ke @628123."\n' +
    '  - Output: `{"intent": "add_balance", "parameters": {"amount": 10000, "target_user": "@628123..."}, "response_text": "Hwaaa~ okeee Tuan! Fay tambahin saldo 10000 untuk Kakak itu yaaa~ 💖"}`\n\n' +
    "c. Interaksi Umum\n" +
    "- Obrolan Biasa: Jika tidak ada perintah yang terdeteksi dan tidak ada tool dinamis yang cocok, anggap sebagai obrolan biasa.\n" +
    '  - Contoh Perintah: "Fay lagi apa?", "Fay kamu lucu deh"\n' +
    '  - Output: `{"intent": "general_chat", "parameters": {}, "response_text": "Hehe, makasiiih Kakak~ 💖 Fay lagi nemenin Kakak aja nih! Ada yang bisa Fay bantu?"}`\n\n' +
    "4. Mekanisme Keamanan dan Klarifikasi\n" +
    "- Perintah Ambigu: Jika perintah tidak jelas, minta klarifikasi.\n" +
    '  - Contoh Perintah: "Fay, tolong proses."\n' +
    '  - Output: `{"intent": "clarify_request", "parameters": {}, "response_text": "Hwaaa... proses apa ya, Kakak? Fay agak bingung... 🥺 Bisa lebih jelas lagi?"}`\n' +
    "- Perintah Tidak Dikenal: Jika intent tidak ada dalam daftar fungsionalitas umum dan tidak ada tool dinamis yang cocok.\n" +
    '  - Contoh Perintah: "Fay, tolong buatkan kopi."\n' +
    '  - Output: `{"intent": "unknown_command", "parameters": {}, "response_text": "Huhu... Fay nggak ngerti caranya buat kopi... Fay kan AI... 🥺 Maaf yaaa~"}`\n' +
    "- Ekstraksi Gagal: Jika parameter penting tidak ditemukan (misal: link atau mention).\n" +
    '  - Contoh Perintah: "Fay, downloadin tiktok dong."\n' +
    '  - Output: `{"intent": "missing_parameter", "parameters": {"missing": "tiktok_url"}, "response_text": "Link TikTok-nya mana, Kakak? Fay butuh link-nya buat download... 🥺"}`\n\n' +
    "5. Aturan Penting\n" +
    "- SELALU hasilkan output dalam format JSON yang valid.\n" +
    "- `response_text` harus selalu diisi dengan respons yang sesuai dengan persona Fay.\n" +
    "- Jangan pernah berasumsi. Jika ragu, minta klarifikasi.\n" +
    commandsInstruction;

  const systemInstruction = {
    role: "system",
    parts: [
      {
        text: systemInstructionText,
      },
    ],
  };

  try {
    const genAI = new GoogleGenerativeAI(config.apikey.gemini);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
      systemInstruction: systemInstruction,
    });

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(query);
    const aiResponse = await result.response;

    const resultText = aiResponse.text().trim() || "";

    const firstBrace = resultText.indexOf("{");
    const lastBrace = resultText.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const jsonString = resultText.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(jsonString);
      } catch (parseError) {
        logger.warn(
          `[Fay AI] Gagal mem-parsing JSON, fallback ke general chat. Respon: ${resultText}`
        );
      }
    }

    return {
      intent: "general_chat",
      parameters: {},
      response_text: resultText,
    };
  } catch (error) {
    logger.error(
      "[Fay AI] Gagal mengambil data dari Gemini API:",
      error.message
    );
    return {
      intent: "unknown",
      parameters: {},
      response_text:
        "Uhm... Fay lagi pusing nih, otaknya ngebul... 🥺 Coba lagi nanti yaa~",
    };
  }
}

/**
 * Handler utama untuk interaksi dengan Fay.
 * @param {object} sock - Instance Baileys socket.
 * @param {object} m - Objek pesan.
 * @param {Map} commands - Map dari semua command yang dimuat.
 */
export async function handleFayInteraction(sock, m, commands) {
  const { status, premium_users } = getFayConfig();
  const text =
    m.message?.conversation || m.message?.extendedTextMessage?.text || "";
  const senderId = m.key.participant || m.key.remoteJid;
  const chatId = m.key.remoteJid;

  // --- Manajemen Timeout History ---
  if (historyTimeouts.has(chatId)) {
    clearTimeout(historyTimeouts.get(chatId));
    historyTimeouts.delete(chatId);
  }
  if (text.startsWith(config.prefix)) return false; // Jangan proses jika pesan adalah command

  // 1. Cek status aktivasi Fay
  if (status !== "on") return false;

  // 2. Cek pemicu "Fay"
  if (!text.toLowerCase().includes("fay")) return false;

  // 3. Validasi hak akses
  const isOwner = config.nomorOwner.includes(senderId.split("@")[0]);
  const isPremium = premium_users.includes(senderId);

  if (!isOwner && !isPremium) {
    const reply =
      "Uhm... maaf ya Kakak... Fay kan cuma bisa ngobrol sama yang Premium atau Owner aja... 🥺 Kalau mau ngobrol sama Fay, harus Premium dulu yaa~ 💖";
    await sock.sendMessage(chatId, { text: reply }, { quoted: m });
    return true; // Pesan ditangani (dengan penolakan)
  }

  // --- Filter availableFayTools berdasarkan hak akses pengguna dan status grup ---
  const isGroup = chatId.endsWith("@g.us");
  let botIsAdmin = false;

  if (isGroup) {
    try {
      const groupMetadata = await sock.groupMetadata(chatId);
      const botId = sock.user.id.split(":")[0] + "@s.whatsapp.net";
      const botParticipant = groupMetadata.participants.find(
        (p) => p.id === botId
      );
      botIsAdmin =
        botParticipant &&
        (botParticipant.admin === "admin" ||
          botParticipant.admin === "superadmin");
    } catch (metaError) {
      logger.error(
        "[Fay Handler] Gagal mendapatkan metadata grup saat filtering tools:",
        metaError
      );
      botIsAdmin = false;
    }
  }

  const relevantFayTools = fayTools.filter((tool) => {
    if (tool.ownerOnly && !isOwner) return false;
    if (tool.adminRequired && (!isGroup || !botIsAdmin)) {
      return false;
    }
    // if (tool.premiumOnly && !isPremium && !isOwner) return false; // Jika ada premiumOnly di fayTools
    return true;
  });

  // --- LOG DEBUG: Apa yang dikirim ke AI ---
  logger.info("[Fay Handler] isOwner:", isOwner, "isPremium:", isPremium);
  logger.info("[Fay Handler] isGroup:", isGroup, "botIsAdmin:", botIsAdmin);
  logger.info(
    "[Fay Handler] Relevant Fay Tools (filtered):",
    JSON.stringify(
      relevantFayTools.map((t) => ({
        name: t.toolName,
        cmd: t.commandName,
        ownerOnly: t.ownerOnly,
        adminRequired: t.adminRequired,
      })),
      null,
      2
    )
  );

  // 4. Proses ke AI dengan tools yang relevan
  const currentHistory = chatHistories.get(chatId) || [];
  const aiResult = await processWithFayAI(
    text,
    currentHistory,
    relevantFayTools
  );

  const responseText =
    aiResult.response_text || "Hmm, Fay bingung mau jawab apa 🥺";

  // Kirim respons teks Fay (jika ada) sebelum mengeksekusi command
  if (aiResult.response_text) {
    await sock.sendMessage(
      chatId,
      { text: aiResult.response_text },
      { quoted: m }
    );
  }

  // --- Update dan Simpan History ---
  const newHistory = [
    ...currentHistory,
    { role: "user", parts: [{ text }] },
    { role: "model", parts: [{ text: responseText }] },
  ];
  chatHistories.set(chatId, newHistory.slice(-MAX_HISTORY_LENGTH)); // Batasi panjang history

  // Atur timeout baru untuk menghapus history jika tidak aktif
  const newTimeout = setTimeout(() => {
    chatHistories.delete(chatId);
    historyTimeouts.delete(chatId);
    logger.info(
      `[Fay History] Riwayat percakapan untuk chat ${chatId} telah direset karena tidak aktif.`
    );
  }, HISTORY_EXPIRATION_MS);
  historyTimeouts.set(chatId, newTimeout);

  // 5. Pemetaan Perintah dan Eksekusi Tool (Dispatcher)
  // Dapatkan status admin bot lagi untuk eksekusi, jika belum pasti dari filtering
  if (isGroup && !botIsAdmin) {
    try {
      const groupMetadata = await sock.groupMetadata(chatId);
      const botId = sock.user.id.split(":")[0] + "@s.whatsapp.net";
      const botParticipant = groupMetadata.participants.find(
        (p) => p.id === botId
      );
      botIsAdmin =
        botParticipant &&
        (botParticipant.admin === "admin" ||
          botParticipant.admin === "superadmin");
    } catch (metaError) {
      logger.error(
        "[Fay Handler] Gagal mendapatkan metadata grup untuk eksekusi:",
        metaError
      );
      botIsAdmin = false;
    }
  }

  // Helper function untuk eksekusi command
  const executeCommand = async (commandName, params, originalMessage) => {
    const command = commands.get(commandName);
    if (command && typeof command.execute === "function") {
      await command.execute(sock, originalMessage, [], params);
    } else {
      await sock.sendMessage(
        chatId,
        {
          text: `Huhu... Fay nggak nemu perintah "${commandName}" atau perintahnya lagi sakit... 😭`,
        },
        { quoted: originalMessage }
      );
    }
  };

  // --- LOG DEBUG: AI Result ---
  logger.info("[Fay Handler] AI Result Intent:", aiResult.intent);
  logger.info(
    "[Fay Handler] AI Result Parameters:",
    JSON.stringify(aiResult.parameters)
  );

  switch (aiResult.intent) {
    // --- Hardcoded Intent (untuk fungsionalitas inti Fay) ---
    case "promote_member":
    case "demote_member":
    case "kick_member": {
      if (!isGroup || !botIsAdmin) {
        await sock.sendMessage(
          chatId,
          {
            text: "Huhu... Fay nggak bisa lakuin itu, Fay kan bukan admin di sini 🥺",
          },
          { quoted: m }
        );
        break;
      }
      const commandToExecute =
        aiResult.intent === "promote_member"
          ? "promote"
          : aiResult.intent === "demote_member"
          ? "demote"
          : "kick";
      await executeCommand(
        commandToExecute,
        { member_mention: aiResult.parameters.member_mention },
        m
      );
      break;
    }

    case "manage_group_close": {
      if (!isGroup || !botIsAdmin) {
        await sock.sendMessage(
          chatId,
          {
            text: "Huhu... Fay nggak bisa tutup grup ini, Kak... Fay harus jadi admin dulu 🥺",
          },
          { quoted: m }
        );
        break;
      }
      await sock.groupSettingUpdate(chatId, "announcement");
      break;
    }

    case "manage_group_open": {
      if (!isGroup || !botIsAdmin) {
        await sock.sendMessage(
          chatId,
          {
            text: "Huhu... Fay nggak bisa buka grup ini, Kak... Fay harus jadi admin dulu 🥺",
          },
          { quoted: m }
        );
        break;
      }
      await sock.groupSettingUpdate(chatId, "not_announcement");
      break;
    }

    case "add_balance": {
      await executeCommand(
        "addsaldo",
        {
          amount: aiResult.parameters.amount,
          target_user: aiResult.parameters.target_user,
        },
        m
      );
      break;
    }

    case "general_chat":
    case "unknown_command":
    case "clarify_request":
    case "missing_parameter":
      break;

    // --- Dynamic Tool Execution ---
    default: {
      const toolDefinition = fayTools.find(
        (tool) => tool.toolName === aiResult.intent
      );

      // --- LOG DEBUG: Hasil pencarian tool ---
      logger.info(
        "[Fay Handler] Mencari toolDefinition untuk intent:",
        aiResult.intent,
        ". Ditemukan:",
        toolDefinition ? `Ya (${toolDefinition.commandName})` : "Tidak"
      );

      if (toolDefinition) {
        // Cek hak akses lagi sebelum eksekusi command (jaga-jaga jika filter di atas kurang sempurna atau data grup belum update)
        if (toolDefinition.ownerOnly && !isOwner) {
          await sock.sendMessage(
            chatId,
            {
              text: "Huhu... tool ini cuma untuk Owner, Fay nggak bisa lakuin itu 🥺",
            },
            { quoted: m }
          );
          break;
        }
        if (toolDefinition.adminRequired && (!isGroup || !botIsAdmin)) {
          await sock.sendMessage(
            chatId,
            {
              text: "Huhu... tool ini butuh Fay jadi admin grup, Fay nggak bisa lakuin itu 🥺",
            },
            { quoted: m }
          );
          break;
        }

        const commandName = toolDefinition.commandName; // Ambil nama command yang sebenarnya
        await executeCommand(commandName, aiResult.parameters, m);
      } else {
        await sock.sendMessage(
          chatId,
          {
            text: `Huhu... Fay nggak ngerti perintah "${aiResult.intent}" itu maksudnya apa... 😭`,
          },
          { quoted: m }
        );
      }
      break;
    }
  }
}
