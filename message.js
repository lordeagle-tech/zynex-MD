const config = require('./settings/config');
const fs = require('fs');
const crypto = require("crypto");
const path = require("path");
const os = require('os');
const chalk = require("chalk");
const axios = require('axios');
const { exec } = require('child_process');
const { dechtml, fetchWithTimeout } = require('./library/function');       
const { tempfiles } = require("./library/uploader");
const { fquoted } = require('./library/quoted');     
const Api = require('./library/Api');
const { getPrefix } = require('./library/prefix');
const { getFeature, isSudo, applyPresence } = require('./library/features');

const image = fs.readFileSync('./thumbnail/image.jpg');
const docu = fs.readFileSync('./thumbnail/document.jpg');

function toBoldSans(value) {
    return String(value).replace(/[A-Za-z0-9]/g, ch => {
        const code = ch.charCodeAt(0);
        if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D5D4 + (code - 65));
        if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D5EE + (code - 97));
        if (code >= 48 && code <= 57) return String.fromCodePoint(0x1D7EC + (code - 48));
        return ch;
    });
}

function toBoldSerif(value) {
    return String(value).replace(/[A-Za-z0-9]/g, ch => {
        const code = ch.charCodeAt(0);
        if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D400 + (code - 65));
        if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D41A + (code - 97));
        if (code >= 48 && code <= 57) return String.fromCodePoint(0x1D7CE + (code - 48));
        return ch;
    });
}

function getNairobiShortDateTime() {
    const now = new Date();
    const date = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Nairobi',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(now);
    const time = new Intl.DateTimeFormat('en-KE', {
        timeZone: 'Africa/Nairobi',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }).format(now);
    return `${date} • ${time}`;
}

function getGreetingEmoji() {
    const hour = Number(new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Nairobi',
        hour: '2-digit',
        hour12: false
    }).format(new Date())) % 24;
    if (hour < 12) return '🌤️';
    if (hour < 17) return '☀️';
    if (hour < 21) return '🌆';
    return '🌙';
}

let jidNormalizedUser, getContentType, isPnUser;

const loadBaileysUtils = async () => {
    const baileys = await import('@lordeagle21/baileys');
    jidNormalizedUser = baileys.jidNormalizedUser;
    getContentType = baileys.getContentType;
    isPnUser = baileys.isPnUser;
};

// Plugin Loader System with Menu Categorization
class PluginLoader {
    constructor() {
        this.plugins = new Map();
        this.categories = new Map();
        this.pluginsDir = path.join(__dirname, 'plugins');
        this.defaultCategories = {
            'ai': '🤖 AI MENU',
            'downloader': '📥 DOWNLOAD MENU',
            'fun': '🎮 FUN MENU',
            'general': '⚡ GENERAL MENU',
            'group': '👥 GROUP MENU',
            'owner': '👑 OWNER MENU',
            'settings': '⚙️ SETTINGS MENU',
            'other': '📦 OTHER MENU',
            'tools': '🛠️ TOOLS MENU',
            'video': '🎬 VIDEO MENU',
            'search': '🔍 SEARCH MENU',
            'news': '📰 NEWS MENU',
            'education': '📚 EDUCATION MENU',
            'spiritual': '🕊️ SPIRITUAL MENU',
            'movie': '🎞️ MOVIE MENU',
            'random': '🎲 RANDOM MENU'
        };
        this.loadPlugins();
    }

    loadPlugins() {
        try {
            // Create plugins directory if it doesn't exist
            if (!fs.existsSync(this.pluginsDir)) {
                fs.mkdirSync(this.pluginsDir, { recursive: true });
                console.log(chalk.cyan('📁 Created plugins directory'));
                return;
            }

            // Read all plugin files
            const pluginFiles = fs.readdirSync(this.pluginsDir).filter(file => 
                file.endsWith('.js') && !file.startsWith('_')
            );

            // Clear existing plugins and categories
            this.plugins.clear();
            this.categories.clear();

            // Initialize categories
            Object.keys(this.defaultCategories).forEach(cat => {
                this.categories.set(cat, []);
            });

            // Load each plugin (supports single object or array of commands)
            for (const file of pluginFiles) {
                try {
                    const pluginPath = path.join(this.pluginsDir, file);
                    const loaded = require(pluginPath);
                    const definitions = Array.isArray(loaded) ? loaded : [loaded];

                    for (const plugin of definitions) {
                        if (plugin && plugin.command && typeof plugin.execute === 'function') {
                            this.registerPlugin(plugin, file);
                        } else {
                            console.log(chalk.yellow(`⚠️  Invalid plugin structure in: ${file}`));
                        }
                    }
                } catch (error) {
                    console.log(chalk.red(`❌ Failed to load plugin ${file}:`, error.message));
                }
            }

            const activeCategories = Array.from(this.categories.values()).filter(commands => commands.length > 0).length;
            console.log(chalk.cyan(`📦 Loaded ${this.getPluginCount()} plugins across ${activeCategories} categories`));
        } catch (error) {
            console.log(chalk.red('❌ Error loading plugins:', error.message));
        }
    }

    registerPlugin(plugin, file = '') {
        if (plugin.enabled === false) return;

        if (!plugin.category) {
            plugin.category = 'general';
        }

        if (!this.categories.has(plugin.category)) {
            this.categories.set(plugin.category, []);
        }

        this.plugins.set(plugin.command, plugin);
        for (const [category, commands] of this.categories) {
            if (category !== plugin.category) {
                const index = commands.indexOf(plugin.command);
                if (index !== -1) commands.splice(index, 1);
            }
        }
        const categoryCommands = this.categories.get(plugin.category);
        if (!categoryCommands.includes(plugin.command)) categoryCommands.push(plugin.command);

        if (Array.isArray(plugin.aliases)) {
            for (const alias of plugin.aliases) {
                if (alias && !this.plugins.has(alias)) this.plugins.set(alias, plugin);
            }
        }

        console.log(chalk.green(`✅ Loaded plugin: ${plugin.command} (${plugin.category})${file ? ` [${file}]` : ''}`));
    }

    async executePlugin(command, sock, m, args, text, q, quoted, mime, qmsg, isMedia, groupMetadata, groupName, participants, groupOwner, groupAdmins, isBotAdmins, isAdmins, isGroupOwner, isCreator, prefix, reply, sender) {
        const plugin = this.plugins.get(command);
        if (!plugin) return false;

        try {
            // Check if plugin is owner-only
            if (plugin.owner && !isCreator) {
                return true; // Silent - don't respond
            }

            // Check if plugin is group-only
            if (plugin.group && !m.isGroup) {
                return true; // Silent - don't respond
            }

            // Check if plugin requires admin
            if (plugin.admin && m.isGroup && !isAdmins && !isCreator) {
                return true; // Silent - don't respond
            }

            await plugin.execute(sock, m, {
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
                config,
                sender
            });
            return true;
        } catch (error) {
            console.log(chalk.red(`❌ Error executing plugin ${command}:`, error));
            return true; // Silent - don't respond with error
        }
    }

    getPluginCommands() {
        return Array.from(this.plugins.keys());
    }

    getMenuSections(prefix = '') {
        const sections = [];
        const seenCommands = new Set();
        
        // Sort categories alphabetically by their display name
        const sortedCategories = Array.from(this.categories.entries())
            .filter(([category, commands]) => commands.length > 0 && this.defaultCategories[category])
            .sort(([catA], [catB]) => {
                const nameA = this.defaultCategories[catA];
                const nameB = this.defaultCategories[catB];
                return nameA.localeCompare(nameB);
            });
        
        for (const [category, commands] of sortedCategories) {
            const categoryName = this.defaultCategories[category];
            // Sort and deduplicate commands
            const sortedCommands = [...new Set(commands)]
                .filter(cmd => !seenCommands.has(cmd))
                .sort();
            if (!sortedCommands.length) continue;
            const commandList = sortedCommands.map(cmd => {
                seenCommands.add(cmd);
                return `│ ❐➻ ${prefix}${cmd}`;
            }).join('\n');
            
            sections.push(`╭─〘 *${toBoldSans(categoryName.toUpperCase())}* 〙\n${commandList}\n╰──────────⊷`);
        }
        
        return sections.join('\n\n');
    }

    getPluginCount() {
        const commands = new Set();
        for (const categoryCommands of this.categories.values()) {
            for (const command of categoryCommands) commands.add(command);
        }
        return commands.size;
    }

    reloadPlugins() {
        // Clear require cache for plugin files
        const pluginFiles = fs.readdirSync(this.pluginsDir).filter(file => 
            file.endsWith('.js') && !file.startsWith('_')
        );

        for (const file of pluginFiles) {
            const pluginPath = path.join(this.pluginsDir, file);
            delete require.cache[require.resolve(pluginPath)];
        }

        // Reload plugins
        this.loadPlugins();
    }
}

// Initialize plugin loader
const pluginLoader = new PluginLoader();

module.exports = sock = async (sock, m, chatUpdate, store) => {
    try {
        if (!jidNormalizedUser || !getContentType || !isPnUser) {
            await loadBaileysUtils();
        }

        const body = (
            m.mtype === "conversation" ? m.message?.conversation :
            m.mtype === "imageMessage" ? m.message?.imageMessage?.caption :
            m.mtype === "videoMessage" ? m.message?.videoMessage?.caption :
            m.mtype === "extendedTextMessage" ? m.message?.extendedTextMessage?.text :
            m.mtype === "buttonsResponseMessage" ? m.message?.buttonsResponseMessage?.selectedButtonId :
            m.mtype === "listResponseMessage" ? m.message?.listResponseMessage?.singleSelectReply?.selectedRowId :
            m.mtype === "templateButtonReplyMessage" ? m.message?.templateButtonReplyMessage?.selectedId :
            m.mtype === "interactiveResponseMessage" ? (() => { try { return JSON.parse(m.msg?.nativeFlowResponseMessage?.paramsJson || "{}").id; } catch { return ""; } })() :
            m.mtype === "messageContextInfo" ? m.message?.buttonsResponseMessage?.selectedButtonId ||
            m.message?.listResponseMessage?.singleSelectReply?.selectedRowId || m.text : ""
        ) || "";
        
        const sender = m.key.fromMe ? sock.user.id.split(":")[0] + "@s.whatsapp.net" ||
              sock.user.id : m.key.participant || m.key.remoteJid;
        
        const senderNumber = sender.split('@')[0];
        const budy = (typeof m.text === 'string' ? m.text : '');
        const prefix = getPrefix();
        const from = m.key.remoteJid;
        const isGroup = from.endsWith("@g.us");
        const botNumber = await sock.decodeJid(sock.user.id);
        const isBot = botNumber.includes(senderNumber);
        
        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
        const command2 = body.replace(prefix, '').trim().split(/ +/).shift().toLowerCase();
        const args = body.trim().split(/ +/).slice(1);
        const pushname = m.pushName || "No Name";
        const text = q = args.join(" ");
        const quoted = m.quoted ? m.quoted : m;
        const mime = (quoted.msg || quoted).mimetype || '';
        const qmsg = (quoted.msg || quoted);
        const isMedia = /image|video|sticker|audio/.test(mime);
        const groupMetadata = m?.isGroup ? await sock.groupMetadata(m.chat).catch(() => ({})) : {};
        const groupName = m?.isGroup ? groupMetadata.subject || '' : '';
        
        const participants = m?.isGroup ? groupMetadata.participants?.map(p => {
            let admin = null;
            if (p.admin === 'superadmin') admin = 'superadmin';
            else if (p.admin === 'admin') admin = 'admin';
            return {
                id: p.id || null,
                lid: p.lid || null,
                phoneNumber: p.phoneNumber || null,
                admin,
                full: p
            };
        }) || [] : [];
        
        const groupOwner = m?.isGroup ? groupMetadata.owner || '' : '';
        const groupAdmins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);
        const isBotAdmins = m?.isGroup ? groupAdmins.includes(botNumber) : false;
        const isAdmins = m?.isGroup ? groupAdmins.includes(m.sender) : false;
        const isGroupOwner = m?.isGroup ? groupOwner === m.sender : false;
        const isCreator = jidNormalizedUser(m.sender) === jidNormalizedUser(botNumber) ||
            senderNumber === String(config.owner || '').replace(/[^0-9]/g, '') || m.key.fromMe ||
            isSudo(senderNumber);

        if (isCmd) {
            console.log(chalk.hex("#6c5ce7")("# New Message"));
            console.log(`- Date  : ${chalk.white(new Date().toLocaleString())}`);
            console.log(`- Message    : ${chalk.white(command)}`);
            console.log(`- Sender : ${chalk.white(pushname)}`);
            console.log(`- JID      : ${chalk.white(senderNumber)}`);
            console.log(`ㅤ\n`);
        }
        
        async function reply(text) {
            const channel = config.channel || "https://whatsapp.com/channel/0029Vb8LcTLKWEKo4JlMb51I";
            try {
                await sock.sendInteractiveRows(m.chat, {
                    text: text,
                    footer: config.settings.footer,
                    interactiveRows: [
                        {
                            name: 'cta_url',
                            buttonParamsJson: JSON.stringify({
                                display_text: 'Join Channel',
                                url: channel
                            })
                        }
                    ]
                }, { quoted: m });
            } catch (e) {
                await sock.sendMessage(m.chat, { text: text }, { quoted: m }).catch(() => {});
            }
        }

        const antilinkMode = getFeature('antilink');
        if (m.isGroup && !isCreator && !isAdmins && !isCmd && isBotAdmins &&
            antilinkMode && antilinkMode !== 'off') {
            const linkPattern = /(https?:\/\/|www\.|chat\.whatsapp\.com\/|wa\.me\/|t\.me\/|[a-z0-9-]+\.(com|net|org|io|me|ke|co|ly|app|site|xyz|link)(\/|\b))/i;
            if (linkPattern.test(body)) {
                if (antilinkMode === 'delete' || antilinkMode === 'kick+delete') {
                    await sock.sendMessage(m.chat, { delete: m.key }).catch(() => {});
                }
                if (antilinkMode === 'kick' || antilinkMode === 'kick+delete') {
                    await sock.groupParticipantsUpdate(m.chat, [m.sender], 'remove').catch(() => {});
                }
                return;
            }
        }

        if (isCmd) applyPresence(sock, m.chat).catch(() => {});

        // Try to execute plugin first
        const pluginExecuted = await pluginLoader.executePlugin(
            command, sock, m, args, text, q, quoted, mime, qmsg, isMedia, 
            groupMetadata, groupName, participants, groupOwner, groupAdmins, 
            isBotAdmins, isAdmins, isGroupOwner, isCreator, prefix, reply, sender
        );

        // If plugin was executed, stop here
        if (pluginExecuted) return;

        // Only built-in essential commands remain
        switch (command) {
            case 'menu': {
                const usedMem = process.memoryUsage().heapUsed / 1024 / 1024;
                const totalMem = os.totalmem() / 1024 / 1024 / 1024;
                const memPercent = (usedMem / (totalMem * 1024)) * 100;
                const ramBar = '▣'.repeat(Math.floor(memPercent / 20)) + '▢'.repeat(5 - Math.floor(memPercent / 20));
                const uptimeSec = process.uptime();
                const days = Math.floor(uptimeSec / (3600 * 24));
                const hours = Math.floor((uptimeSec % (3600 * 24)) / 3600);
                const minutes = Math.floor((uptimeSec % 3600) / 60);
                const seconds = Math.floor(uptimeSec % 60);
                const uptime = `${days}d ${hours}h ${minutes}m ${seconds}s`;
                const ping = Date.now() - m.messageTimestamp * 1000;
                const host = os.platform();
                const mode = sock.public ? 'Public' : 'Self';

                const pluginMenuSections = pluginLoader.getMenuSections(prefix);
                const totalCommands = pluginLoader.getPluginCount();
                const botName = toBoldSerif(String(config.settings.title || 'ZYNEX-MD').toUpperCase());
                const botNameSans = toBoldSans(String(config.settings.title || 'ZYNEX-MD').toUpperCase());
                const ownerName = toBoldSans('LORD EAGLE');

                const K0MRAID = `╭─〘 *${botName}* 〙
┃❍ ʙᴏᴛ ɴᴀᴍᴇ 「 *${botNameSans}* 」
┃❍ ᴠᴇʀsɪᴏɴ : 1.2
┃❍ ᴏᴡɴᴇʀ : ${ownerName}
┃❍ ᴍᴏᴅᴇ : ${mode}
┃❍ ʀᴜɴᴛɪᴍᴇ : ${uptime}
┃❍ ᴘʀᴇғɪx : 「 *${prefix}* 」
┃❍ ᴘʟᴀᴛғᴏʀᴍ : ${host}
┃❍ ᴄᴏᴍᴍᴀɴᴅs : ${totalCommands} total
┃❍ ᴘɪɴɢ : ${ping.toFixed(0)} ms
┃❍ ʀᴀᴍ ᴜsᴀɢᴇ : ${usedMem.toFixed(2)} MB / ${totalMem.toFixed(2)} GB
┃❍ ʀᴀᴍ ʙᴀʀ : [${ramBar}] ${memPercent.toFixed(2)}%
┃ 🕒 ${getNairobiShortDateTime()} ${getGreetingEmoji()}
╰──────────⊷

╭─〘 *${toBoldSerif('MENU')}* 〙
${pluginMenuSections}
╰──────────⊷`;

                const channel = config.channel || "https://whatsapp.com/channel/0029Vb8LcTLKWEKo4JlMb51I";
                const menuImage = { url: config.thumbUrl };
                const menuButtons = [
                    {
                        name: 'cta_url',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'Join Channel',
                            url: channel
                        })
                    }
                ];
                try {
                    await sock.sendInteractiveRows(m.chat, {
                        image: menuImage,
                        text: K0MRAID,
                        footer: config.settings.footer,
                        interactiveRows: menuButtons
                    }, { quoted: m });
                } catch (e) {
                    try {
                        await sock.sendMessage(m.chat, { image: menuImage, caption: K0MRAID }, { quoted: m });
                    } catch (e2) {
                        try {
                            await sock.sendInteractiveRows(m.chat, {
                                image,
                                text: K0MRAID,
                                footer: config.settings.footer,
                                interactiveRows: menuButtons
                            }, { quoted: m });
                        } catch (e3) {
                            await sock.sendInteractiveRows(m.chat, {
                                text: K0MRAID,
                                footer: config.settings.footer,
                                interactiveRows: menuButtons
                            }, { quoted: m }).catch(() => {});
                        }
                    }
                }
                break;
            }
            
            case 'reload': {
                if (!isCreator) return; // Silent - don't respond
                pluginLoader.reloadPlugins();
                await reply(`✅ Plugins reloaded! Loaded ${pluginLoader.getPluginCount()} commands across ${pluginLoader.categories.size} categories.`);
                break;
            }
            
            // No default case - stay silent for unknown commands
        }
    } catch (err) {
        console.log(require("util").format(err));
    }
};

let file = require.resolve(__filename);
require('fs').watchFile(file, () => {
    require('fs').unwatchFile(file);
    console.log('\x1b[0;32m' + __filename + ' \x1b[1;32mupdated!\x1b[0m');
    delete require.cache[file];
    require(file);
});