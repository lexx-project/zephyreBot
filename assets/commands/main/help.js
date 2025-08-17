import { config } from "../../config/setting.js";
import { messageFormatter } from "../../utils/helpers.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const command = {
  name: "help",
  description: "Menampilkan daftar semua command yang tersedia",
  usage: `${config.prefix}help [command]`,
  category: "utility",

  async execute(sock, message, args) {
    try {
      const commandsPath = path.join(__dirname);
      const commandFiles = fs
        .readdirSync(commandsPath)
        .filter((file) => file.endsWith(".js"));

      if (args[0]) {
        // Show specific command help
        const commandName = args[0].toLowerCase();
        const commandFile = commandFiles.find(
          (file) => file.replace(".js", "") === commandName
        );

        if (commandFile) {
          const commandModule = await import(
            `file://${path.join(commandsPath, commandFile)}`
          );
          const cmd = commandModule.default || commandModule.command;

          const helpText =
            `📋 *Detail Command: ${cmd.name}*\n\n` +
            `📝 *Deskripsi:* ${cmd.description}\n` +
            `💡 *Penggunaan:* ${cmd.usage}\n` +
            `📂 *Kategori:* ${cmd.category || "general"}`;

          await sock.sendMessage(
            message.key.remoteJid,
            { text: helpText },
            { quoted: message }
          );
        } else {
          await sock.sendMessage(
            message.key.remoteJid,
            {
              text: `❌ Command '${commandName}' tidak ditemukan!\n\nGunakan ${config.prefix}help untuk melihat semua command.`,
            },
            { quoted: message }
          );
        }
      } else {
        // Show all commands
        let helpText = `🤖 *${config.namaBot} - Daftar Command*\n\n`;

        const categories = {};

        for (const file of commandFiles) {
          try {
            const commandModule = await import(
              `file://${path.join(commandsPath, file)}`
            );
            const cmd = commandModule.default || commandModule.command;

            if (cmd && cmd.name) {
              const category = cmd.category || "general";
              if (!categories[category]) {
                categories[category] = [];
              }
              categories[category].push(cmd);
            }
          } catch (error) {
            console.error(`Error loading command ${file}:`, error);
          }
        }

        for (const [category, commands] of Object.entries(categories)) {
          helpText += `📂 *${category.toUpperCase()}*\n`;
          commands.forEach((cmd) => {
            helpText += `• ${config.prefix}${cmd.name} - ${cmd.description}\n`;
          });
          helpText += "\n";
        }

        helpText += `💡 *Tip:* Gunakan ${config.prefix}help [command] untuk detail command\n`;
        helpText += `👑 *Owner:* ${config.nomorOwner}\n`;
        helpText += `🔗 *Grup:* ${config.linkGrupBot}`;

        await sock.sendMessage(
          message.key.remoteJid,
          { text: helpText },
          { quoted: message }
        );
      }
    } catch (error) {
      console.error("Error di command help:", error);
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: "❌ Terjadi kesalahan saat menampilkan help!",
        },
        { quoted: message }
      );
    }
  },
};

export default command;
