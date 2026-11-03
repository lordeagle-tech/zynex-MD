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
    description: 'Check system status and bot info',
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
            // Tech reaction
            await sock.sendMessage(m.chat, { 
                react: { text: "⚡", key: m.key } 
            });

            const userName = m.pushName || "User";
            const botUptime = runtime(process.uptime());
            const totalMemory = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2);
            const usedMemory = (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2);
            const ping = Date.now() - m.messageTimestamp * 1000;
            const platform = os.platform();
            const arch = os.arch();
            const cpu = os.cpus()[0].model;

            const aliveMessage = 
`🤖 *${config.settings.title} - SYSTEM STATUS*

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
👤 **USER**: ${userName}
⏱️ **UPTIME**: ${botUptime}
💾 **MEMORY**: ${usedMemory}MB / ${totalMemory}GB
📶 **PING**: ${ping}ms
🖥️ **PLATFORM**: ${platform} ${arch}
⚙️ **CPU**: ${cpu.split(' ')[0]}...

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
🔧 **DEVELOPER**: ${config.owner}
📁 **REPOSITORY**: Lordeagle-tech
💬 **DESCRIPTION**: ${config.settings.description}`;

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

            // Technical success reaction
            await sock.sendMessage(m.chat, { 
                react: { text: "✅", key: m.key } 
            });

        } catch (error) {
            console.error("Error in alive command:", error);
            await sock.sendMessage(m.chat, { 
                react: { text: "❌", key: m.key } 
            });
            await reply("🚨 System diagnostic failed. Please try the command again.");
        }
    }
};