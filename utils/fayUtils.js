import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, "../lib/bot/fayConfig.json");

/**
 * Membaca konfigurasi Fay dari file JSON.
 * @returns {object} Objek konfigurasi Fay.
 */
export function getFayConfig() {
  try {
    const data = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading Fay config:", error);
    // Return default config if file not found or error
    return { status: "off", premium_users: [] };
  }
}

/**
 * Menulis konfigurasi baru ke file JSON Fay.
 * @param {object} config - Objek konfigurasi baru untuk disimpan.
 */
export function writeFayConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing Fay config:", error);
  }
}
