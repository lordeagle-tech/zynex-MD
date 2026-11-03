const {
    apiGet,
    apiError,
    clip,
    errorText,
    react,
    unwrap
} = require('../library/apiHelper');

function prettyResult(result) {
    if (result == null) return '';
    if (typeof result === 'string') return result;
    if (typeof result === 'number' || typeof result === 'boolean') return String(result);
    if (Array.isArray(result)) {
        return result.slice(0, 8).map((item, i) => {
            if (typeof item === 'string') return `${i + 1}. ${item}`;
            const title = item.title || item.name || item.word;
            const link = item.url || item.link;
            return `${i + 1}. ${title || JSON.stringify(item)}${link ? `\n${link}` : ''}`;
        }).join('\n\n');
    }
    if (typeof result === 'object') {
        for (const key of ['answer', 'text', 'message', 'definition', 'explanation', 'content']) {
            if (typeof result[key] === 'string') return result[key];
        }
        return JSON.stringify(result, null, 2);
    }
    return String(result);
}

function askCommand({ command, aliases = [], endpoint, label, param = 'q' }) {
    return {
        command,
        aliases,
        category: 'education',
        description: `Ask ${label}`,
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide a question or topic.\nExample: ${prefix}${command} what is 2+2`);
            }
            await react(sock, m, '📚');
            try {
                const data = await apiGet(endpoint, { [param]: text }, { timeout: 60000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const output = prettyResult(unwrap(data));
                await reply(`📚 *${label}*\n\n${clip(output || 'No result.', 3500)}`);
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
        command: 'dictionary',
        aliases: ['define', 'meaning'],
        category: 'education',
        description: 'Get a word definition',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide a word.\nExample: ${prefix}dictionary cat`);
            }
            await react(sock, m, '📖');
            try {
                const data = await apiGet('/education/dictionary', { q: text.trim() }, { timeout: 60000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }

                const result = unwrap(data);
                if (!result || typeof result !== 'object') {
                    await react(sock, m, '❌');
                    return reply('⚠️ No definition found.');
                }

                const lines = [`📖 *${result.word || text}*`];
                const phonetic = result.phonetics?.find(item => item.text)?.text;
                if (phonetic) lines.push(`🔊 ${phonetic}`);

                for (const meaning of (result.meanings || []).slice(0, 3)) {
                    lines.push(`\n*${meaning.partOfSpeech || 'meaning'}*`);
                    for (const definition of (meaning.definitions || []).slice(0, 3)) {
                        lines.push(`• ${definition.definition}`);
                    }
                }

                await reply(clip(lines.join('\n'), 3500));
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    askCommand({ command: 'maths', aliases: ['math'], endpoint: '/education/maths', label: 'Maths AI' }),
    askCommand({ command: 'physics', endpoint: '/education/physics', label: 'Physics AI' }),
    askCommand({ command: 'chemistry', aliases: ['chem'], endpoint: '/education/chemistry', label: 'Chemistry AI' }),
    askCommand({ command: 'fruit', endpoint: '/education/fruit', label: 'Fruit Science' }),
    askCommand({ command: 'grammar', aliases: ['grammarcheck'], endpoint: '/grammarcheck', label: 'Grammar Check' }),
    askCommand({ command: 'booksearch', aliases: ['findbook'], endpoint: '/education/booksearch', label: 'Book Search' }),
    askCommand({ command: 'book', aliases: ['bookid'], endpoint: '/education/bookid', label: 'Book Content' }),
    {
        command: 'poem',
        aliases: ['randompoem'],
        category: 'education',
        description: 'Get a random poem',
        execute: async (sock, m, { reply }) => {
            await react(sock, m, '📜');
            try {
                const data = await apiGet('/education/randompoem', {}, { timeout: 45000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const result = unwrap(data);
                const body = result && Array.isArray(result.lines)
                    ? [
                        result.title ? `*${result.title}*` : '',
                        result.author ? `by ${result.author}` : '',
                        '',
                        result.lines.join('\n')
                    ].filter(line => line !== '').join('\n')
                    : prettyResult(result);
                await reply(`📜 *Random Poem*\n\n${clip(body, 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    }
];
