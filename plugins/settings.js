const {
    getFeature,
    setFeature,
    addSudo,
    removeSudo,
    getSudoList,
    normalizeNumber
} = require('../library/features');
const config = require('../settings/config');

const ON = ['on', 'enable', 'enabled', 'true', '1', 'yes'];
const OFF = ['off', 'disable', 'disabled', 'false', '0', 'no'];

function parseToggle(text, current) {
    const value = String(text || '').trim().toLowerCase();
    if (ON.includes(value)) return true;
    if (OFF.includes(value)) return false;
    return !current;
}

function targetNumber(m, text) {
    const raw = m.mentionedJid?.[0] || m.quoted?.sender || '';
    return normalizeNumber(raw) || normalizeNumber(text);
}

function togglePlugin(command, aliases, key, label, description) {
    return {
        command,
        aliases,
        category: 'settings',
        owner: true,
        description,
        execute: async (sock, m, { text, reply }) => {
            const value = parseToggle(text, Boolean(getFeature(key)));
            setFeature(key, value);
            await reply(`${value ? '✅' : '❌'} *${label}* is now *${value ? 'ON' : 'OFF'}*`);
        }
    };
}

module.exports = [
    togglePlugin('autostatusview', ['statusview', 'autoviewstatus'], 'autostatusview', 'Auto Status View', 'Automatically view WhatsApp statuses'),
    togglePlugin('autostatusreact', ['statusreact', 'autoreactstatus'], 'autostatusreact', 'Auto Status React', 'Automatically react to WhatsApp statuses'),
    togglePlugin('antiviewonce', ['antivo', 'aviewonce', 'antiview'], 'antiviewonce', 'Anti View Once', 'Forward view-once messages to the bot chat'),
    togglePlugin('autoread', ['autoreadmessages'], 'autoread', 'Auto Read', 'Automatically mark incoming messages as read'),
    togglePlugin('autotyping', ['autotype'], 'autotyping', 'Auto Typing', 'Show typing presence while handling commands'),
    togglePlugin('autorecording', ['autorec'], 'autorecording', 'Auto Recording', 'Show recording presence while handling commands'),
    togglePlugin('autotypingrecording', ['autotyperec', 'typeplusrecording', 'autotype+recording'], 'autotypingrecording', 'Auto Typing + Recording', 'Alternate recording and typing presence'),
    togglePlugin('antidelete', ['antidel', 'antiddelete'], 'antidelete', 'Anti Delete', 'Forward deleted messages to the bot chat'),
    {
        command: 'antilink',
        aliases: ['antilinks'],
        category: 'settings',
        owner: true,
        description: 'Set antilink mode: off, delete, kick or kick+delete',
        execute: async (sock, m, { text, reply }) => {
            const modes = {
                off: 'off',
                disable: 'off',
                false: 'off',
                on: 'delete',
                delete: 'delete',
                del: 'delete',
                kick: 'kick',
                kickdelete: 'kick+delete',
                'kick+delete': 'kick+delete',
                'kick+del': 'kick+delete',
                both: 'kick+delete'
            };
            const input = String(text || '').trim().toLowerCase();
            if (!input) {
                return reply(`🔗 *Antilink Mode:* ${getFeature('antilink')}\n\nUsage: antilink off | delete | kick | kick+delete`);
            }
            const mode = modes[input];
            if (!mode) return reply('❌ Invalid mode. Use off, delete, kick or kick+delete.');
            setFeature('antilink', mode);
            await reply(`✅ *Antilink* set to *${mode}*`);
        }
    },
    {
        command: 'addsudo',
        aliases: ['sudoadd'],
        category: 'settings',
        owner: true,
        description: 'Add a user to the sudo list',
        execute: async (sock, m, { text, reply }) => {
            const number = targetNumber(m, text);
            if (!number || number.length < 7) return reply('❌ Tag, reply to or type a valid phone number.');
            if (number === normalizeNumber(config.owner)) return reply('ℹ️ That number is already the bot owner.');
            addSudo(number);
            await reply(`✅ Added *${number}* to sudo list.`);
        }
    },
    {
        command: 'delsudo',
        aliases: ['sudodel', 'deldsudo', 'removesudo'],
        category: 'settings',
        owner: true,
        description: 'Remove a user from the sudo list',
        execute: async (sock, m, { text, reply }) => {
            const number = targetNumber(m, text);
            if (!number) return reply('❌ Tag, reply to or type the phone number to remove.');
            if (!removeSudo(number)) return reply(`ℹ️ *${number}* is not in the sudo list.`);
            await reply(`✅ Removed *${number}* from sudo list.`);
        }
    },
    {
        command: 'sudolist',
        aliases: ['sudos', 'listsudo'],
        category: 'settings',
        owner: true,
        description: 'List all sudo users',
        execute: async (sock, m, { reply }) => {
            const list = getSudoList();
            const owner = normalizeNumber(config.owner);
            const lines = [
                `👑 Owner: ${owner || 'not set'}`,
                ...list.map((number, index) => `${index + 1}. ${number}`)
            ];
            await reply(`⚙️ *SUDO LIST*\n\n${lines.join('\n')}`);
        }
    },
    {
        command: 'settings',
        aliases: ['features', 'toggles'],
        category: 'settings',
        owner: true,
        description: 'Show all bot feature toggles',
        execute: async (sock, m, { reply }) => {
            const flag = key => getFeature(key) ? '✅ ON' : '❌ OFF';
            await reply(
                `⚙️ *BOT FEATURES*\n\n` +
                `👁️ Auto Status View: ${flag('autostatusview')}\n` +
                `💫 Auto Status React: ${flag('autostatusreact')}\n` +
                `🕵️ Anti View Once: ${flag('antiviewonce')}\n` +
                `📖 Auto Read: ${flag('autoread')}\n` +
                `⌨️ Auto Typing: ${flag('autotyping')}\n` +
                `🎙️ Auto Recording: ${flag('autorecording')}\n` +
                `⌨️🎙️ Auto Typing + Recording: ${flag('autotypingrecording')}\n` +
                `🗑️ Anti Delete: ${flag('antidelete')}\n` +
                `🔗 Anti Link: *${getFeature('antilink')}*\n` +
                `👤 Sudo Users: *${getSudoList().length}*`
            );
        }
    }
];
