import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
} from "@yupra/baileys";
import qrcode from "qrcode-terminal";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import cron from "node-cron";
import config from "./config/setting.js";
import {
  rateLimiter,
  messageFormatter,
  validator,
  logger,
  timeFormatter,
} from "./utils/helpers.js";
import {
  loadDatabase,
  getGroup,
  getGroupRentals,
  removeGroupRental,
  clearWelcomeMessage,
  hasLimit,
  useLimit,
  isOwner,
  getUserStatus,
  isGcOnlyEnabled,
  canReceiveGcOnlyNotification,
  setGcOnlyNotificationTime,
  isBanned,
  isPremium,
} from "./utils/database.js";
import { menfessManager } from "./utils/menfessManager.js";
import { afkManager } from "./utils/afkManager.js";
import { handleFayInteraction } from "./lib/fayHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map untuk menyimpan commands
const commands = new Map();
let rentalCheckInterval = null; // Flag untuk memastikan interval hanya diset sekali

// --- JADWAL SHOLAT SCHEDULER ---
const prayerSchedules = new Map(); // Global map untuk menyimpan jadwal sholat

async function fetchPrayerSchedule(city, country) {
  try {
    if (!config.apikey.maelyn || config.apikey.maelyn === "lexxganz") {
      logger.warn(
        "[JADWAL SHOLAT] API Key Maelyn belum diatur dengan benar. Menggunakan 'lexxganz' sebagai default."
      );
    }
    const response = await axios.get(
      `https://api.maelyn.sbs/api/jadwalsholat?city=${city}&country=${country}`,
      {
        headers: { "mg-apikey": config.apikey.maelyn },
      }
    );
    if (response.data && response.data.success) {
      logger.info(`[JADWAL SHOLAT] Berhasil mengambil jadwal untuk ${city}`);
      // Perhatikan .data.data karena respons API mungkin memiliki data bersarang
      return { ...response.data.data.data, notifiedFor: [] };
    }
  } catch (error) {
    logger.error(
      `[JADWAL SHOLAT] Gagal mengambil jadwal untuk ${city}:`,
      error.message
    );
  }
  return null;
}

async function updateAllSchedules() {
  logger.info("[JADWAL SHOLAT] Memperbarui semua jadwal sholat...");
  const db = loadDatabase(); // Memuat database untuk mendapatkan konfigurasi grup
  for (const groupId in db.groups) {
    if (db.groups[groupId]?.jadwalsholat?.enabled) {
      const city = db.groups[groupId].jadwalsholat.city || "Jakarta";
      const schedule = await fetchPrayerSchedule(city, "Indonesia"); // Negara hardcoded Indonesia
      if (schedule) {
        prayerSchedules.set(groupId, schedule);
      }
    }
  }
}

async function checkPrayerTimes(sock) {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;

  for (const [groupId, schedule] of prayerSchedules.entries()) {
    // Pastikan properti jadwal sholat ada
    const prayerTimes = {
      Fajr: schedule.Fajr,
      Sunrise: schedule.Sunrise,
      Dhuhr: schedule.Dhuhr,
      Asr: schedule.Asr,
      Maghrib: schedule.Maghrib,
      Isha: schedule.Isha,
    };

    for (const prayerName in prayerTimes) {
      if (prayerTimes[prayerName] === currentTime) {
        // Cek apakah sudah dinotifikasi untuk waktu sholat ini hari ini
        if (!schedule.notifiedFor.includes(prayerName)) {
          const message = `🕌 Waktunya *Sholat ${prayerName}* untuk wilayah ${
            getGroup(groupId)?.jadwalsholat?.city || "Jakarta"
          } dan sekitarnya.`;
          logger.info(
            `[JADWAL SHOLAT] Mengirim notifikasi ${prayerName} ke grup ${groupId}`
          );
          await sock.sendMessage(groupId, { text: message });
          schedule.notifiedFor.push(prayerName); // Tandai sudah dinotifikasi
        }
      }
    }
  }
}
// --- END OF JADWAL SHOLAT SCHEDULER ---

// Fungsi untuk memuat semua commands
async function loadCommands() {
  try {
    const commandsPath = path.join(__dirname, "commands");
    let totalCommands = 0;

    // Function to load commands from a directory
    async function loadCommandsFromDir(dirPath, category = "unknown") {
      const items = fs.readdirSync(dirPath);

      // Load JS files as commands
      const commandFiles = items.filter((file) => file.endsWith(".js"));
      for (const file of commandFiles) {
        const filePath = path.join(dirPath, file);
        try {
          const commandModule = await import(`file://${filePath}`);
          const command = commandModule.default || commandModule.command;

          if (command && command.name) {
            commands.set(command.name, { ...command, category });
            console.log(
              `✅ Command '${command.name}' (${category}) berhasil dimuat`
            );
            totalCommands++;

            // Register aliases if any
            if (command.aliases && Array.isArray(command.aliases)) {
              command.aliases.forEach((alias) => {
                commands.set(alias, { ...command, category });
                console.log(
                  `✅ Alias '${alias}' untuk '${command.name}' (${category}) berhasil dimuat`
                );
              });
            }
          } else {
            console.log(
              `❌ Command di file '${file}' tidak valid (tidak ada nama atau export)`
            );
          }
        } catch (error) {
          console.error(`❌ Gagal memuat command dari file '${file}':`, error);
        }
      }

      // Check subdirectories
      const subdirs = items.filter((item) => {
        const itemPath = path.join(dirPath, item);
        return fs.statSync(itemPath).isDirectory();
      });

      // Load commands from subdirectories
      for (const subdir of subdirs) {
        const subdirPath = path.join(dirPath, subdir);
        await loadCommandsFromDir(subdirPath, subdir); // Meneruskan nama subdirektori sebagai kategori
      }
    }

    // Start loading from main commands directory
    console.log(`📁 Memuat commands dari folder commands...`);
    await loadCommandsFromDir(commandsPath);

    console.log(`🎉 Total ${totalCommands} command(s) berhasil dimuat\n`);
  } catch (error) {
    console.error("❌ Error saat memuat commands:", error);
  }
}

// Fungsi untuk memastikan file data RPG ada
function setupRpgDataFiles() {
  const libPath = path.join(__dirname, "lib");
  const rpgPath = path.join(libPath, "rpg");
  const baitFilePath = path.join(rpgPath, "bait.json");
  const fishFilePath = path.join(rpgPath, "fish.json");

  const baitDataContent = `[
  {
    "id": "cacing",
    "name": "Umpan Cacing",
    "price": 10,
    "emoji": "🪱"
  },
  {
    "id": "udang",
    "name": "Umpan Udang",
    "price": 30,
    "emoji": "🦐"
  },
  {
    "id": "premium",
    "name": "Umpan Premium",
    "price": 100,
    "emoji": "🌟"
  }
]`;

  const fishDataContent = `[
  { "id": "lele", "name": "Ikan Lele", "rarity": "common", "min_price": 5, "max_price": 15, "emoji": "🐟" },
  { "id": "nila", "name": "Ikan Nila", "rarity": "common", "min_price": 7, "max_price": 18, "emoji": "🐠" },
  { "id": "sepatu", "name": "Sepatu Bot", "rarity": "trash", "min_price": 1, "max_price": 1, "emoji": "👢" },
  { "id": "plastik", "name": "Sampah Plastik", "rarity": "trash", "min_price": 1, "max_price": 1, "emoji": "🛍️" },
  { "id": "gurame", "name": "Ikan Gurame", "rarity": "uncommon", "min_price": 20, "max_price": 40, "emoji": "🐡" },
  { "id": "bawal", "name": "Ikan Bawal", "rarity": "uncommon", "min_price": 25, "max_price": 45, "emoji": "🐠" },
  { "id": "salmon", "name": "Ikan Salmon", "rarity": "rare", "min_price": 50, "max_price": 100, "emoji": "🍣" },
  { "id": "tuna", "name": "Ikan Tuna", "rarity": "rare", "min_price": 60, "max_price": 120, "emoji": "🎣" },
  { "id": "megalodon", "name": "Hiu Megalodon", "rarity": "legendary", "min_price": 500, "max_price": 1000, "emoji": "🦈" }
]`;

  try {
    if (!fs.existsSync(libPath)) fs.mkdirSync(libPath);
    if (!fs.existsSync(rpgPath)) fs.mkdirSync(rpgPath);

    if (!fs.existsSync(baitFilePath)) {
      fs.writeFileSync(baitFilePath, baitDataContent);
      logger.info(`[SETUP] Created RPG data file: ${baitFilePath}`);
    }

    if (!fs.existsSync(fishFilePath)) {
      fs.writeFileSync(fishFilePath, fishDataContent);
      logger.info(`[SETUP] Created RPG data file: ${fishFilePath}`);
    }
  } catch (error) {
    logger.error("[SETUP] Failed to create RPG data files:", error);
    process.exit(1); // Exit if we can't create essential files
  }
}

// Fungsi untuk menangani pesan
async function handleMessage(sock, message) {
  try {
    // Skip jika pesan dari bot sendiri
    if (message.key.fromMe) return;

    // --- Start: Message Text Extraction ---
    // This logic is now more robust to handle various message types,
    // including standard text, captions, and different interactive replies.
    let text =
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      message.message?.imageMessage?.caption ||
      message.message?.videoMessage?.caption ||
      message.message?.buttonsResponseMessage?.selectedButtonId ||
      message.message?.templateButtonReplyMessage?.selectedId ||
      message.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
      "";

    // Handle Native Flow (List Menu) responses
    if (
      message.message?.interactiveResponseMessage &&
      message.message.interactiveResponseMessage.nativeFlowResponseMessage
    ) {
      const paramsJson =
        message.message.interactiveResponseMessage.nativeFlowResponseMessage
          .paramsJson;
      if (paramsJson) {
        try {
          const params = JSON.parse(paramsJson);
          // We set the ID to be the command itself, e.g., ".mainmenu"
          text = params.id || "";
        } catch (e) {
          logger.error("Error parsing native flow response:", e);
        }
      }
    }
    // --- End: Message Text Extraction ---

    const sender = message.key.participant || message.key.remoteJid;
    const senderNumber = sender.split("@")[0];
    const isGroup = validator.isGroup(message.key.remoteJid);
    const isOwnerUser = validator.isOwner(sender);
    const chatId = message.key.remoteJid;

    // --- AFK System ---
    if (isGroup) {
      // 1. Check if the sender is returning from AFK
      // This check happens for any message, so it must come before command processing.
      const afkData = afkManager.removeAfk(chatId, sender);
      if (afkData) {
        const timeAway = Date.now() - afkData.time;
        const formattedTime = timeFormatter.formatUptime(timeAway / 1000);
        const backMessage = `👋 Welcome back, *@${senderNumber}*!\n\nYou were AFK for *${formattedTime}*.\n*Reason:* ${afkData.reason}`;
        await sock.sendMessage(
          chatId,
          { text: backMessage, mentions: [sender] },
          { quoted: message } // Menambahkan reply ke pesan user
        );
      }

      // 2. Check if the message mentions any AFK users
      const mentionedJids =
        message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (mentionedJids.length > 0) {
        for (const jid of mentionedJids) {
          if (afkManager.isAfk(chatId, jid)) {
            const mentionedAfkData = afkManager.getAfkData(chatId, jid);
            const timeSince = Date.now() - mentionedAfkData.time;
            const formattedTimeSince = timeFormatter.formatUptime(
              timeSince / 1000
            );
            const afkNotice = `🤫 Shhh, *@${
              jid.split("@")[0]
            }* is currently AFK.\n\n*Reason:* ${
              mentionedAfkData.reason
            }\n*Since:* ${formattedTimeSince} ago.`;
            await sock.sendMessage(
              chatId,
              { text: afkNotice, mentions: [jid] },
              { quoted: message }
            );
          }
        }
      }
    }
    // --- End AFK System ---

    // Cek apakah user diban (owner tidak terpengaruh)
    if (isBanned(sender) && !isOwnerUser) {
      logger.warning(
        `🚫 Pesan dari user yang diban diabaikan: ${senderNumber}`
      );
      return; // Hentikan proses jika user diban
    }

    // Log pesan masuk dengan informasi tambahan
    logger.info(
      `[CHAT] dari ${senderNumber} ${isGroup ? "(Grup)" : "(Pribadi)"}: ${text}`
    );

    // Cek apakah user sedang dalam sesi menfess dan bukan command
    const session = menfessManager.findSession(sender);
    if (session && !text.startsWith(config.prefix)) {
      const partnerJid = session.partnerJid;
      try {
        // Forward pesan ke partner
        await sock.sendMessage(partnerJid, {
          text: `💬 *Partner:* ${text}`,
        });
      } catch (e) {
        logger.error(
          `[MENFESS PROXY] Gagal mengirim pesan ke ${partnerJid}: ${e.message}`
        );
        await sock.sendMessage(sender, {
          text: "Gagal mengirim pesan, mungkin partner memblokir bot atau sesi telah berakhir.",
        });
      }
      return; // Hentikan proses, karena ini adalah pesan dalam sesi
    }

    // --- Fay AI Interaction ---
    // Cek apakah pesan ini untuk Fay, sebelum mengecek prefix command.
    // handleFayInteraction akan mengembalikan `true` jika pesan berhasil diproses.
    try {
      const isFayHandled = await handleFayInteraction(sock, message, commands);
      if (isFayHandled) return; // Jika Fay menangani pesan, hentikan proses lebih lanjut.
    } catch (fayError) {
      logger.error("[Fay Integration] Error:", fayError);
    }
    // --- End of Fay AI Interaction ---

    // Check for game answers before checking prefix
    if (!text.startsWith(config.prefix)) {
      // Try to handle as family100 answer
      const family100Command = commands.get("family100");
      if (family100Command && family100Command.handleAnswer) {
        const handled = await family100Command.handleAnswer(
          sock,
          message,
          text
        );
        if (handled) return; // Answer was processed, don't continue
      }

      // Try to handle as kuis answer
      const kuisCommand = commands.get("kuis");
      if (kuisCommand && kuisCommand.handleAnswer) {
        const handled = await kuisCommand.handleAnswer(sock, message, text);
        if (handled) return; // Answer was processed, don't continue
      }

      // Try to handle as tebakgambar answer
      const tebakgambarCommand = commands.get("tebakgambar");
      if (tebakgambarCommand && tebakgambarCommand.handleAnswer) {
        const handled = await tebakgambarCommand.handleAnswer(
          sock,
          message,
          text
        );
        if (handled) return; // Answer was processed, don't continue
      }

      // Try to handle as susunkata answer
      const susunkataCommand = commands.get("susunkata");
      if (susunkataCommand && susunkataCommand.handleAnswer) {
        const handled = await susunkataCommand.handleAnswer(
          sock,
          message,
          text
        );
        if (handled) return; // Answer was processed, don't continue
      }

      // Try to handle as tebakbendera answer
      const tebakbenderaCommand = commands.get("tebakbendera");
      if (tebakbenderaCommand && tebakbenderaCommand.handleAnswer) {
        const handled = await tebakbenderaCommand.handleAnswer(
          sock,
          message,
          text
        );
        if (handled) return; // Answer was processed, don't continue
      }

      // Try to handle as siapakahaku answer
      const siapakahakuCommand = commands.get("siapakahaku");
      if (siapakahakuCommand && siapakahakuCommand.checkAnswer) {
        const handled = await siapakahakuCommand.checkAnswer(
          sock,
          message,
          text
        );
        if (handled) return; // Answer was processed, don't continue
      }

      // Try to handle as tebaklirik answer
      const tebaklirikCommand = commands.get("tebaklirik");
      if (tebaklirikCommand && tebaklirikCommand.checkAnswer) {
        const handled = await tebaklirikCommand.checkAnswer(
          sock,
          message,
          text
        );
        if (handled) return; // Answer was processed, don't continue
      }

      // Try to handle as tebaklagu answer
      const tebaklaguCommand = commands.get("tebaklagu");
      if (tebaklaguCommand && tebaklaguCommand.checkAnswer) {
        const handled = await tebaklaguCommand.checkAnswer(sock, message, text);
        if (handled) return; // Answer was processed, don't continue
      }

      return; // Not a command and not a game answer
    }

    // Parse command dan arguments
    const args = text.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // Cari command
    const command = commands.get(commandName);

    if (command) {
      // Definisikan aksi menfess di sini agar bisa digunakan di beberapa pengecekan
      const isMenfessAction =
        command.name === "menfess" &&
        ["terima", "tolak", "stop"].includes(args[0]?.toLowerCase());

      // Cek permission jika command memerlukan owner
      if (command.ownerOnly && !isOwnerUser) {
        await messageFormatter.sendMessage(
          sock,
          message.key.remoteJid,
          {
            text: messageFormatter.warning(config.messages.owner),
          },
          message
        );
        return;
      }

      // Cek apakah command hanya untuk grup
      if (command.groupOnly && !isGroup) {
        await messageFormatter.sendMessage(
          sock,
          message.key.remoteJid,
          {
            text: messageFormatter.warning(config.messages.group),
          },
          message
        );
        return;
      }

      // Cek apakah command hanya untuk private chat
      if (command.privateOnly && isGroup) {
        await messageFormatter.sendMessage(
          sock,
          message.key.remoteJid,
          {
            text: messageFormatter.warning(config.messages.private),
          },
          message
        );
        return;
      }

      // Cek gcOnly mode (kecuali owner, premium, werewolf commands, dan command owner)
      if (isGcOnlyEnabled() && !isGroup && !isOwnerUser) {
        const userIsPremium = isPremium(sender);
        const isWerewolfCommand =
          commandName.startsWith("ww") || commandName === "werewolf";
        const isOwnerCommand = commandName === "owner";

        if (
          !userIsPremium &&
          !isWerewolfCommand &&
          !isOwnerCommand &&
          !isMenfessAction
        ) {
          // Cek apakah user bisa menerima notifikasi (rate limiting)
          if (canReceiveGcOnlyNotification(sender)) {
            await messageFormatter.sendMessage(
              sock,
              message.key.remoteJid,
              {
                text: messageFormatter.warning(
                  "🔒 *BOT DALAM MODE GRUP ONLY*\n\n" +
                    "❌ Bot saat ini hanya bisa digunakan di grup\n" +
                    "💎 Untuk menggunakan di chat pribadi, upgrade ke Premium\n\n" +
                    "📋 *Cara upgrade Premium:*\n" +
                    "• Chat owner untuk upgrade premium\n" +
                    "• Harga: Rp 5.000 per 30 hari"
                ),
              },
              message
            );
            setGcOnlyNotificationTime(sender);
          }
          return;
        }
      }

      // --- Pengecekan Limit ---
      const userStatus = getUserStatus(sender);
      // Pengecualian: Owner, command dengan flag limitExempt, dan aksi menfess.
      const isExemptFromLimit =
        command.limitExempt || userStatus === "owner" || isMenfessAction;

      // Jika tidak ada pengecualian, cek dan kurangi limit.
      if (!isExemptFromLimit) {
        if (!hasLimit(sender)) {
          await messageFormatter.sendMessage(
            sock,
            message.key.remoteJid,
            {
              text: messageFormatter.warning(
                `❌ Limit harian Anda sudah habis!\n\nLimit akan direset setiap jam 00:00 WIB.\nKetik *${config.prefix}buylimit* untuk membeli limit tambahan.`
              ),
            },
            message
          );
          return;
        }
        useLimit(sender);
      }

      logger.info(
        `🤖 Menjalankan command: ${commandName} oleh ${senderNumber}`
      );
      // Meneruskan seluruh daftar commands ke fungsi execute
      await command.execute(sock, message, args, commands);
    } else {
      logger.warning(
        `❓ Command tidak ditemukan: ${commandName} dari ${senderNumber}`
      );
    }
  } catch (error) {
    logger.error("❌ Error saat menangani pesan:", error);

    // Kirim pesan error ke user jika memungkinkan
    try {
      await messageFormatter.sendMessage(
        sock,
        message.key.remoteJid,
        {
          text: messageFormatter.error(
            "Terjadi kesalahan saat memproses pesan Anda!"
          ),
        },
        message
      );
    } catch (sendError) {
      logger.error("❌ Error saat mengirim pesan error:", sendError);
    }
  }
}

// Fungsi utama untuk menjalankan bot
async function startBot() {
  // Setup file data RPG
  setupRpgDataFiles();

  // Muat commands terlebih dahulu
  await loadCommands();

  // Setup auth state
  const { state, saveCreds } = await useMultiFileAuthState("./session");

  // Buat socket WhatsApp
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // Deprecated, akan kita handle manual
    logger: {
      level: "silent",
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      fatal: () => {},
      child: () => ({
        level: "silent",
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {},
        child: () => ({
          level: "silent",
          trace: () => {},
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
          fatal: () => {},
        }),
      }),
    },
    browser: [config.namaBot, "Chrome", "1.0.0"],
  });

  // --- JADWAL SHOLAT INITIALIZATION ---
  logger.info("[JADWAL SHOLAT] Menginisialisasi scheduler...");
  await updateAllSchedules(); // Initial fetch on startup
  // Check every minute
  setInterval(() => checkPrayerTimes(sock), 60000);
  // Update schedules daily at 00:01
  cron.schedule("1 0 * * *", updateAllSchedules, { timezone: "Asia/Jakarta" });
  // --- END OF INITIALIZATION ---

  // Event handler untuk koneksi
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("📱 Scan QR Code berikut untuk login:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;
      const reason = lastDisconnect?.error?.output?.statusCode;

      let disconnectReason = "Unknown";
      switch (reason) {
        case DisconnectReason.badSession:
          disconnectReason = "Bad Session File";
          break;
        case DisconnectReason.connectionClosed:
          disconnectReason = "Connection Closed";
          break;
        case DisconnectReason.connectionLost:
          disconnectReason = "Connection Lost";
          break;
        case DisconnectReason.connectionReplaced:
          disconnectReason = "Connection Replaced";
          break;
        case DisconnectReason.loggedOut:
          disconnectReason = "Logged Out";
          break;
        case DisconnectReason.restartRequired:
          disconnectReason = "Restart Required";
          break;
        case DisconnectReason.timedOut:
          disconnectReason = "Timed Out";
          break;
      }

      logger.warning(`❌ Koneksi terputus: ${disconnectReason} (${reason})`);

      if (shouldReconnect) {
        logger.info("🔄 Mencoba reconnect dalam 5 detik...");
        setTimeout(() => {
          startBot();
        }, 5000);
      } else {
        logger.error("🛑 Bot logout, scan ulang QR code untuk login");
      }
    } else if (connection === "open") {
      logger.info("✅ Bot berhasil terhubung!");
      logger.info(`🤖 ${config.namaBot} siap digunakan!`);
      logger.info(`📋 Prefix: ${config.prefix}`);
      logger.info(`👑 Owner: ${config.nomorOwner}`);
      logger.info(`⏰ Started at: ${timeFormatter.formatDate()}`);
      logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

      // --- RENTAL CHECKER ---
      // Hanya set interval jika belum ada
      if (!rentalCheckInterval) {
        logger.info("[SYSTEM] Mengatur interval pengecekan sewa grup.");
        // Cek setiap 1 jam
        rentalCheckInterval = setInterval(async () => {
          const rentedGroups = getGroupRentals();
          const now = new Date();
          logger.info(
            `[RENTAL CHECK] Menjalankan pengecekan sewa untuk ${
              Object.keys(rentedGroups).length
            } grup...`
          );

          for (const groupId in rentedGroups) {
            const group = rentedGroups[groupId];
            const expiryDate = new Date(group.expiry);

            if (now > expiryDate) {
              logger.warning(
                `[RENTAL EXPIRED] Sewa untuk grup ${groupId} telah berakhir.`
              );
              try {
                const farewellMessage = `
👋 *Masa Sewa Telah Berakhir*

Terima kasih telah menggunakan *${config.namaBot}*.
Masa sewa bot di grup ini telah habis. Bot akan keluar secara otomatis.

Untuk memperpanjang, silakan hubungi owner.
Ketik \`${config.prefix}owner\` untuk info kontak.

Sampai jumpa lagi! 😊`;
                await sock.sendMessage(groupId, {
                  text: farewellMessage.trim(),
                });
                await new Promise((resolve) => setTimeout(resolve, 2000)); // Tunggu 2 detik sebelum keluar
                await sock.groupLeave(groupId);
                removeGroupRental(groupId);
                logger.info(
                  `[RENTAL EXPIRED] Bot berhasil keluar dari grup ${groupId}.`
                );
              } catch (err) {
                logger.error(
                  `[RENTAL EXPIRED] Gagal keluar dari grup ${groupId}: ${err.message}`
                );
                // Hapus dari DB agar tidak mencoba terus-menerus
                removeGroupRental(groupId);
              }
            }
          }
        }, 3600 * 1000); // Cek setiap 1 jam (3600 detik * 1000 ms)
      }
    } else if (connection === "connecting") {
      logger.info("🔄 Menghubungkan ke WhatsApp...");
    }
  });

  // Event handler untuk update kredensial
  sock.ev.on("creds.update", saveCreds);

  // Event handler untuk join grup (termasuk setelah disetujui)
  sock.ev.on("groups.upsert", async (groups) => {
    for (const group of groups) {
      logger.info(
        `[GROUPS.UPSERT] Event received for group ID: ${group.id}`,
        group
      );
      // Cek apakah bot baru saja ditambahkan ke grup
      // group.subject akan ada jika ini adalah join baru atau update nama
      if (group.subject && group.id) {
        const rentedGroups = getGroupRentals();
        const rentalInfo = rentedGroups[group.id];

        // Kirim pesan selamat datang jika ada dan belum terkirim
        if (rentalInfo && rentalInfo.welcomeMessage) {
          logger.info(
            `[SEWA] Bot diterima di grup sewaan: ${group.id} (${group.subject}). Mengirim pesan selamat datang.`
          );
          try {
            await new Promise((resolve) => setTimeout(resolve, 3000)); // Tunggu 3 detik untuk memastikan bot sudah sepenuhnya join
            await sock.sendMessage(group.id, {
              text: rentalInfo.welcomeMessage,
            });
            // Hapus pesan selamat datang dari DB agar tidak dikirim lagi
            clearWelcomeMessage(group.id);
            logger.info(
              `[SEWA] Pesan selamat datang berhasil dikirim ke ${group.id}.`
            );
          } catch (err) {
            logger.error(
              `[SEWA] Gagal mengirim pesan selamat datang ke ${group.id}: ${err.message}`
            );
          }
        } else {
          logger.info(
            `[GROUPS.UPSERT] No pending welcome message for group ${group.id}.`
          );
        }
      }
    }
  });

  // Event handler untuk pesan masuk
  sock.ev.on("messages.upsert", async (messageUpdate) => {
    const messages = messageUpdate.messages;

    for (const message of messages) {
      await handleMessage(sock, message);
    }
  });
}

// Process error handlers
process.on("uncaughtException", (error) => {
  logger.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("❌ Unhandled Rejection at:", { promise, reason });
});

process.on("SIGINT", () => {
  logger.info("🛑 Bot dihentikan oleh user (SIGINT)");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("🛑 Bot dihentikan oleh sistem (SIGTERM)");
  process.exit(0);
});

// Jalankan bot
logger.info("🚀 Memulai ZephyreBot...");
logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
logger.info(
  `📋 Konfigurasi: Bot=${config.namaBot}, Owner=${config.nomorOwner}, Prefix=${config.prefix}`
);
startBot().catch((error) => {
  logger.error("❌ Fatal error saat menjalankan bot:", error);
  process.exit(1);
});
