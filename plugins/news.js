const {
    apiGet,
    apiError,
    clip,
    errorText,
    react,
    unwrap
} = require('../library/apiHelper');

function decodeEntities(value) {
    return String(value == null ? '' : value)
        .replace(/&#0?39;|&#x27;|&apos;/gi, "'")
        .replace(/&quot;/gi, '"')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>');
}

function collectArticles(value, out = [], depth = 0) {
    if (value == null || depth > 6 || out.length >= 10) return out;
    if (Array.isArray(value)) {
        for (const item of value) collectArticles(item, out, depth + 1);
        return out;
    }
    if (typeof value !== 'object') return out;

    const title = value.title || value.headline || value.name;
    const link = value.url || value.link;
    if (typeof title === 'string' && typeof link === 'string') {
        out.push({
            title,
            link,
            description: value.description || value.summary || value.teaser || value.excerpt || '',
            source: value.author || value.category || ''
        });
        return out;
    }

    for (const entry of Object.values(value)) collectArticles(entry, out, depth + 1);
    return out;
}

function formatArticles(result) {
    const articles = collectArticles(result);
    if (!articles.length) {
        if (typeof result === 'string') return result;
        if (result && typeof result === 'object') {
            return Object.entries(result)
                .filter(([, value]) => value != null && typeof value !== 'object')
                .slice(0, 8)
                .map(([key, value]) => `*${key}:* ${value}`)
                .join('\n');
        }
        return 'No articles found.';
    }

    return articles.map((article, index) => {
        let line = `${index + 1}. *${decodeEntities(article.title)}*`;
        if (article.description) line += `\n${clip(decodeEntities(article.description), 180)}`;
        if (article.source) line += `\n👤 ${decodeEntities(article.source)}`;
        line += `\n${article.link}`;
        return line;
    }).join('\n\n');
}

const SOURCES = {
    citizen: { endpoint: '/news/citizen', label: 'Citizen News' },
    ntv: { endpoint: '/news/ntv', label: 'NTV News' },
    kbc: { endpoint: '/news/kbc', label: 'KBC News' },
    bbc: { endpoint: '/news/bbc', label: 'BBC News' },
    tech: { endpoint: '/news/tech', label: 'Tech News' },
    kenyans: { endpoint: '/news/kenyans', label: 'Kenyans.co.ke' }
};

module.exports = [
    {
        command: 'news',
        aliases: ['latestnews'],
        category: 'news',
        description: 'Get latest news (citizen, ntv, kbc, bbc, tech, kenyans)',
        execute: async (sock, m, { text, prefix, reply }) => {
            const parts = String(text || '').trim().split(/\s+/).filter(Boolean);
            let source = 'citizen';
            if (parts.length && SOURCES[parts[0].toLowerCase()]) {
                source = parts.shift().toLowerCase();
            }
            const query = parts.join(' ');
            const config = SOURCES[source];

            await react(sock, m, '📰');
            try {
                const endpoint = source === 'kenyans' && query ? '/news/kenyans/search' : config.endpoint;
                const params = endpoint.endsWith('/search') ? { q: query } : {};
                const data = await apiGet(endpoint, params, { timeout: 60000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }

                const label = query ? `${config.label}: ${query}` : config.label;
                await reply(`📰 *${clip(label, 100)}*\n\n${clip(formatArticles(unwrap(data)), 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'footballnews',
        aliases: ['football'],
        category: 'news',
        description: 'Get the latest football news',
        execute: async (sock, m, { reply }) => {
            await react(sock, m, '⚽');
            try {
                const data = await apiGet('/football/news', {}, { timeout: 60000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                await reply(`⚽ *Football News*\n\n${clip(formatArticles(unwrap(data)), 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    }
];
