const config = require("../settings/config");
const os = require("os");
const { sendButtons } = require("../library/buttons");

function runtime(seconds) {
    seconds = Number(seconds);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
}

module.exports = {
    command: 'alive',
    description: 'Check bot magical status',
    category: 'general',
    execute: async (sock, m, {
        args,
        text,
        q,
        quoted,
        mime,
        qmsg,
        isMedia,
        groupMetadata,
        groupName,
        participants,
        groupOwner,
        groupAdmins,
        isBotAdmins,
        isAdmins,
        isGroupOwner,
        isCreator,
        prefix,
        reply,
        config: cmdConfig,
        sender
    }) => {
        try {
            // Magic sparkle reaction
            await sock.sendMessage(m.chat, { 
                react: { text: "🌟", key: m.key } 
            });

            const userName = m.pushName || "Magical Being";
            const botUptime = runtime(process.uptime());
            const totalMemory = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2);
            const usedMemory = (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2);
            const ping = Date.now() - m.messageTimestamp * 1000;

            const aliveMessage = 
`🧙‍♀️ *${config.settings.title} - The Magical Assistant* 🪄

┌─✦ *ENCHANTED STATUS*
│✨ *Sorcerer:* ${userName}
│⏳ *Active Time:* ${botUptime}
│💫 *Magic Power:* ${usedMemory}MB
│⚡ *Spell Speed:* ${ping}ms
│📚 *Library:* Lordeagle-tech
│👑 *Archmage:* ${config.owner}
└─✦────────────◉

*"Magic flows through every command I cast"*`;

            const channel = config.channel || "https://whatsapp.com/channel/0029Vb8LcTLKWEKo4JlMb51I";
            await sendButtons(sock, m.chat, {
                text: aliveMessage,
                quoted: m,
                rows: [
                    {
                        name: 'cta_url',
                        buttonParamsJson: JSON.stringify({ display_text: 'Join Channel', url: channel })
                    },
                    {
                        name: 'open_webview',
                        buttonParamsJson: JSON.stringify({ title: 'GitHub', link: { url: config.settings.author } })
                    }
                ]
            });

            // Magical success reaction
            await sock.sendMessage(m.chat, { 
                react: { text: "🪄", key: m.key } 
            });

        } catch (error) {
            console.error("Error in alive command:", error);
            await sock.sendMessage(m.chat, { 
                react: { text: "💥", key: m.key } 
            });
            await reply("💫 The magical connection was interrupted. Try again!");
        }
    }
};