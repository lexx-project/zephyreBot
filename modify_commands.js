// modify_commands.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url"; // Untuk mendapatkan __dirname dan __filename di ES Modules

// Dapatkan __filename dan __dirname untuk ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pastikan path ini benar sesuai struktur proyek Anda
// Jika modify_commands.js ada di zephyreTes/, maka 'commands' adalah relatif
const commandsRoot = path.join(__dirname, "commands");

// Array untuk mencatat file yang dimodifikasi dan yang gagal
const modifiedFiles = [];
const failedFiles = [];

/**
 * Memproses satu file command untuk memodifikasi fungsi execute.
 * @param {string} filePath - Path lengkap ke file command.
 */
const processFile = (filePath) => {
  console.log(`[INFO] Memproses file: ${filePath}`);
  let content = fs.readFileSync(filePath, "utf8");
  const originalContent = content;

  // Regex untuk menemukan signature execute yang umum
  // Menangani async execute(sock, m, args) atau async execute(sock, message, args)
  // dan juga jika args sudah punya default value seperti (args = [])
  const executeSignatureRegex =
    /(async\s+execute\s*\(\s*sock\s*,\s*(?:m|message)\s*,\s*args(?:\s*=\s*\[\])?\s*\)\s*\{)/;

  // Periksa apakah ai_tool_params sudah ada di signature (hindari modifikasi berulang)
  // Cek juga `inputFromFay` yang disuntikkan, agar tidak mengulang injeksi
  if (content.includes("ai_tool_params") && content.includes("inputFromFay")) {
    console.log(`[SKIP] File sudah dimodifikasi oleh skrip Fay: ${filePath}`);
    return;
  }

  // --- 1. Modifikasi signature fungsi execute ---
  // Tambahkan 'ai_tool_params = {}' ke signature
  const newSignature =
    "async execute(sock, message, args, ai_tool_params = {}) {";
  content = content.replace(executeSignatureRegex, newSignature);

  if (content === originalContent) {
    console.warn(
      `[WARNING] Signature execute tidak ditemukan atau tidak cocok untuk modifikasi di: ${filePath}`
    );
    failedFiles.push({
      filePath,
      reason: "Signature 'execute' tidak ditemukan atau tidak sesuai pola.",
    });
    return; // Jangan lanjutkan jika signature tidak cocok
  }

  // --- 2. Suntikkan baris kode untuk pengambilan parameter ---
  // Regex untuk menemukan kurung kurawal pembuka dari body fungsi execute yang sudah diubah
  // Kita harus lebih spesifik agar tidak salah inject
  const executeBodyOpenBraceRegex =
    /(async\s+execute\s*\(\s*sock\s*,\s*message\s*,\s*args(?:\s*=\s*\[\])?\s*,\s*ai_tool_params\s*=\s*\{\}\s*\)\s*\{)/; // Sesuaikan dengan newSignature
  const match = content.match(executeBodyOpenBraceRegex);

  if (match) {
    const insertPosition =
      content.indexOf("{", match.index + match[0].length - 1) + 1; // Posisi setelah '{'
    const initialContentBeforeBody = content.substring(0, insertPosition);
    const contentAfterBody = content.substring(insertPosition);

    const injectedCode = `
    // --- Otomatis ditambahkan oleh Skrip Modifikasi Fay ---
    const aiParams = ai_tool_params || {}; // Pastikan objek aiParams selalu ada
    // Variabel 'inputFromFay' akan berisi input utama dari AI atau dari args.
    // Gunakan ini sebagai pengganti langsung 'args.join(" ")' atau 'args[0/1/...]'.
    const inputFromFay = aiParams.query || aiParams.url || aiParams.text || aiParams.prompt || 
                         aiParams.amount || aiParams.targetNumber || aiParams.itemId || 
                         aiParams.betAmount || aiParams.durationDays || aiParams.member_mention || aiParams.reason || 
                         aiParams.action || aiParams.choice || // Tambahkan parameter lain yang mungkin dari game/fun
                         args.join(" "); // Fallback ke args.join(" ")

    // CATATAN PENTING:
    // Sekarang, Anda perlu SECARA MANUAL mengganti baris pengambilan parameter 'args' yang ada
    // di command ini dengan 'inputFromFay' atau 'aiParams.nama_parameter_spesifik'.
    //
    // Contoh PENGGANTIAN:
    // SEBELUM:   const myVariable = args.join(" ");
    // SESUDAH:   const myVariable = inputFromFay;
    //
    // SEBELUM:   const myUrl = args[0];
    // SESUDAH:   const myUrl = inputFromFay;
    //
    // SEBELUM:   const myNumber = parseInt(args[1]);
    // SESUDAH:   const myNumber = aiParams.amount || parseInt(args[1]); // Lebih spesifik jika AI pakai 'amount'
    //
    // --- Akhir Bagian Otomatis ---
    `;

    content = initialContentBeforeBody + injectedCode + contentAfterBody;

    fs.writeFileSync(filePath, content, "utf8");
    modifiedFiles.push(filePath);
    console.log(`[BERHASIL] Dimodifikasi: ${filePath}`);
  } else {
    failedFiles.push({
      filePath,
      reason:
        "Body fungsi 'execute' tidak ditemukan setelah modifikasi signature (pola tidak cocok).",
    });
    console.warn(
      `[WARNING] Body execute tidak ditemukan setelah modifikasi signature di: ${filePath}`
    );
  }
};

/**
 * Fungsi rekursif untuk menemukan dan memproses semua file command.
 * @param {string} currentPath - Path direktori saat ini.
 */
const findAndProcessCommands = (currentPath) => {
  const items = fs.readdirSync(currentPath, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(currentPath, item.name);
    if (item.isDirectory()) {
      findAndProcessCommands(fullPath); // Rekursif untuk subfolder
    } else if (item.isFile() && item.name.endsWith(".js")) {
      // Lewati file yang tidak relevan atau sudah dimodifikasi secara manual/khusus
      // Contoh: file menu, atau file yang sudah Anda pastikan tidak perlu AI access
      if (
        item.name.includes("menu.js") ||
        item.name === "fay.js" ||
        item.name === "wwpc.js" ||
        item.name === "qc.js"
      ) {
        console.log(`[SKIP] Melewatkan file: ${item.name}`);
        continue;
      }
      processFile(fullPath);
    }
  }
};

// --- Jalankan Skrip ---
console.log("Memulai modifikasi file command...");
console.log("Pastikan Anda sudah BACKUP folder commands Anda!");
findAndProcessCommands(commandsRoot);
console.log("\nModifikasi selesai!");
console.log("------------------------------------");
console.log(`File berhasil dimodifikasi: ${modifiedFiles.length}`);
modifiedFiles.forEach((file) => console.log(`  - ${file}`));
console.log(`\nFile yang gagal dimodifikasi: ${failedFiles.length}`);
failedFiles.forEach((entry) =>
  console.log(`  - ${entry.filePath} (${entry.reason})`)
);
console.log("------------------------------------");
console.log("\nLANGKAH MANUAL TERAKHIR (PENTING):");
console.log(
  "Periksa kembali setiap file yang dimodifikasi, terutama bagian pengambilan parameter."
);
console.log(
  "Ganti `const nama_variabel = args.join(' ');` atau `const nama_variabel = args[0/1/...]`"
);
console.log(
  "menjadi `const nama_variabel = inputFromFay;` (atau `aiParams.nama_parameter_spesifik` jika lebih yakin)."
);
console.log(
  "Variabel 'aiParams' dan 'inputFromFay' sudah tersedia di awal fungsi execute."
);
console.log("\nSETELAH ITU, RESTART BOT ANDA!");
