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

function pretty(result, maxItems = 8) {
    if (result == null) return '';
    if (typeof result === 'string') return result;
    if (typeof result === 'number' || typeof result === 'boolean') return String(result);
    if (Array.isArray(result)) {
        return result.slice(0, maxItems).map((item, i) => {
            if (typeof item === 'string') return `${i + 1}. ${item}`;
            const title = item.title || item.name || item.originalTitle;
            const link = item.url || item.link || item.detailUrl;
            const extra = item.year || item.releaseDate || item.knownFor;
            return `${i + 1}. *${title || 'Result'}*${extra ? ` — ${extra}` : ''}${link ? `\n${link}` : ''}`;
        }).join('\n\n');
    }
    if (typeof result === 'object') {
        const list = result.items || result.results || result.trending || result.data;
        if (Array.isArray(list)) {
            const header = result.query ? `Results for: ${result.query}\n\n` : '';
            return header + pretty(list, maxItems);
        }
        for (const key of ['title', 'message', 'text', 'answer']) {
            if (typeof result[key] === 'string') return result[key];
        }
        return Object.entries(result)
            .filter(([, value]) => value != null && typeof value !== 'object')
            .slice(0, 12)
            .map(([key, value]) => `*${key}:* ${value}`)
            .join('\n');
    }
    return String(result);
}

module.exports = [
    {
        command: 'movie',
        aliases: ['moviebox'],
        category: 'movie',
        description: 'Search movies on MovieBox',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide a movie name.\nExample: ${prefix}movie as good as dead`);
            }
            await react(sock, m, '🎬');
            try {
                const data = await apiGet('/moviebox/search', { q: text }, { timeout: 60000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const output = pretty(unwrap(data));
                await reply(`🎬 *Movie Search: ${clip(text, 80)}*\n\n${clip(output || 'No results found.', 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'trailer',
        aliases: ['movietrailer'],
        category: 'movie',
        description: 'Get a movie trailer',
        execute: async (sock, m, { text, prefix, reply }) => {
            const url = String(text || '').trim().split(/\s+/).find(isUrl);
            if (!url) {
                return reply(`❌ Provide a MovieBox detail URL.\nExample: ${prefix}trailer https://moviebox.ph/detail/...`);
            }
            await react(sock, m, '🎬');
            try {
                const data = await apiGet('/movie/trailer', { q: url }, { timeout: 90000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const result = unwrap(data);
                const trailerUrl = result?.trailerUrl || findMediaUrl(result);
                if (!trailerUrl) {
                    await react(sock, m, '❌');
                    return reply('🚫 No trailer found for that movie.');
                }
                await sock.sendMessage(m.chat, {
                    video: { url: trailerUrl },
                    mimetype: 'video/mp4',
                    fileName: 'trailer.mp4',
                    caption: `🎬 *${clip(result.title || 'Movie Trailer', 200)}*\n\n${clip(result.description || '', 800)}\n\n> Powered by Keith APIs`
                }, { quoted: m });
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'ibox',
        aliases: ['iboxtv'],
        category: 'movie',
        description: 'Browse iBox TV, movies, anime, or search',
        execute: async (sock, m, { text, prefix, reply }) => {
            const parts = String(text || '').trim().split(/\s+/).filter(Boolean);
            const mode = (parts[0] || 'tv').toLowerCase();
            const query = parts.slice(1).join(' ');

            let endpoint = '/iboxtv';
            let params = { page: 1 };
            let label = 'iBox TV';

            if (mode === 'movies' || mode === 'movie') {
                endpoint = '/iboxmovies';
                label = 'iBox Movies';
            } else if (mode === 'anime') {
                endpoint = '/iboxanime';
                label = 'iBox Anime';
            } else if (mode === 'search') {
                if (!query) {
                    return reply(`❌ Provide a search query.\nExample: ${prefix}ibox search night`);
                }
                endpoint = '/iboxtv/search';
                params = { q: query, page: 1 };
                label = `iBox Search: ${query}`;
            } else if (mode === 'detail') {
                if (!isUrl(query)) {
                    return reply(`❌ Provide an iBox detail URL.\nExample: ${prefix}ibox detail https://ibox-tv.com/show/...`);
                }
                endpoint = '/iboxtv/detail';
                params = { url: query };
                label = 'iBox Detail';
            } else if (/^\d+$/.test(mode)) {
                params = { page: Number(mode) };
            }

            await react(sock, m, '🎬');
            try {
                const data = await apiGet(endpoint, params, { timeout: 60000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                await reply(`🎬 *${clip(label, 100)}*\n\n${clip(pretty(unwrap(data)) || 'No results found.', 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'dramabox',
        aliases: ['dbstream'],
        category: 'movie',
        description: 'Download a DramaBox episode',
        execute: async (sock, m, { text, prefix, reply }) => {
            const parts = String(text || '').trim().split(/\s+/);
            const bookId = parts[0];
            const episode = Number(parts[1] || 1);
            if (!bookId) {
                return reply(`❌ Provide a DramaBox book ID.\nExample: ${prefix}dramabox 41000105764 1`);
            }
            await react(sock, m, '🎬');
            try {
                const data = await apiGet('/dramabox/stream', { bookId, episode }, { timeout: 120000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const videoUrl = findMediaUrl(data);
                if (!videoUrl) {
                    await react(sock, m, '❌');
                    return reply('🚫 Episode video not found.');
                }
                await sock.sendMessage(m.chat, {
                    video: { url: videoUrl },
                    mimetype: 'video/mp4',
                    fileName: `dramabox-${bookId}-${episode}.mp4`,
                    caption: `🎬 *DramaBox ${bookId} — Episode ${episode}*\n\n> Powered by Keith APIs`
                }, { quoted: m });
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'actor',
        aliases: ['actorsearch'],
        category: 'movie',
        description: 'Search for movie actors',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide an actor name.\nExample: ${prefix}actor omari`);
            }
            await react(sock, m, '🎭');
            try {
                const data = await apiGet('/actor/search', { q: text }, { timeout: 60000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const results = Array.isArray(data.result) ? data.result : [];
                if (!results.length) {
                    await react(sock, m, '❌');
                    return reply('⚠️ No actors found.');
                }
                const caption = `🎭 *Actor Search: ${clip(text, 80)}*\n\n${clip(pretty(results), 3000)}`;
                const first = results[0];
                if (first && isUrl(first.image)) {
                    await sock.sendMessage(m.chat, {
                        image: { url: first.image },
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
