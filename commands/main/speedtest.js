import axios from "axios";
import { fileURLToPath } from "url";
import path from "path";
import config from "../../config/setting.js";
import { messageFormatter, logger } from "../../utils/helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  name: "speedtest",
  aliases: ["speed"],
  description: "Uji kecepatan internet server bot (hasil ringkas).",
  usage: `${config.prefix}speedtest`,
  category: "main",
  cooldown: 45,
  ownerOnly: false,
  groupOnly: false,
  privateOnly: false,

  async execute(sock, m, args) {
    const chatId = m.key.remoteJid;

    // --- Konfigurasi internal (disembunyikan dari output) ---
    const REQ_TIMEOUT = 20000;
    const PING_TRIALS = 15;
    const PING_URL = "https://www.google.com/generate_204";
    const DL_URL = "https://speed.cloudflare.com/__down?bytes=150000000"; // ~150MB
    const UL_URL = "https://speed.cloudflare.com/__up";
    const DL_PASSES = 3;
    const UL_PASSES = 2;
    const DL_DURATION_MS = 17000;                 // ~17s per pass
    const UL_TARGET_BYTES = 60 * 1024 * 1024;     // ~60MB per pass

    // --- Utils ---
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const stddev = (arr) => {
      if (arr.length < 2) return 0;
      const mean = avg(arr);
      const variance = avg(arr.map((x) => (x - mean) ** 2));
      return Math.sqrt(variance);
    };
    const percentile = (arr, p) => {
      if (!arr.length) return 0;
      const a = [...arr].sort((x, y) => x - y);
      const idx = Math.min(a.length - 1, Math.max(0, Math.floor((p / 100) * a.length)));
      return a[idx];
    };
    const median = (arr) => percentile(arr, 50);
    const toMbps = (bytes, ms) => ((bytes * 8) / Math.max(ms, 1) / 1_000_000 * 1000).toFixed(2);

    // --- Notif mulai ---
    try {
      await sock.sendMessage(chatId, { text: "⏳ Menjalankan speedtest...\nHarap tunggu." }, { quoted: m });
    } catch {}

    try {
      // 1) PING (warm-up + sampling)
      const pingSamples = [];
      let lost = 0;

      try { await axios.get(PING_URL, { timeout: Math.min(REQ_TIMEOUT, 5000) }); } catch {}
      await sleep(150);

      for (let i = 0; i < PING_TRIALS; i++) {
        const t0 = Date.now();
        try {
          await axios.get(PING_URL, { timeout: REQ_TIMEOUT, headers: { "Cache-Control": "no-cache" } });
          pingSamples.push(Date.now() - t0);
        } catch {
          lost++;
        }
        await sleep(120);
      }

      const pingOk = pingSamples.length ? pingSamples : [REQ_TIMEOUT];
      const pingAvgMs = Math.round(avg(pingOk));
      const pingJitterMs = Math.round(stddev(pingOk));
      const lossPct = Math.max(0, Math.min(100, Math.round((lost / PING_TRIALS) * 100)));

      // 2) DOWNLOAD (multi-pass; ambil median Mbps)
      const dlResults = [];
      for (let p = 0; p < DL_PASSES; p++) {
        let dlBytes = 0;
        const dlStart = Date.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), DL_DURATION_MS + 1000);

        try {
          const resp = await axios.get(DL_URL, {
            responseType: "stream",
            signal: controller.signal,
            timeout: REQ_TIMEOUT,
            headers: { "Cache-Control": "no-cache" },
          });

          await new Promise((resolve, reject) => {
            const stopAt = dlStart + DL_DURATION_MS;
            resp.data.on("data", (chunk) => {
              dlBytes += chunk.length;
              if (Date.now() >= stopAt) resp.data.destroy();
            });
            resp.data.on("end", resolve);
            resp.data.on("close", resolve);
            resp.data.on("error", reject);
          });
        } catch (e) {
          logger.warning(`[SPEEDTEST] Download pass ${p + 1} terhenti: ${e?.message || e}`);
        } finally {
          clearTimeout(timer);
        }

        const elapsed = Math.max(1, Date.now() - dlStart);
        const mbps = Number(toMbps(dlBytes, elapsed));
        dlResults.push(isFinite(mbps) ? mbps : 0);
        await sleep(250);
      }
      const dlMed = median(dlResults);

      // 3) UPLOAD (multi-pass; ambil median Mbps)
      const { Readable } = await import("stream");
      const ulResults = [];

      for (let p = 0; p < UL_PASSES; p++) {
        let bytesSent = 0;
        const CHUNK = 256 * 1024;

        const uploadStream = new Readable({
          read() {
            if (bytesSent >= UL_TARGET_BYTES) return this.push(null);
            const remaining = UL_TARGET_BYTES - bytesSent;
            const size = Math.min(CHUNK, remaining);
            const buf = Buffer.allocUnsafe(size);
            bytesSent += size;
            this.push(buf);
          },
        });

        const ulStart = Date.now();
        try {
          await axios.post(UL_URL, uploadStream, {
            timeout: REQ_TIMEOUT,
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Length": UL_TARGET_BYTES,
              "Cache-Control": "no-cache",
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
          });
        } catch (e) {
          logger.warning(`[SPEEDTEST] Upload pass ${p + 1} terputus: ${e?.message || e}`);
        } finally {
          const elapsed = Math.max(1, Date.now() - ulStart);
          const mbps = Number(toMbps(UL_TARGET_BYTES, elapsed));
          ulResults.push(isFinite(mbps) ? mbps : 0);
        }
        await sleep(300);
      }
      const ulMed = median(ulResults);

      // --- OUTPUT RINGKAS SAJA ---
      const caption =
`┌─「 📊 Speedtest 」 
│ Ping     : ${pingAvgMs} ms
│ Jitter   : ${pingJitterMs} ms
│ Loss     : ${lossPct}%
│ Download : ${dlMed.toFixed(2)} Mbps
│ Upload   : ${ulMed.toFixed(2)} Mbps
└──────────────────────`;

      await sock.sendMessage(chatId, { text: caption }, { quoted: m });
      logger.info("[SPEEDTEST] Hasil ringkas terkirim.");
    } catch (error) {
      logger.error("Error di command speedtest:", error);
      await sock.sendMessage(
        chatId,
        { text: messageFormatter.error("❌ Speedtest gagal dijalankan.") },
        { quoted: m }
      );
    }
  },
};
