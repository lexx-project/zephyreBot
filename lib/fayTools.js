// zephyreTes/lib/fayTools.js

export const fayTools = [
  {
    toolName: "tiktok",
    commandName: "tiktok",
    description: "Mengunduh video dari TikTok menggunakan URL.",
    parameters: [
      {
        name: "url",
        type: "string",
        description: "URL video TikTok yang ingin diunduh.",
      },
    ],
  },
  {
    toolName: "youtube_search",
    commandName: "ytsearch",
    description: "Mencari video di YouTube berdasarkan judul.",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Judul video YouTube yang ingin dicari.",
      },
    ],
  },
  {
    toolName: "youtube_download",
    commandName: "play",
    description:
      "Mengunduh audio atau video dari YouTube menggunakan URL atau judul.",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Judul video YouTube yang ingin diunduh (untuk audio).",
      },
      {
        name: "url",
        type: "string",
        description: "URL video YouTube yang ingin diunduh.",
      },
    ],
  },
  {
    toolName: "emojimix",
    commandName: "emojimix",
    description: "Membuat emoji mashup dari dua emoji.",
    parameters: [
      { name: "emoji1", type: "string", description: "Emoji pertama." },
      { name: "emoji2", type: "string", description: "Emoji kedua." },
    ],
  },
  {
    toolName: "sticker_brat",
    commandName: "brat",
    description: "Membuat stiker dengan gaya 'brat' dari teks yang diberikan.",
    parameters: [
      {
        name: "text",
        type: "string",
        description: "Teks yang ingin dijadikan stiker brat.",
      },
    ],
  },
  {
    toolName: "sticker_attp",
    commandName: "attp",
    description: "Membuat stiker teks animasi dari teks yang diberikan.",
    parameters: [
      {
        name: "text",
        type: "string",
        description: "Teks yang ingin dijadikan stiker ATTP.",
      },
    ],
  },
  {
    toolName: "sticker_ttp",
    commandName: "ttp",
    description: "Membuat stiker teks statis dari teks yang diberikan.",
    parameters: [
      {
        name: "text",
        type: "string",
        description: "Teks yang ingin dijadikan stiker TTP.",
      },
    ],
  },
  {
    toolName: "image_to_sticker",
    commandName: "sticker",
    description:
      "Mengubah gambar menjadi stiker. Gunakan dengan me-reply gambar.",
    parameters: [], // Tidak ada parameter teks, karena ini adalah reply
  },
  {
    toolName: "video_to_sticker",
    commandName: "sticker",
    description:
      "Mengubah video pendek atau GIF menjadi stiker. Gunakan dengan me-reply video/GIF.",
    parameters: [], // Tidak ada parameter teks, karena ini adalah reply
  },
  {
    toolName: "remove_background",
    commandName: "rb",
    description:
      "Menghapus latar belakang dari gambar. Gunakan dengan me-reply gambar.",
    parameters: [], // Tidak ada parameter teks, karena ini adalah reply
  },
  {
    toolName: "upscale_image",
    commandName: "upscale",
    description:
      "Meningkatkan resolusi gambar. Gunakan dengan me-reply gambar.",
    parameters: [], // Tidak ada parameter teks, karena ini adalah reply
  },
  {
    toolName: "remini_image",
    commandName: "remini",
    description:
      "Memperbaiki kualitas gambar lama atau buram. Gunakan dengan me-reply gambar.",
    parameters: [], // Tidak ada parameter teks, karena ini adalah reply
  },
  {
    toolName: "to_hd_image",
    commandName: "tohd",
    description:
      "Mengubah gambar menjadi kualitas HD. Gunakan dengan me-reply gambar.",
    parameters: [], // Tidak ada parameter teks, karena ini adalah reply
  },
  {
    toolName: "text_to_image",
    commandName: "aiimg",
    description: "Membuat gambar dari deskripsi teks (text-to-image).",
    parameters: [
      {
        name: "prompt",
        type: "string",
        description: "Deskripsi gambar yang ingin dibuat.",
      },
    ],
  },
  {
    toolName: "ai_chat",
    commandName: "ai",
    description:
      "Berinteraksi dengan AI untuk pertanyaan umum atau percakapan.",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Pertanyaan atau topik percakapan.",
      },
    ],
  },
  {
    toolName: "speedtest",
    commandName: "speedtest",
    description: "Melakukan tes kecepatan internet.",
    parameters: [],
  },
  {
    toolName: "cek_limit",
    commandName: "ceklimit",
    description: "Mengecek sisa limit penggunaan bot.",
    parameters: [],
  },
  {
    toolName: "get_owner_info",
    commandName: "owner",
    description: "Mendapatkan informasi kontak owner bot.",
    parameters: [],
  },
  {
    toolName: "get_menu",
    commandName: "menu",
    description: "Menampilkan daftar semua perintah yang tersedia.",
    parameters: [],
  },
  {
    toolName: "get_group_link",
    commandName: "linkgrup",
    description: "Mendapatkan link undangan grup WhatsApp saat ini.",
    parameters: [],
    adminRequired: true, // Contoh: Perintah ini butuh bot jadi admin
  },
  {
    toolName: "list_premium_users",
    commandName: "listprem",
    description: "Menampilkan daftar pengguna premium.",
    parameters: [],
  },
  {
    toolName: "add_premium_user",
    commandName: "addprem",
    description: "Menambahkan pengguna ke daftar premium.",
    parameters: [
      {
        name: "targetUser",
        type: "string",
        description:
          "Nomor pengguna yang akan ditambahkan ke premium (contoh: @6281234567890).",
      },
      {
        name: "durationDays",
        type: "number",
        description: "Durasi premium dalam hari.",
      },
    ],
    ownerOnly: true,
  },
  {
    toolName: "remove_premium_user",
    commandName: "delprem",
    description: "Menghapus pengguna dari daftar premium.",
    parameters: [
      {
        name: "targetUser",
        type: "string",
        description:
          "Nomor pengguna yang akan dihapus dari premium (contoh: @6281234567890).",
      },
    ],
    ownerOnly: true,
  },
  {
    toolName: "add_limit",
    commandName: "addlimit",
    description: "Menambahkan limit penggunaan bot untuk pengguna tertentu.",
    parameters: [
      {
        name: "targetUser",
        type: "string",
        description:
          "Nomor pengguna yang akan ditambahkan limitnya (contoh: @6281234567890).",
      },
      {
        name: "amount",
        type: "number",
        description: "Jumlah limit yang akan ditambahkan.",
      },
    ],
    ownerOnly: true,
  },
  {
    toolName: "reset_limit",
    commandName: "resetlimit",
    description: "Mereset limit penggunaan bot untuk semua pengguna.",
    parameters: [],
    ownerOnly: true,
  },
  {
    toolName: "broadcast_message",
    commandName: "bc",
    description: "Mengirim pesan siaran ke semua chat yang diikuti bot.",
    parameters: [
      {
        name: "text",
        type: "string",
        description: "Pesan yang akan disiarkan.",
      },
    ],
    ownerOnly: true,
  },
  {
    toolName: "send_to_user",
    commandName: "sendmsg",
    description: "Mengirim pesan ke pengguna tertentu.",
    parameters: [
      {
        name: "targetUser",
        type: "string",
        description: "Nomor pengguna tujuan (contoh: @6281234567890).",
      },
      { name: "text", type: "string", description: "Pesan yang akan dikirim." },
    ],
    ownerOnly: true,
  },
  {
    toolName: "get_bot_stats",
    commandName: "botstat",
    description: "Mendapatkan statistik penggunaan bot.",
    parameters: [],
    ownerOnly: true,
  },
  {
    toolName: "execute_eval",
    commandName: "eval",
    description: "Mengeksekusi kode JavaScript (hanya untuk owner).",
    parameters: [
      {
        name: "code",
        type: "string",
        description: "Kode JavaScript yang akan dieksekusi.",
      },
    ],
    ownerOnly: true,
  },
  {
    toolName: "group_kick",
    commandName: "kick",
    description: "Mengeluarkan anggota dari grup.",
    parameters: [
      {
        name: "member_mention",
        type: "string",
        description: "Anggota yang ingin dikeluarkan (mention atau reply).",
      },
    ],
    adminRequired: true,
  },
  {
    toolName: "group_promote",
    commandName: "promote",
    description: "Mengangkat anggota menjadi admin grup.",
    parameters: [
      {
        name: "member_mention",
        type: "string",
        description: "Anggota yang ingin diangkat (mention atau reply).",
      },
    ],
    adminRequired: true,
  },
  {
    toolName: "group_demote",
    commandName: "demote",
    description: "Menurunkan admin grup menjadi anggota biasa.",
    parameters: [
      {
        name: "member_mention",
        type: "string",
        description: "Admin yang ingin diturunkan (mention atau reply).",
      },
    ],
    adminRequired: true,
  },
  {
    toolName: "group_close",
    commandName: "group",
    description: "Menutup grup (hanya admin).",
    parameters: [
      {
        name: "action",
        type: "string",
        description: "Aksi: 'close' untuk menutup grup.",
      },
    ],
    adminRequired: true,
  },
  {
    toolName: "group_open",
    commandName: "group",
    description: "Membuka grup (hanya admin).",
    parameters: [
      {
        name: "action",
        type: "string",
        description: "Aksi: 'open' untuk membuka grup.",
      },
    ],
    adminRequired: true,
  },
  {
    toolName: "add_balance",
    commandName: "addsaldo",
    description: "Menambahkan saldo ke pengguna tertentu.",
    parameters: [
      {
        name: "amount",
        type: "number",
        description: "Jumlah saldo yang akan ditambahkan.",
      },
      {
        name: "target_user",
        type: "string",
        description: "Nomor pengguna tujuan (mention atau reply).",
      },
    ],
    ownerOnly: true,
  },
  {
    toolName: "balance_check",
    commandName: "ceksaldo",
    description: "Mengecek saldo pengguna.",
    parameters: [],
  },
  {
    toolName: "transfer_balance",
    commandName: "tf",
    description: "Mentransfer saldo ke pengguna lain.",
    parameters: [
      {
        name: "amount",
        type: "number",
        description: "Jumlah saldo yang akan ditransfer.",
      },
      {
        name: "target_user",
        type: "string",
        description: "Nomor pengguna tujuan (mention atau reply).",
      },
    ],
  },
  {
    toolName: "game_roll_dice",
    commandName: "dadu",
    description: "Melempar dadu dan mendapatkan hasil acak.",
    parameters: [],
  },
  {
    toolName: "game_slot",
    commandName: "slot",
    description: "Bermain game slot.",
    parameters: [
      {
        name: "betAmount",
        type: "number",
        description: "Jumlah taruhan untuk game slot.",
      },
    ],
  },
  {
    toolName: "game_tebakgambar",
    commandName: "tebakgambar",
    description: "Memulai game tebak gambar.",
    parameters: [],
  },
  {
    toolName: "game_tebakbendera",
    commandName: "tebakbendera",
    description: "Memulai game tebak bendera.",
    parameters: [],
  },
  {
    toolName: "game_tebakkata",
    commandName: "tebakkata",
    description: "Memulai game tebak kata.",
    parameters: [],
  },
  {
    toolName: "game_tebaklirik",
    commandName: "tebaklirik",
    description: "Memulai game tebak lirik.",
    parameters: [],
  },
  {
    toolName: "game_tebaklagu",
    commandName: "tebaklagu",
    description: "Memulai game tebak lagu.",
    parameters: [],
  },
  {
    toolName: "game_susunkata",
    commandName: "susunkata",
    description: "Memulai game susun kata.",
    parameters: [],
  },
  {
    toolName: "game_caklontong",
    commandName: "caklontong",
    description: "Memulai game Cak Lontong.",
    parameters: [],
  },
  {
    toolName: "game_family100",
    commandName: "family100",
    description: "Memulai game Family 100.",
    parameters: [],
  },
  {
    toolName: "game_siapakahaku",
    commandName: "siapakahaku",
    description: "Memulai game siapakah aku.",
    parameters: [],
  },
  {
    toolName: "game_asahotak",
    commandName: "asahotak",
    description: "Memulai game asah otak.",
    parameters: [],
  },
  {
    toolName: "game_tekateki",
    commandName: "tekateki",
    description: "Memulai game teka-teki.",
    parameters: [],
  },
  {
    toolName: "game_math",
    commandName: "math",
    description: "Memulai game matematika.",
    parameters: [],
  },
  {
    toolName: "game_quiz",
    commandName: "quiz",
    description: "Memulai game kuis.",
    parameters: [],
  },
  {
    toolName: "game_truth_or_dare",
    commandName: "tod",
    description: "Memulai game Truth or Dare.",
    parameters: [
      {
        name: "action",
        type: "string",
        description: "Pilih 'truth' atau 'dare'.",
      },
    ],
  },
  {
    toolName: "game_suit",
    commandName: "suit",
    description: "Bermain game suit (batu, kertas, gunting).",
    parameters: [
      {
        name: "choice",
        type: "string",
        description: "Pilihan Anda: 'batu', 'kertas', atau 'gunting'.",
      },
    ],
  },
  {
    toolName: "game_tictactoe",
    commandName: "tictactoe",
    description: "Memulai game Tic Tac Toe.",
    parameters: [],
  },
  {
    toolName: "game_hangman",
    commandName: "hangman",
    description: "Memulai game Hangman.",
    parameters: [],
  },
  {
    toolName: "game_word_search",
    commandName: "carikata",
    description: "Memulai game cari kata.",
    parameters: [],
  },
  {
    toolName: "game_guesstheword",
    commandName: "guesstheword",
    description: "Memulai game tebak kata.",
    parameters: [],
  },
  {
    toolName: "game_riddle",
    commandName: "riddle",
    description: "Memulai game teka-teki.",
    parameters: [],
  },
  {
    toolName: "game_trivia",
    commandName: "trivia",
    description: "Memulai game trivia.",
    parameters: [],
  },
  {
    toolName: "game_blackjack",
    commandName: "blackjack",
    description: "Memulai game Blackjack.",
    parameters: [],
  },
  {
    toolName: "game_roulette",
    commandName: "roulette",
    description: "Memulai game Roulette.",
    parameters: [
      { name: "betAmount", type: "number", description: "Jumlah taruhan." },
      {
        name: "betType",
        type: "string",
        description: "Jenis taruhan (angka, warna, ganjil/genap).",
      },
    ],
  },
  {
    toolName: "game_fishing",
    commandName: "fishing",
    description: "Memulai game memancing.",
    parameters: [],
  },
  {
    toolName: "game_mining",
    commandName: "mining",
    description: "Memulai game menambang.",
    parameters: [],
  },
  {
    toolName: "game_adventure",
    commandName: "adventure",
    description: "Memulai game petualangan.",
    parameters: [],
  },
  {
    toolName: "game_dungeon",
    commandName: "dungeon",
    description: "Memulai game dungeon.",
    parameters: [],
  },
  {
    toolName: "game_farm",
    commandName: "farm",
    description: "Memulai game pertanian.",
    parameters: [],
  },
  {
    toolName: "game_shop",
    commandName: "shop",
    description: "Membuka toko dalam game.",
    parameters: [],
  },
  {
    toolName: "game_inventory",
    commandName: "inv",
    description: "Melihat inventaris dalam game.",
    parameters: [],
  },
  {
    toolName: "game_leaderboard",
    commandName: "leaderboard",
    description: "Melihat papan peringkat game.",
    parameters: [],
  },
  {
    toolName: "game_profile",
    commandName: "profile",
    description: "Melihat profil game Anda.",
    parameters: [],
  },
  {
    toolName: "game_daily_reward",
    commandName: "daily",
    description: "Mengambil hadiah harian.",
    parameters: [],
  },
  {
    toolName: "game_weekly_reward",
    commandName: "weekly",
    description: "Mengambil hadiah mingguan.",
    parameters: [],
  },
  {
    toolName: "game_monthly_reward",
    commandName: "monthly",
    description: "Mengambil hadiah bulanan.",
    parameters: [],
  },
  {
    toolName: "spotify", // <--- INI SUDAH DIUBAH DARI "search_spotify_song"
    commandName: "spotify",
    description: "Mencari dan mengunduh lagu dari Spotify.",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Judul lagu atau nama artis yang ingin dicari di Spotify.",
      },
      {
        name: "url",
        type: "string",
        description: "URL lagu Spotify yang ingin diunduh.",
      },
    ],
  },
  {
    toolName: "wikipedia",
    commandName: "wiki",
    description: "Mencari informasi di Wikipedia.",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Topik yang ingin dicari di Wikipedia.",
      },
    ],
  },
  {
    toolName: "google_search",
    commandName: "google",
    description: "Melakukan pencarian di Google.",
    parameters: [
      { name: "query", type: "string", description: "Kata kunci pencarian." },
    ],
  },
  {
    toolName: "image_search",
    commandName: "image",
    description: "Mencari gambar di internet.",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Kata kunci gambar yang ingin dicari.",
      },
    ],
  },
  {
    toolName: "translate_text",
    commandName: "translate",
    description: "Menerjemahkan teks ke bahasa lain.",
    parameters: [
      {
        name: "text",
        type: "string",
        description: "Teks yang ingin diterjemahkan.",
      },
      {
        name: "target_language",
        type: "string",
        description: "Kode bahasa tujuan (contoh: en, id, ja).",
      },
    ],
  },
  {
    toolName: "define_word",
    commandName: "define",
    description: "Mencari definisi kata.",
    parameters: [
      {
        name: "word",
        type: "string",
        description: "Kata yang ingin dicari definisinya.",
      },
    ],
  },
  {
    toolName: "weather",
    commandName: "weather",
    description: "Mendapatkan informasi cuaca untuk lokasi tertentu.",
    parameters: [
      {
        name: "location",
        type: "string",
        description: "Nama kota atau lokasi.",
      },
    ],
  },
  {
    toolName: "time_in_location",
    commandName: "time",
    description: "Mendapatkan waktu saat ini di lokasi tertentu.",
    parameters: [
      {
        name: "location",
        type: "string",
        description: "Nama kota atau lokasi.",
      },
    ],
  },
  {
    toolName: "currency_converter",
    commandName: "currency",
    description: "Mengkonversi mata uang.",
    parameters: [
      {
        name: "amount",
        type: "number",
        description: "Jumlah mata uang yang akan dikonversi.",
      },
      {
        name: "from_currency",
        type: "string",
        description: "Kode mata uang asal (contoh: USD, IDR).",
      },
      {
        name: "to_currency",
        type: "string",
        description: "Kode mata uang tujuan (contoh: EUR, JPY).",
      },
    ],
  },
  {
    toolName: "qr_code_generator",
    commandName: "qrcode",
    description: "Membuat kode QR dari teks atau URL.",
    parameters: [
      {
        name: "text",
        type: "string",
        description: "Teks atau URL yang akan dijadikan kode QR.",
      },
    ],
  },
  {
    toolName: "shorten_url",
    commandName: "shorten",
    description: "Memperpendek URL.",
    parameters: [
      {
        name: "url",
        type: "string",
        description: "URL yang ingin diperpendek.",
      },
    ],
  },
  {
    toolName: "read_pdf",
    commandName: "pdf",
    description: "Membaca teks dari file PDF (reply PDF).",
    parameters: [],
  },
  {
    toolName: "read_barcode",
    commandName: "barcode",
    description:
      "Membaca informasi dari barcode atau QR code (reply gambar barcode).",
    parameters: [],
  },
  {
    toolName: "joke",
    commandName: "joke",
    description: "Menceritakan lelucon.",
    parameters: [],
  },
  {
    toolName: "quote",
    commandName: "quote",
    description: "Memberikan kutipan inspiratif.",
    parameters: [],
  },
  {
    toolName: "fact",
    commandName: "fact",
    description: "Memberikan fakta menarik.",
    parameters: [],
  },
  {
    toolName: "advice",
    commandName: "advice",
    description: "Memberikan nasihat.",
    parameters: [],
  },
  {
    toolName: "random_dog_image",
    commandName: "dog",
    description: "Mengirim gambar anjing acak.",
    parameters: [],
  },
  {
    toolName: "random_cat_image",
    commandName: "cat",
    description: "Mengirim gambar kucing acak.",
    parameters: [],
  },
  {
    toolName: "random_meme",
    commandName: "meme",
    description: "Mengirim meme acak.",
    parameters: [],
  },
  {
    toolName: "text_to_speech",
    commandName: "tts",
    description: "Mengubah teks menjadi suara.",
    parameters: [
      {
        name: "text",
        type: "string",
        description: "Teks yang ingin diubah menjadi suara.",
      },
      {
        name: "language_code",
        type: "string",
        description: "Kode bahasa (contoh: en, id, ja).",
      },
    ],
  },
];
