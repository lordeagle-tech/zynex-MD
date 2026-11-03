const {
    apiGet,
    apiError,
    clip,
    errorText,
    findMediaUrl,
    react,
    unwrap
} = require('../library/apiHelper');

function pretty(result) {
    if (result == null) return '';
    if (typeof result === 'string') return result;
    if (typeof result === 'number' || typeof result === 'boolean') return String(result);
    if (Array.isArray(result)) {
        return result.slice(0, 10).map((item, i) => `${i + 1}. ${pretty(item)}`).join('\n');
    }
    if (typeof result === 'object') {
        if (result.results && !Array.isArray(result.results)) {
            const answer = result.results?.data?.answer;
            if (typeof answer === 'string') return answer;
        }
        if (Array.isArray(result.results)) {
            return result.results.slice(0, 5).map(item => {
                const title = item.surah_title || item.title;
                const content = item.content || item.text;
                return `${title ? `*${title}*\n` : ''}${content || ''}`;
            }).join('\n\n');
        }
        for (const key of ['answer', 'text', 'message', 'content']) {
            if (typeof result[key] === 'string') return result[key];
        }
        return JSON.stringify(result, null, 2);
    }
    return String(result);
}

function hymnText(result) {
    const lines = [];
    if (result.title) lines.push(`🎵 *${result.title}*`);
    if (result.number) lines.push(`#${result.number}`);
    for (const verse of (result.verses || []).slice(0, 8)) {
        lines.push(`\n*Verse ${verse.number || ''}*`);
        lines.push((verse.lines || []).join('\n'));
    }
    return lines.join('\n');
}

function aiCommand({ command, aliases = [], endpoint, label }) {
    return {
        command,
        aliases,
        category: 'spiritual',
        description: `Ask ${label}`,
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide a question.\nExample: ${prefix}${command} who is God`);
            }
            await react(sock, m, '🕊️');
            try {
                const data = await apiGet(endpoint, { q: text }, { timeout: 90000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                await reply(`🕊️ *${label}*\n\n${clip(pretty(unwrap(data)), 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    };
}

module.exports = [
    {
        command: 'bible',
        aliases: ['bibleverse'],
        category: 'spiritual',
        description: 'Search Bible verses',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide a keyword or reference.\nExample: ${prefix}bible God`);
            }
            await react(sock, m, '📖');
            try {
                const isReference = /\d+\s*:\s*\d+/.test(text)
                    || /^(?:[1-3]\s*)?[a-z]+\s+\d+(?::\d+)?/i.test(text.trim());
                const endpoint = isReference ? '/search/bible' : '/bible/search';
                const data = await apiGet(endpoint, { q: text }, { timeout: 60000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }

                const result = unwrap(data);
                const verses = Array.isArray(result?.verses) ? result.verses : [];
                let body = '';
                if (result?.text) {
                    body = result.reference ? `*${result.reference}*\n${result.text}` : result.text;
                } else if (verses.length) {
                    body = verses.slice(0, 8).map(v => {
                        const reference = v.reference || `${v.book || ''} ${v.chapter || ''}:${v.verse || ''}`.trim();
                        return `*${reference}*\n${v.preview || v.text || ''}`;
                    }).join('\n\n');
                } else {
                    body = pretty(result);
                }
                await reply(`📖 *Bible: ${clip(text, 80)}*\n\n${clip(body, 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'hymn',
        aliases: ['hymnal'],
        category: 'spiritual',
        description: 'Search hymns',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide a hymn title or number.\nExample: ${prefix}hymn wapaki nyasaye`);
            }
            await react(sock, m, '🎵');
            try {
                const data = await apiGet('/hymn/wendenyasaye', { q: text }, { timeout: 60000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const result = unwrap(data);
                const songs = Array.isArray(result?.songs) ? result.songs : [];
                if (!songs.length) {
                    await react(sock, m, '❌');
                    return reply('⚠️ No hymns found.');
                }
                const body = songs.slice(0, 5).map(song => {
                    if (typeof song === 'string') return song;
                    const lines = Array.isArray(song.lines)
                        ? song.lines.join('\n')
                        : Array.isArray(song.verses)
                            ? song.verses.map(verse => Array.isArray(verse.lines) ? verse.lines.join('\n') : (verse.text || '')).filter(Boolean).join('\n\n')
                            : (song.text || '');
                    return `🎵 *${song.title || 'Hymn'}*${song.number ? ` (#${song.number})` : ''}\n${lines}`;
                }).join('\n\n');
                await reply(`🎵 *Hymns: ${clip(text, 80)}*\n\n${clip(body, 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'adventist',
        aliases: ['sda'],
        category: 'spiritual',
        description: 'Search the Adventist hymnal',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide a hymn number or title.\nExample: ${prefix}adventist 10`);
            }
            await react(sock, m, '🎵');
            try {
                const data = await apiGet('/adventist/hymnal', { q: text }, { timeout: 60000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const result = unwrap(data);
                await reply(clip(hymnText(result) || pretty(result), 3500));
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'surahlist',
        aliases: ['surahs'],
        category: 'spiritual',
        description: 'List Quran surahs',
        execute: async (sock, m, { reply }) => {
            await react(sock, m, '📖');
            try {
                const data = await apiGet('/surahlist', {}, { timeout: 60000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const result = unwrap(data);
                const list = Array.isArray(result?.data) ? result.data : [];
                const body = list.slice(0, 25).map(s => {
                    const name = s.name?.english || s.englishName || s.name;
                    return `${s.number}. ${name}${s.name?.translation ? ` — ${s.name.translation}` : ''} (${s.verses} verses)`;
                }).join('\n');
                await reply(`📖 *Surah List*\n\n${clip(body || pretty(result), 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'surah',
        aliases: ['quran'],
        category: 'spiritual',
        description: 'Get a Quran surah or audio',
        execute: async (sock, m, { text, prefix, reply }) => {
            await react(sock, m, '📖');
            try {
                const data = await apiGet('/quran/audio', {}, { timeout: 90000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }

                const result = unwrap(data) || {};
                const entries = Object.entries(result);
                const query = String(text || '').trim().toLowerCase();
                const match = query
                    ? entries.find(([key]) => key.toLowerCase().includes(query))
                    : null;

                if (!match) {
                    const list = entries.slice(0, 20).map(([key]) => `• ${key}`).join('\n');
                    await reply(`📖 *Quran Audio*\n\n${list}\n\nUsage: ${prefix}surah <name or number>`);
                    return react(sock, m, '✅');
                }

                const audioUrl = findMediaUrl(match[1]);
                if (!audioUrl) {
                    await react(sock, m, '❌');
                    return reply('🚫 Audio not found for that surah.');
                }

                await sock.sendMessage(m.chat, {
                    audio: { url: audioUrl },
                    mimetype: 'audio/mpeg',
                    fileName: `${match[0]}.mp3`
                }, { quoted: m });
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    aiCommand({ command: 'aibible', endpoint: '/ai/bible', label: 'AI Bible' }),
    aiCommand({ command: 'aimuslim', aliases: ['aiislam'], endpoint: '/ai/muslim', label: 'AI Muslim' })
];
