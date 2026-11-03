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

function itemLine(item, index) {
    if (typeof item === 'string') return `${index + 1}. ${item}`;
    if (!item || typeof item !== 'object') return `${index + 1}. ${String(item)}`;

    const title = item.title || item.name || item.song || item.word || item.reference || item.query;
    const artist = item.artist || item.developer || item.author;
    const extra = item.duration || item.views || item.release || item.timestamp;
    const link = item.url || item.link || item.postLink || item.itemurl || item.itemUrl;

    let line = `${index + 1}. *${title || 'Result'}*`;
    if (artist) line += ` — ${artist}`;
    if (extra) line += ` (${extra})`;
    if (item.description && !title) line += `\n${clip(item.description, 200)}`;
    if (link) line += `\n${link}`;
    return line;
}

function pretty(result, maxItems = 8) {
    if (result == null) return '';
    if (typeof result === 'string') return result;
    if (typeof result === 'number' || typeof result === 'boolean') return String(result);

    if (Array.isArray(result)) {
        return result.slice(0, maxItems).map(itemLine).join('\n\n');
    }

    if (typeof result === 'object') {
        const list = result.results || result.items || result.verses || result.data || result.songs;
        if (Array.isArray(list)) {
            const header = result.query ? `Results for: ${result.query}\n\n` : '';
            return header + list.slice(0, maxItems).map(itemLine).join('\n\n');
        }

        if (typeof result.text === 'string' && result.text) return result.text;
        if (typeof result.Plot === 'string') {
            return [
                result.Title && `🎬 *${result.Title}*`,
                result.Year && `📅 ${result.Year}`,
                result.Genre && `🎭 ${result.Genre}`,
                result.Runtime && `⏱️ ${result.Runtime}`,
                result.Actors && `👥 ${result.Actors}`,
                result.Plot && `\n${result.Plot}`
            ].filter(Boolean).join('\n');
        }
        if (typeof result.answer === 'string') return result.answer;
        if (typeof result.message === 'string') return result.message;

        return Object.entries(result)
            .filter(([, value]) => value != null && typeof value !== 'object')
            .slice(0, 12)
            .map(([key, value]) => `*${key}:* ${value}`)
            .join('\n');
    }
    return String(result);
}

function textSearch({ command, aliases = [], endpoint, param = 'q', label, timeout = 60000 }) {
    return {
        command,
        aliases,
        category: 'search',
        description: `Search ${label}`,
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide a search query.\nExample: ${prefix}${command} hello`);
            }

            await react(sock, m, '🔍');
            try {
                const data = await apiGet(endpoint, { [param]: text }, { timeout });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }

                const output = pretty(unwrap(data));
                if (!output) {
                    await react(sock, m, '❌');
                    return reply('⚠️ No results found.');
                }

                await reply(`🔍 *${label}: ${clip(text, 80)}*\n\n${clip(output, 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    };
}

module.exports = [
    textSearch({ command: 'ytsearch', aliases: ['yts'], endpoint: '/search/yts', param: 'query', label: 'YouTube Search' }),
    textSearch({ command: 'google', endpoint: '/search/google', param: 'q', label: 'Google Search' }),
    textSearch({ command: 'bing', endpoint: '/search/bing', param: 'query', label: 'Bing Search' }),
    textSearch({ command: 'brave', endpoint: '/search/brave', param: 'q', label: 'Brave Search' }),
    textSearch({ command: 'apksearch', aliases: ['findapk'], endpoint: '/search/apk', param: 'q', label: 'APK Search' }),
    textSearch({ command: 'tiktoksearch', aliases: ['ttsearch'], endpoint: '/search/tiktoksearch', param: 'query', label: 'TikTok Search' }),
    textSearch({ command: 'soundcloudsearch', aliases: ['scsearch'], endpoint: '/search/soundcloud', param: 'q', label: 'SoundCloud Search' }),
    textSearch({ command: 'spotifysearch', aliases: ['spsearch'], endpoint: '/search/spotify', param: 'q', label: 'Spotify Search' }),
    textSearch({ command: 'tweets', aliases: ['twsearch'], endpoint: '/search/searchtweets', param: 'q', label: 'Tweet Search' }),
    {
        command: 'images',
        aliases: ['imagesearch'],
        category: 'search',
        description: 'Search Google images',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide an image search query.\nExample: ${prefix}images dog`);
            }

            await react(sock, m, '🖼️');
            try {
                const data = await apiGet('/search/images', { query: text }, { timeout: 60000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }

                const items = Array.isArray(data.result) ? data.result : [];
                const urls = items
                    .map(item => item.url || item.thumbnail)
                    .filter(isUrl)
                    .slice(0, 4);

                if (!urls.length) {
                    await react(sock, m, '❌');
                    return reply('⚠️ No images found.');
                }

                let sent = 0;
                for (const url of urls) {
                    try {
                        await sock.sendMessage(m.chat, {
                            image: { url },
                            caption: `🖼️ *${clip(text, 80)}* (${sent + 1}/${urls.length})\n\n> Powered by Keith APIs`
                        }, { quoted: m });
                        sent++;
                    } catch {}
                }

                if (!sent) {
                    await reply(`🔍 *Images: ${clip(text, 80)}*\n\n${urls.join('\n')}`);
                }
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'reverseimage',
        aliases: ['rimage'],
        category: 'search',
        description: 'Reverse image search',
        execute: async (sock, m, { text, prefix, reply }) => {
            const imageUrl = String(text || '').trim().split(/\s+/).find(isUrl);
            if (!imageUrl) {
                return reply(`❌ Provide an image URL.\nExample: ${prefix}reverseimage https://example.com/img.jpg`);
            }

            await react(sock, m, '🔍');
            try {
                const data = await apiGet('/search/reverseimage', { url: imageUrl }, { timeout: 90000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const output = pretty(unwrap(data));
                await reply(`🔍 *Reverse Image Search*\n\n${clip(output || 'No matches found.', 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'lyrics',
        aliases: ['lyric'],
        category: 'search',
        description: 'Search song lyrics',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide a song name.\nExample: ${prefix}lyrics faded`);
            }

            await react(sock, m, '🎵');
            try {
                const data = await apiGet('/search/lyrics', { query: text }, { timeout: 60000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }

                const first = Array.isArray(data.result) ? data.result[0] : data.result;
                if (!first) {
                    await react(sock, m, '❌');
                    return reply('⚠️ No lyrics found.');
                }

                const title = first.song || first.title || text;
                const artist = first.artist ? ` — ${first.artist}` : '';
                const body = first.lyrics || first.text || pretty(first);
                await reply(`🎵 *${clip(title, 100)}${artist}*\n\n${clip(body, 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'biblesearch',
        aliases: ['verse'],
        category: 'search',
        description: 'Search Bible verses',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide a verse or keyword.\nExample: ${prefix}biblesearch john3:16`);
            }

            await react(sock, m, '📖');
            try {
                const data = await apiGet('/search/bible', { q: text }, { timeout: 60000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }

                const result = unwrap(data);
                const reference = result?.reference || text;
                const body = result?.text
                    || (Array.isArray(result?.verses)
                        ? result.verses.map(v => `${v.reference || `${v.book} ${v.chapter}:${v.verse}`}\n${v.text}`).join('\n\n')
                        : pretty(result));
                await reply(`📖 *${clip(reference, 100)}*\n\n${clip(body, 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'stickersearch',
        aliases: ['sticker', 'findsticker'],
        category: 'search',
        description: 'Search stickers',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide a sticker search query.\nExample: ${prefix}stickersearch cat`);
            }

            await react(sock, m, '🔍');
            try {
                const data = await apiGet('/search/sticker', { q: text }, { timeout: 60000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }

                const results = data.result?.results || data.result || [];
                const first = Array.isArray(results) ? results.find(item => isUrl(item.url)) : null;
                if (!first) {
                    await react(sock, m, '❌');
                    return reply('⚠️ No stickers found.');
                }

                try {
                    await sock.sendMessage(m.chat, {
                        video: { url: first.url },
                        gifPlayback: true,
                        caption: `🔍 *${clip(text, 80)}*\n\n> Powered by Keith APIs`
                    }, { quoted: m });
                } catch {
                    await reply(`🔍 *Sticker: ${clip(text, 80)}*\n\n${first.url}`);
                }
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'tgs',
        aliases: ['tgsticker'],
        category: 'search',
        description: 'Search Telegram stickers',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide a sticker search query.\nExample: ${prefix}tgs cat`);
            }

            await react(sock, m, '🔍');
            try {
                const data = await apiGet('/search/tgs', { q: text }, { timeout: 60000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const output = pretty(unwrap(data));
                await reply(`🔍 *Telegram Stickers: ${clip(text, 80)}*\n\n${clip(output || 'No stickers found.', 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'movsearch',
        aliases: ['moviesearch'],
        category: 'search',
        description: 'Search for a movie or TV show',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide a movie name.\nExample: ${prefix}movsearch Lucifer`);
            }

            await react(sock, m, '🎬');
            try {
                const data = await apiGet('/search/movie', { q: text }, { timeout: 60000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }

                const result = unwrap(data);
                const poster = result?.Poster && isUrl(result.Poster) ? result.Poster : null;
                const caption = `🎬 *${clip(text, 80)}*\n\n${clip(pretty(result), 3000)}`;

                if (poster) {
                    await sock.sendMessage(m.chat, {
                        image: { url: poster },
                        caption
                    }, { quoted: m });
                } else {
                    await reply(caption);
                }
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'iguser',
        aliases: ['instauser'],
        category: 'search',
        description: 'Search an Instagram user',
        execute: async (sock, m, { text, prefix, reply }) => {
            const user = String(text || '').trim().split(/\s+/)[0];
            if (!user) {
                return reply(`❌ Provide an Instagram username.\nExample: ${prefix}iguser cristiano`);
            }

            await react(sock, m, '🔍');
            try {
                const data = await apiGet('/search/instauser', { user }, { timeout: 60000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const result = unwrap(data);
                const avatar = result?.profilePic || result?.profile_pic || result?.avatar;
                const caption = `📸 *Instagram: ${clip(user, 60)}*\n\n${clip(pretty(result), 3000)}`;

                if (isUrl(avatar)) {
                    await sock.sendMessage(m.chat, {
                        image: { url: avatar },
                        caption
                    }, { quoted: m });
                } else {
                    await reply(caption);
                }
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    }
];
