import config from "../../config/setting.js";
import { logger, messageFormatter } from "../../utils/helpers.js";
import { afkManager } from "../../utils/afkManager.js";

export default {
  name: "afk",
  description: "Set your status to Away From Keyboard (AFK).",
  usage: `${config.prefix}afk [reason]`,
  category: "main",
  cooldown: 10,
  ownerOnly: false,
  groupOnly: true, // AFK is a group-specific feature
  privateOnly: false,

  async execute(sock, m, args) {
    try {
      const chatId = m.key.remoteJid;
      const userId = m.key.participant;
      const pushName = m.pushName || "User";

      const reason = args.join(" ").trim() || "No reason";

      // Set user as AFK
      afkManager.setAfk(chatId, userId, reason);

      const responseText = `😴 *${pushName} is now AFK.*\n\n*Reason:* ${reason}`;

      await sock.sendMessage(chatId, { text: responseText }, { quoted: m });

      logger.info(
        `[AFK] ${pushName} (${userId}) is now AFK in ${chatId}. Reason: ${reason}`
      );
    } catch (error) {
      logger.error("Error in afk command:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        { text: "❌ Terjadi kesalahan saat mengatur status AFK." },
        { quoted: m }
      );
    }
  },
};
