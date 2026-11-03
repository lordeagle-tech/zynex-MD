const util = require('util');
const { exec: execCallback } = require('child_process');
const { promisify } = require('util');
const { clip, isUrl, react } = require('../library/apiHelper');
const { getPrefix, setPrefix } = require('../library/prefix');

const execAsync = promisify(execCallback);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function normalizeJid(value) {
    if (!value || typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (trimmed.includes('@')) return trimmed;
    const digits = trimmed.replace(/[^0-9]/g, '');
    return digits ? `${digits}@s.whatsapp.net` : '';
}

function singleGrapheme(value) {
    if (!value || /\s/.test(value)) return false;
    try {
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
            return [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(value)].length === 1;
        }
    } catch {}
    return [...value].length <= 2;
}

async function getImageInput(sock, m, text) {
    const url = String(text || '').trim().split(/\s+/).find(isUrl);
    if (url) return { url };

    if (!m.quoted) return null;
    try {
        if (typeof m.quoted.download === 'function') {
            const buffer = await m.quoted.download();
            if (buffer) return buffer;
        }
    } catch {}
    try {
        const buffer = await sock.downloadMediaMessage(m.quoted);
        if (buffer) return buffer;
    } catch {}
    return null;
}

function targetJid(m, text) {
    if (Array.isArray(m.mentionedJid) && m.mentionedJid.length) {
        return normalizeJid(m.mentionedJid[0]);
    }
    if (m.quoted?.sender) return normalizeJid(m.quoted.sender);
    const number = String(text || '').replace(/[^0-9]/g, '');
    return number ? normalizeJid(number) : '';
}

module.exports = [
    {
        command: 'mode',
        aliases: ['botmode'],
        category: 'owner',
        owner: true,
        description: 'View or change bot mode (public/self)',
        execute: async (sock, m, { text, prefix, reply }) => {
            const arg = String(text || '').trim().toLowerCase();
            if (!arg) {
                return reply(`⚙️ *Bot Mode*\n\nCurrent: *${sock.public ? 'Public' : 'Self'}*\n\nUsage: ${prefix}mode public | ${prefix}mode self`);
            }
            if (['public', 'on', 'open'].includes(arg)) {
                sock.public = true;
                return reply('🌍 Bot mode changed to *Public*. Everyone can use the bot.');
            }
            if (['self', 'private', 'off'].includes(arg)) {
                sock.public = false;
                return reply('🔒 Bot mode changed to *Self*. Only you can use the bot.');
            }
            return reply(`❌ Unknown mode. Use *${prefix}mode public* or *${prefix}mode self*.`);
        }
    },
    {
        command: 'public',
        aliases: ['modepublic'],
        category: 'owner',
        owner: true,
        description: 'Set the bot to public mode',
        execute: async (sock, m, { reply }) => {
            sock.public = true;
            await reply('🌍 Bot mode changed to *Public*. Everyone can use the bot.');
        }
    },
    {
        command: 'self',
        aliases: ['modeself'],
        category: 'owner',
        owner: true,
        description: 'Set the bot to self mode',
        execute: async (sock, m, { reply }) => {
            sock.public = false;
            await reply('🔒 Bot mode changed to *Self*. Only you can use the bot.');
        }
    },
    {
        command: 'owner',
        aliases: ['creator', 'ownerinfo'],
        category: 'owner',
        owner: true,
        description: 'Show owner and bot information',
        execute: async (sock, m, { reply, config }) => {
            const owner = String(config.owner || '').replace(/[^0-9]/g, '');
            const bot = String(config.botNumber || '').replace(/[^0-9]/g, '');
            await reply([
                '👑 *Owner Information*',
                '',
                `👤 *Owner:* ${config.owner || 'Unknown'}`,
                owner ? `📱 *Owner Chat:* https://wa.me/${owner}` : '',
                bot ? `🤖 *Bot Chat:* https://wa.me/${bot}` : '',
                `📢 *Channel:* ${config.channel || 'Not set'}`,
                `🌐 *GitHub:* ${config.settings?.author || 'Not set'}`,
                `⚙️ *Prefix:* ${getPrefix()}`
            ].filter(Boolean).join('\n'));
        }
    },
    {
        command: 'setprefix',
        aliases: ['changeprefix', 'prefix'],
        category: 'owner',
        owner: true,
        description: 'Change the bot command prefix',
        execute: async (sock, m, { text, reply, prefix }) => {
            const value = String(text || '').trim().split(/\s+/)[0];
            if (!value) {
                return reply(`Current prefix: [ ${getPrefix()} ]\n\nUsage: ${prefix}setprefix <emoji|letter|symbol>\nExample: ${prefix}setprefix !`);
            }
            if (!singleGrapheme(value)) {
                return reply('Prefix must be exactly one letter, emoji, or symbol (no spaces).');
            }
            setPrefix(value);
            await reply(`✅ Prefix changed to [ ${value} ]\n\nTry: ${value}menu`);
        }
    },
    {
        command: 'setbio',
        aliases: ['setstatus', 'setabout'],
        category: 'owner',
        owner: true,
        description: 'Change the bot profile bio/status',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) return reply(`❌ Provide the new bio.\nExample: ${prefix}setbio Zynex Bot is online`);
            try {
                await sock.updateProfileStatus(text);
                await reply('✅ Bot bio updated.');
            } catch (err) {
                await reply(`❌ Failed to update bio: ${err.message}`);
            }
        }
    },
    {
        command: 'setname',
        aliases: ['setbotname'],
        category: 'owner',
        owner: true,
        description: 'Change the bot profile name',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) return reply(`❌ Provide the new name.\nExample: ${prefix}setname Zynex Bot`);
            try {
                await sock.updateProfileName(text);
                await reply(`✅ Bot name changed to *${text}*.`);
            } catch (err) {
                await reply(`❌ Failed to update name: ${err.message}`);
            }
        }
    },
    {
        command: 'setpp',
        aliases: ['setbotpic', 'setprofilepic'],
        category: 'owner',
        owner: true,
        description: 'Change the bot profile picture',
        execute: async (sock, m, { text, prefix, reply }) => {
            const input = await getImageInput(sock, m, text);
            if (!input) {
                return reply(`❌ Provide an image URL or reply to an image.\nUsage: ${prefix}setpp <image url>`);
            }
            try {
                await sock.updateProfilePicture(sock.user.id, input);
                await reply('✅ Bot profile picture updated.');
            } catch (err) {
                await reply(`❌ Failed to update profile picture: ${err.message}`);
            }
        }
    },
    {
        command: 'join',
        aliases: ['joingroup'],
        category: 'owner',
        owner: true,
        description: 'Join a group using an invite link or code',
        execute: async (sock, m, { text, prefix, reply }) => {
            const raw = String(text || '').trim();
            const match = raw.match(/(?:chat\.whatsapp\.com\/)?([A-Za-z0-9]{10,})/);
            if (!match) {
                return reply(`❌ Provide a group invite link or code.\nExample: ${prefix}join https://chat.whatsapp.com/XXXX`);
            }
            const code = match[1];
            try {
                const jid = await sock.groupAcceptInvite(code);
                await reply(`✅ Joined group successfully.\n🆔 ${jid || code}`);
            } catch (err) {
                await reply(`❌ Failed to join group: ${err.message}`);
            }
        }
    },
    {
        command: 'block',
        aliases: ['blockuser'],
        category: 'owner',
        owner: true,
        description: 'Block a user',
        execute: async (sock, m, { text, prefix, reply }) => {
            const jid = targetJid(m, text);
            if (!jid) return reply(`❌ Mention, reply to, or provide a number.\nExample: ${prefix}block 254712345678`);
            try {
                await sock.updateBlockStatus(jid, 'block');
                await reply(`🚫 Blocked ${jid.split('@')[0]}.`);
            } catch (err) {
                await reply(`❌ Failed to block user: ${err.message}`);
            }
        }
    },
    {
        command: 'unblock',
        aliases: ['unblockuser'],
        category: 'owner',
        owner: true,
        description: 'Unblock a user',
        execute: async (sock, m, { text, prefix, reply }) => {
            const jid = targetJid(m, text);
            if (!jid) return reply(`❌ Mention, reply to, or provide a number.\nExample: ${prefix}unblock 254712345678`);
            try {
                await sock.updateBlockStatus(jid, 'unblock');
                await reply(`✅ Unblocked ${jid.split('@')[0]}.`);
            } catch (err) {
                await reply(`❌ Failed to unblock user: ${err.message}`);
            }
        }
    },
    {
        command: 'eval',
        aliases: ['evaluate'],
        category: 'owner',
        owner: true,
        description: 'Run JavaScript code as the bot owner',
        execute: async (sock, m, { text, reply, config }) => {
            if (!text) return reply('❌ Provide JavaScript code to run.');
            await react(sock, m, '⚡');
            let result;
            try {
                try {
                    result = await new AsyncFunction('sock', 'm', 'config', 'require', `return (${text})`)(sock, m, config, require);
                } catch (expressionError) {
                    if (!(expressionError instanceof SyntaxError)) throw expressionError;
                    result = await new AsyncFunction('sock', 'm', 'config', 'require', text)(sock, m, config, require);
                }
                const output = typeof result === 'string'
                    ? result
                    : util.inspect(result, { depth: 2, colors: false });
                await reply(`⚡ *Eval Result*\n\n\`\`\`${clip(output, 3300)}\`\`\``);
                await react(sock, m, '✅');
            } catch (err) {
                await reply(`❌ *Eval Error*\n\n${clip(err.stack || err.message, 3300)}`);
                await react(sock, m, '❌');
            }
        }
    },
    {
        command: 'exec',
        aliases: ['shell', 'term'],
        category: 'owner',
        owner: true,
        description: 'Run a shell command as the bot owner',
        execute: async (sock, m, { text, reply }) => {
            if (!text) return reply('❌ Provide a shell command to run.');
            await react(sock, m, '💻');
            try {
                const { stdout, stderr } = await execAsync(text, {
                    timeout: 60000,
                    maxBuffer: 1024 * 1024,
                    shell: '/bin/bash'
                });
                const output = (stdout || '') + (stderr ? `\n${stderr}` : '') || 'No output.';
                await reply(`💻 *Exec Output*\n\n\`\`\`${clip(output.trim(), 3300)}\`\`\``);
                await react(sock, m, '✅');
            } catch (err) {
                const output = (err.stdout || '') + (err.stderr ? `\n${err.stderr}` : '') || err.message;
                await reply(`❌ *Exec Error*\n\n\`\`\`${clip(String(output).trim(), 3300)}\`\`\``);
                await react(sock, m, '❌');
            }
        }
    },
    {
        command: 'restart',
        aliases: ['reboot'],
        category: 'owner',
        owner: true,
        description: 'Restart the bot process',
        execute: async (sock, m, { reply }) => {
            await reply('♻️ Restarting bot...');
            setTimeout(() => process.exit(0), 1500);
        }
    }
];
