import config from "../../config/setting.js";
import { messageFormatter, logger } from "../../utils/helpers.js";

export default {
  name: "spotify",
  aliases: ["sp"],
  category: "download",
  description: "Cari dan unduh lagu dari Spotify.",
  usage: `${config.prefix}spotify <judul lagu> atau ${config.prefix}spotify <url spotify>`,
  cooldown: 10,

  async execute(sock, message, args) {
    const chatId = message.key.remoteJid;

    if (args.length === 0) {
      const usageText = `
*Cara Menggunakan Fitur Spotify*

📥 *Untuk Download dari URL:*
\`${config.prefix}spotify <url_spotify>\`

🔍 *Untuk Mencari Lagu dari Judul:*
\`${config.prefix}spotify <judul_lagu>\`
      `;
      return await sock.sendMessage(
        chatId,
        { text: usageText.trim() },
        { quoted: message }
      );
    }

    const query = args.join(" ");

    // Cek apakah input adalah URL Spotify
    if (query.includes("spotify.com/track")) {
      await downloadFromUrl(sock, message, query);
    } else {
      await searchAndDisplayResults(sock, message, query);
    }
  },
};

async function searchAndDisplayResults(sock, message, query) {
  const chatId = message.key.remoteJid;
  await sock.sendMessage(
    chatId,
    { text: `🔍 Mencari lagu dengan judul *"${query}"*...` },
    { quoted: message }
  );

  try {
    const searchUrl = `https://api.maelyn.sbs/api/spotify/search?q=${encodeURIComponent(
      query
    )}`;
    const response = await fetch(searchUrl, {
      headers: { "mg-apikey": config.apikey.maelyn },
    });

    if (!response.ok) {
      throw new Error(`API pencarian gagal dengan status: ${response.status}`);
    }

    const data = await response.json();
    logger.info(
      `[SPOTIFY SEARCH] API Response for "${query}": ${JSON.stringify(
        data,
        null,
        2
      )}`
    );

    // Perbaikan Super Fleksibel: Cek EMPAT kemungkinan struktur respons API
    let songs;
    if (data.result && Array.isArray(data.result.tracks)) {
      // Struktur 4 (BARU): { result: { tracks: [...] } }
      // Ini adalah format yang paling detail, kita perlu memetakannya
      songs = data.result.tracks.map((track) => ({
        title: track.title,
        artist: track.artists, // 'artists' adalah string di sini
        url: track.link_spotify,
      }));
    } else if (data.result && Array.isArray(data.result.data)) {
      // Struktur 1: { result: { data: [...] } }
      songs = data.result.data;
    } else if (Array.isArray(data.result)) {
      // Struktur 2: { result: [...] }
      songs = data.result;
    } else if (
      typeof data.result === "object" &&
      data.result !== null &&
      !Array.isArray(data.result) &&
      data.result.url
    ) {
      // Struktur 3: { result: { title: '...', url: '...' } } (satu objek lagu)
      // Bungkus dalam array agar bisa diproses oleh logika yang sama
      songs = [data.result];
    }

    if (data.status !== "Success" || !songs || songs.length === 0) {
      return await sock.sendMessage(
        chatId,
        {
          text: messageFormatter.error(
            `Lagu tidak ditemukan untuk query: "${query}"`
          ),
        },
        { quoted: message }
      );
    }

    // Buat tombol interaktif dengan list hasil pencarian (Native Flow)
    const buttons = [
      {
        buttonId: "show_spotify_list",
        buttonText: { displayText: "🎶 LIHAT HASIL PENCARIAN" },
        type: 4,
        nativeFlowInfo: {
          name: "single_select",
          paramsJson: JSON.stringify({
            title: `🎧 Hasil Pencarian untuk "${query}"`,
            sections: [
              {
                title: "Pilih lagu yang ingin diunduh",
                rows: songs.slice(0, 15).map((song) => ({
                  // Batasi 15 hasil
                  header: "🎵",
                  title: song.title,
                  description: `Artis: ${song.artist}`,
                  id: `${config.prefix}spotify ${song.url}`, // ID ini akan dikirim sebagai pesan saat dipilih
                })),
              },
            ],
          }),
        },
      },
    ];

    await sock.sendMessage(
      chatId,
      {
        text: `Ditemukan *${songs.length}* lagu. Silakan pilih salah satu dari daftar di bawah ini.`,
        footer: `© ${config.namaBot}`,
        buttons: buttons,
        headerType: 1,
      },
      { quoted: message }
    );
  } catch (error) {
    logger.error(`[SPOTIFY SEARCH] Error: ${error.message}`);
    await sock.sendMessage(
      chatId,
      {
        text: messageFormatter.error(
          `Terjadi kesalahan saat mencari lagu: ${error.message}`
        ),
      },
      { quoted: message }
    );
  }
}

async function downloadFromUrl(sock, message, url) {
  const chatId = message.key.remoteJid;
  await sock.sendMessage(
    chatId,
    { text: config.messages.wait },
    { quoted: message }
  );

  try {
    const downloadUrl = `https://api.maelyn.sbs/api/spotify/download?url=${encodeURIComponent(
      url
    )}`;
    const response = await fetch(downloadUrl, {
      headers: { "mg-apikey": config.apikey.maelyn },
    });

    if (!response.ok)
      throw new Error(`API download gagal dengan status: ${response.status}`);

    const data = await response.json();
    if (data.status !== "Success" || !data.result || !data.result.url)
      throw new Error(
        data.result || "Gagal mendapatkan link download dari API."
      );

    const { title, artist, duration, url: audioUrl } = data.result;
    const caption = `🎧 *${title}*\n\n👤 *Artis:* ${artist}\n⏱️ *Durasi:* ${duration}\n\n© ${config.namaBot}`;

    await sock.sendMessage(
      chatId,
      { audio: { url: audioUrl }, mimetype: "audio/mp4", caption: caption },
      { quoted: message }
    );
    logger.info(
      `[SPOTIFY DOWNLOAD] Berhasil mengirim lagu "${title}" ke ${chatId}`
    );
  } catch (error) {
    logger.error(`[SPOTIFY DOWNLOAD] Error: ${error.message}`);
    await sock.sendMessage(
      chatId,
      {
        text: messageFormatter.error(
          `Terjadi kesalahan saat mengunduh lagu: ${error.message}`
        ),
      },
      { quoted: message }
    );
  }
}
