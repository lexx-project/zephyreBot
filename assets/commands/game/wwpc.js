import config from "../../config/setting.js";
import {
  timeFormatter,
  logger,
  messageFormatter,
} from "../../utils/helpers.js";
import { werewolfSessions } from "./werewolf.js";

// Helper functions (duplicated from werewolf.js for now)
function sesi(from, data) {
  return data.get(from) || false;
}

function dataPlayer(sender, data) {
  for (const [chatId, session] of data) {
    const player = session.player.find((p) => p.id === sender);
    if (player) return player;
  }
  return false;
}

function getPlayerById2(sender, id, data) {
  for (const [chatId, session] of data) {
    const senderPlayer = session.player.find((p) => p.id === sender);
    if (senderPlayer) {
      const targetPlayer = session.player.find((p) => p.number === id);
      if (targetPlayer) {
        return {
          db: targetPlayer,
          sesi: chatId,
          index: session.player.indexOf(targetPlayer),
        };
      }
    }
  }
  return false;
}

function killWerewolf(sender, id, data) {
  const result = getPlayerById2(sender, id, data);
  if (!result) return false;

  const session = data.get(result.sesi);
  if (!session) return false;

  session.dead.push(parseInt(id));
  return true;
}

function dreamySeer(sender, id, data) {
  const result = getPlayerById2(sender, id, data);
  if (!result) return false;

  const session = data.get(result.sesi);
  if (!session) return false;

  if (result.db.role === "werewolf") {
    session.seer = true;
  }

  return result.db.role;
}

function protectGuardian(sender, id, data) {
  const result = getPlayerById2(sender, id, data);
  if (!result) return false;

  const session = data.get(result.sesi);
  if (!session) return false;

  result.db.effect.push("guardian");
  session.guardian.push(parseInt(id));
  return true;
}

function sorcerer(sender, id, data) {
  const result = getPlayerById2(sender, id, data);
  if (!result) return false;

  return result.db.role;
}

export default {
  name: "wwpc",
  aliases: ["werewolfpc"],
  description: "Werewolf private commands untuk skill malam hari",
  usage: `${config.prefix}wwpc [kill|dreamy|deff|sorcerer] [nomor]`,
  category: "game",
  cooldown: 3,
  ownerOnly: false,
  groupOnly: false,
  privateOnly: true,

  async execute(sock, m, args) {
    try {
      const userId = m.key.remoteJid;
      const action = args[0]?.toLowerCase();
      const target = args[1];

      if (!action || !target) {
        return await sock.sendMessage(
          userId,
          {
            text: `❌ Format salah!\n\nContoh:\n• ${config.prefix}wwpc kill 1\n• ${config.prefix}wwpc dreamy 2\n• ${config.prefix}wwpc deff 3\n• ${config.prefix}wwpc sorcerer 4`,
          },
          { quoted: m }
        );
      }

      if (isNaN(target)) {
        return await sock.sendMessage(
          userId,
          {
            text: "❌ Gunakan hanya nomor!",
          },
          { quoted: m }
        );
      }

      const player = dataPlayer(userId, werewolfSessions);
      if (!player) {
        return await sock.sendMessage(
          userId,
          {
            text: "❌ Kamu tidak dalam sesi game werewolf!",
          },
          { quoted: m }
        );
      }

      if (player.isdead) {
        return await sock.sendMessage(
          userId,
          {
            text: "❌ Kamu sudah mati!",
          },
          { quoted: m }
        );
      }

      if (player.status) {
        return await sock.sendMessage(
          userId,
          {
            text: "❌ Skill telah digunakan! Skill hanya bisa digunakan sekali setiap malam.",
          },
          { quoted: m }
        );
      }

      const targetPlayer = getPlayerById2(
        userId,
        parseInt(target),
        werewolfSessions
      );
      if (!targetPlayer) {
        return await sock.sendMessage(
          userId,
          {
            text: "❌ Player tidak terdaftar!",
          },
          { quoted: m }
        );
      }

      if (targetPlayer.db.isdead) {
        return await sock.sendMessage(
          userId,
          {
            text: "❌ Player sudah mati!",
          },
          { quoted: m }
        );
      }

      if (targetPlayer.db.id === userId) {
        return await sock.sendMessage(
          userId,
          {
            text: "❌ Tidak bisa menggunakan skill untuk diri sendiri!",
          },
          { quoted: m }
        );
      }

      // Handle different actions
      if (action === "kill") {
        if (player.role !== "werewolf") {
          return await sock.sendMessage(
            userId,
            {
              text: "❌ Peran ini bukan untuk kamu!",
            },
            { quoted: m }
          );
        }

        if (targetPlayer.db.role === "sorcerer") {
          return await sock.sendMessage(
            userId,
            {
              text: "❌ Tidak bisa menggunakan skill untuk teman!",
            },
            { quoted: m }
          );
        }

        killWerewolf(userId, parseInt(target), werewolfSessions);
        player.status = true;

        await sock.sendMessage(
          userId,
          {
            text: `🐺 Berhasil membunuh player ${target}!`,
          },
          { quoted: m }
        );
      } else if (action === "dreamy") {
        if (player.role !== "seer") {
          return await sock.sendMessage(
            userId,
            {
              text: "❌ Peran ini bukan untuk kamu!",
            },
            { quoted: m }
          );
        }

        const role = dreamySeer(userId, parseInt(target), werewolfSessions);
        player.status = true;

        await sock.sendMessage(
          userId,
          {
            text: `👳 Berhasil membuka identitas player ${target}!\n\n🎭 Role: ${role}`,
          },
          { quoted: m }
        );
      } else if (action === "deff") {
        if (player.role !== "guardian") {
          return await sock.sendMessage(
            userId,
            {
              text: "❌ Peran ini bukan untuk kamu!",
            },
            { quoted: m }
          );
        }

        protectGuardian(userId, parseInt(target), werewolfSessions);
        player.status = true;

        await sock.sendMessage(
          userId,
          {
            text: `👼 Berhasil melindungi player ${target}!`,
          },
          { quoted: m }
        );
      } else if (action === "sorcerer") {
        if (player.role !== "sorcerer") {
          return await sock.sendMessage(
            userId,
            {
              text: "❌ Peran ini bukan untuk kamu!",
            },
            { quoted: m }
          );
        }

        const role = sorcerer(userId, parseInt(target), werewolfSessions);
        player.status = true;

        await sock.sendMessage(
          userId,
          {
            text: `🔮 Berhasil membuka identitas player ${target}!\n\n🎭 Role: ${role}`,
          },
          { quoted: m }
        );
      } else {
        await sock.sendMessage(
          userId,
          {
            text: `❌ Action tidak valid!\n\nAction yang tersedia:\n• kill - Bunuh player (Werewolf)\n• dreamy - Lihat role (Seer)\n• deff - Lindungi player (Guardian)\n• sorcerer - Lihat role (Sorcerer)`,
          },
          { quoted: m }
        );
      }
    } catch (error) {
      logger.error("Error in wwpc command:", error);
      await sock.sendMessage(
        m.key.remoteJid,
        {
          text: "❌ Terjadi kesalahan saat menjalankan command!",
        },
        { quoted: m }
      );
    }
  },
};
