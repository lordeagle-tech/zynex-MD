const {
    apiGet,
    apiError,
    clip,
    errorText,
    findMediaUrl,
    isUrl,
    react,
    unwrap
} = require('../library/apiHelper');

function pretty(result) {
    if (result == null) return '';
    if (typeof result === 'string') return result;
    if (typeof result === 'number' || typeof result === 'boolean') return String(result);
    if (Array.isArray(result)) {
        return result.slice(0, 10).map((item, i) => {
            if (typeof item === 'string') return `${i + 1}. ${item}`;
            return `${i + 1}. ${JSON.stringify(item)}`;
        }).join('\n');
    }
    if (typeof result === 'object') {
        for (const key of ['shortUrl', 'shortened', 'translatedText', 'message', 'text', 'answer']) {
            if (typeof result[key] === 'string') return result[key];
        }
        return Object.entries(result)
            .filter(([, value]) => value != null && typeof value !== 'object')
            .slice(0, 15)
            .map(([key, value]) => `*${key}:* ${value}`)
            .join('\n');
    }
    return String(result);
}

function shortener({ command, aliases = [], endpoint, label }) {
    return {
        command,
        aliases,
        category: 'tools',
        description: `Shorten a URL with ${label}`,
        execute: async (sock, m, { text, prefix, reply }) => {
            const parts = String(text || '').trim().split(/\s+/);
            const url = parts.find(isUrl);
            if (!url) {
                return reply(`❌ Provide a URL.\nExample: ${prefix}${command} https://example.com`);
            }
            const name = parts.find(part => part !== url) || '';

            await react(sock, m, '🔗');
            try {
                const data = await apiGet(endpoint, { url, name }, { timeout: 45000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const result = unwrap(data);
                const shortUrl = result?.shortened || result?.shortUrl || result?.url || findMediaUrl(result);
                await reply(`🔗 *${label}*\n\n${shortUrl || pretty(result)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    };
}

module.exports = [
    shortener({ command: 'shorturl', aliases: ['tinyurl'], endpoint: '/shortener/tinyurl', label: 'TinyURL' }),
    shortener({ command: 'dagd', endpoint: '/shortener/dagd', label: 'Dagd' }),
    shortener({ command: 'vgd', endpoint: '/shortener/vgd', label: 'VGD' }),
    shortener({ command: 'tinube', endpoint: '/shortener/tinube', label: 'Tinube' }),
    shortener({ command: 'randomshort', aliases: ['rshort'], endpoint: '/shortener/random', label: 'Random Shortener' }),
    {
        command: 'translate',
        aliases: ['tr'],
        category: 'tools',
        description: 'Translate text to another language',
        execute: async (sock, m, { text, prefix, reply }) => {
            const parts = String(text || '').trim().split(/\s+/);
            if (!text) {
                return reply(`❌ Provide text.\nExample: ${prefix}translate fr hello world`);
            }

            let to = 'en';
            let source = text;
            if (parts.length > 1 && /^[a-z]{2}(-[A-Z]{2})?$/i.test(parts[0])) {
                to = parts[0];
                source = parts.slice(1).join(' ');
            }

            await react(sock, m, '🌐');
            try {
                const data = await apiGet('/translate', { text: source, to }, { timeout: 45000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const result = unwrap(data);
                const translated = result?.translatedText || pretty(result);
                await reply(`🌐 *Translate → ${to}*\n\n${clip(source, 1000)}\n\n➡️ *${clip(translated, 3000)}*`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'tempmail',
        aliases: ['tmpmail'],
        category: 'tools',
        description: 'Generate a temporary email address',
        execute: async (sock, m, { reply }) => {
            await react(sock, m, '📧');
            try {
                const data = await apiGet('/tempmail', {}, { timeout: 45000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                await reply(`📧 *Temp Mail*\n\n${clip(pretty(unwrap(data)), 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'inbox',
        aliases: ['tempinbox'],
        category: 'tools',
        description: 'Check a temporary email inbox',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide the temp email address.\nExample: ${prefix}inbox name@example.com`);
            }
            await react(sock, m, '📬');
            try {
                const data = await apiGet('/get_inbox_tempmail', { q: text.trim() }, { timeout: 45000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                await reply(`📬 *Inbox*\n\n${clip(pretty(unwrap(data)) || 'No messages.', 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'fancy',
        aliases: ['fancytext'],
        category: 'tools',
        description: 'Style text with fancy fonts',
        execute: async (sock, m, { text, prefix, reply }) => {
            const parts = String(text || '').trim().split(/\s+/);
            if (!text) {
                return reply(`❌ Provide text.\nExample: ${prefix}fancy hello`);
            }

            let style = 3;
            let source = text;
            if (parts.length > 1 && /^\d+$/.test(parts[0])) {
                style = Number(parts[0]);
                source = parts.slice(1).join(' ');
            }

            await react(sock, m, '✨');
            try {
                const data = await apiGet('/fancytext', { q: source, style }, { timeout: 45000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                await reply(`✨ *Fancy Text (style ${style})*\n\n${clip(pretty(unwrap(data)), 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'ssweb',
        aliases: ['screenshot', 'webshot'],
        category: 'tools',
        description: 'Screenshot a website',
        execute: async (sock, m, { text, prefix, reply }) => {
            const url = String(text || '').trim().split(/\s+/).find(isUrl);
            if (!url) {
                return reply(`❌ Provide a website URL.\nExample: ${prefix}ssweb https://example.com`);
            }
            await react(sock, m, '📸');
            try {
                const data = await apiGet('/tool/screenshot', { url }, { timeout: 90000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const imageUrl = findMediaUrl(data);
                if (!imageUrl) {
                    await react(sock, m, '❌');
                    return reply('🚫 Could not capture that website.');
                }
                await sock.sendMessage(m.chat, {
                    image: { url: imageUrl },
                    caption: `📸 ${clip(url, 200)}\n\n> Powered by Keith APIs`
                }, { quoted: m });
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'ip',
        aliases: ['iplookup'],
        category: 'tools',
        description: 'Lookup IP address details',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide an IP address.\nExample: ${prefix}ip 8.8.8.8`);
            }
            await react(sock, m, '🌍');
            try {
                const data = await apiGet('/ip/lookup', { q: text.trim() }, { timeout: 45000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                await reply(`🌍 *IP Lookup: ${clip(text, 60)}*\n\n${clip(pretty(unwrap(data)), 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'onwa',
        aliases: ['onwhatsapp'],
        category: 'tools',
        description: 'Check if a number is on WhatsApp',
        execute: async (sock, m, { text, prefix, reply }) => {
            const number = String(text || '').replace(/[^0-9]/g, '');
            if (!number) {
                return reply(`❌ Provide a phone number.\nExample: ${prefix}onwa 254712345678`);
            }
            await react(sock, m, '🔎');
            try {
                const data = await apiGet('/onwhatsapp', { q: number }, { timeout: 45000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                await reply(`📱 *WhatsApp Check: ${number}*\n\n${clip(pretty(unwrap(data)), 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'pp',
        aliases: ['profilepic', 'getpp'],
        category: 'tools',
        description: 'Download a WhatsApp profile picture',
        execute: async (sock, m, { text, prefix, reply }) => {
            const number = String(text || '').replace(/[^0-9]/g, '');
            if (!number) {
                return reply(`❌ Provide a phone number.\nExample: ${prefix}pp 254712345678`);
            }
            await react(sock, m, '🖼️');
            try {
                const data = await apiGet('/whatsapp/profile', { query: number }, { timeout: 45000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const result = unwrap(data);
                const imageUrl = findMediaUrl(result);
                if (!imageUrl) {
                    await react(sock, m, '❌');
                    return reply('🚫 No profile picture found or it is private.');
                }
                await sock.sendMessage(m.chat, {
                    image: { url: imageUrl },
                    caption: `📱 *Profile Picture: ${number}*\n\n> Powered by Keith APIs`
                }, { quoted: m });
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'walink',
        aliases: ['wame'],
        category: 'tools',
        description: 'Create a WhatsApp chat link',
        execute: async (sock, m, { text, prefix, reply }) => {
            const parts = String(text || '').trim().split(/\s+/);
            const number = parts.find(part => /^\+?\d{7,15}$/.test(part));
            if (!number) {
                return reply(`❌ Provide a phone number.\nExample: ${prefix}walink 254712345678 hello`);
            }
            const message = parts.filter(part => part !== number).join(' ') || 'Hello';

            await react(sock, m, '🔗');
            try {
                const data = await apiGet('/tools/walink', {
                    q: message,
                    number: number.replace(/[^0-9]/g, '')
                }, { timeout: 45000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const result = unwrap(data);
                const link = result?.shortUrl || result?.url || pretty(result);
                await reply(`🔗 *WhatsApp Link*\n\n${link}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'tempnumber',
        aliases: ['tmpnumber'],
        category: 'tools',
        description: 'Generate a temporary phone number',
        execute: async (sock, m, { reply }) => {
            await react(sock, m, '📱');
            try {
                const data = await apiGet('/tempnumber', {}, { timeout: 45000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                await reply(`📱 *Temp Number*\n\n${clip(pretty(unwrap(data)), 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'github',
        aliases: ['gh'],
        category: 'tools',
        description: 'Get GitHub followers or following',
        execute: async (sock, m, { text, prefix, reply }) => {
            const parts = String(text || '').trim().split(/\s+/);
            const mode = /^(following|followers)$/i.test(parts[0] || '') ? parts.shift().toLowerCase() : 'followers';
            const user = parts[0] || '';
            if (!user) {
                return reply(`❌ Provide a GitHub username.\nExample: ${prefix}github followers torvalds`);
            }

            await react(sock, m, '🐙');
            try {
                const data = await apiGet(`/github/${mode}`, { q: user }, { timeout: 45000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                await reply(`🐙 *GitHub ${mode}: ${clip(user, 60)}*\n\n${clip(pretty(unwrap(data)), 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'ascii',
        aliases: ['asciiart'],
        category: 'tools',
        description: 'Generate ASCII art text',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide a prompt.\nExample: ${prefix}ascii dragon`);
            }
            await react(sock, m, '🔤');
            try {
                const data = await apiGet('/tools/ascii2', { q: text }, { timeout: 90000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                await reply(`🔤 *ASCII: ${clip(text, 60)}*\n\n${clip(pretty(unwrap(data)), 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'exchange',
        aliases: ['currency'],
        category: 'tools',
        description: 'Get currency exchange rates',
        execute: async (sock, m, { text, reply }) => {
            const target = (text || 'KES').trim().split(/\s+/)[0].toUpperCase();
            await react(sock, m, '💱');
            try {
                const data = await apiGet('/finance/exchange', { q: target }, { timeout: 45000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                await reply(`💱 *Exchange Rate*\n\n${clip(pretty(unwrap(data)), 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    }
];
