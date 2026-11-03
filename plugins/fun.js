const {
    apiGet,
    apiError,
    clip,
    errorText,
    findMediaUrl,
    react,
    unwrap
} = require('../library/apiHelper');

function decodeEntities(value) {
    return String(value == null ? '' : value)
        .replace(/&#0?39;|&#x27;|&apos;/gi, "'")
        .replace(/&quot;/gi, '"')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&eacute;/gi, 'é');
}

function funText(result) {
    if (result == null) return '';
    if (typeof result === 'string') return decodeEntities(result);
    if (typeof result === 'number' || typeof result === 'boolean') return String(result);
    if (Array.isArray(result)) {
        return result.map((item, i) => `${i + 1}. ${funText(item)}`).join('\n');
    }
    if (typeof result === 'object') {
        if (result.question) {
            const answers = Array.isArray(result.allAnswers)
                ? result.allAnswers
                : [result.correctAnswer, ...(result.incorrectAnswers || [])].filter(Boolean);
            const options = answers.map((answer, i) => `${String.fromCharCode(65 + i)}. ${decodeEntities(answer)}`).join('\n');
            return `❓ ${decodeEntities(result.question)}\n\n${options}`;
        }
        if (result.setup || result.punchline) {
            return `${decodeEntities(result.setup || '')}\n\n😂 ${decodeEntities(result.punchline || '')}`;
        }
        if (result.quote) {
            return `“${decodeEntities(result.quote)}”${result.author ? `\n\n— ${decodeEntities(result.author)}` : ''}`;
        }
        for (const key of ['text', 'title', 'message', 'result']) {
            if (typeof result[key] === 'string') return decodeEntities(result[key]);
        }
        return Object.entries(result)
            .filter(([, value]) => value != null && typeof value !== 'object')
            .slice(0, 8)
            .map(([key, value]) => `${key}: ${decodeEntities(value)}`)
            .join('\n');
    }
    return String(result);
}

function funCommand({ command, aliases = [], endpoint, label, emoji = '🎲' }) {
    return {
        command,
        aliases,
        category: 'fun',
        description: `Get a random ${label}`,
        execute: async (sock, m, { reply }) => {
            await react(sock, m, emoji);
            try {
                const data = await apiGet(endpoint, {}, { timeout: 45000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const output = funText(unwrap(data));
                await reply(`${emoji} *${label}*\n\n${clip(output || 'No result.', 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    };
}

module.exports = [
    funCommand({ command: 'truth', endpoint: '/fun/truth', label: 'Truth', emoji: '💬' }),
    funCommand({ command: 'dare', endpoint: '/fun/dare', label: 'Dare', emoji: '🔥' }),
    funCommand({ command: 'wyr', aliases: ['wouldyourather'], endpoint: '/fun/would-you-rather', label: 'Would You Rather', emoji: '🤔' }),
    funCommand({ command: 'paranoia', endpoint: '/fun/paranoia', label: 'Paranoia', emoji: '👀' }),
    funCommand({ command: 'pickupline', aliases: ['pickup'], endpoint: '/fun/pickuplines', label: 'Pickup Line', emoji: '💘' }),
    funCommand({ command: 'fact', endpoint: '/fun/fact', label: 'Fact', emoji: '💡' }),
    funCommand({ command: 'insult', endpoint: '/fun/insult', label: 'Insult', emoji: '😈' }),
    funCommand({ command: 'joke', aliases: ['jokes'], endpoint: '/fun/jokes', label: 'Joke', emoji: '😂' }),
    funCommand({ command: 'question', aliases: ['quiz'], endpoint: '/fun/question', label: 'Question', emoji: '❓' }),
    funCommand({ command: 'quote', endpoint: '/fun/quote', label: 'Quote', emoji: '📜' }),
    funCommand({ command: 'neverhaveiever', aliases: ['nhie'], endpoint: '/fun/never-have-i-ever', label: 'Never Have I Ever', emoji: '🍻' }),
    {
        command: 'meme',
        category: 'fun',
        description: 'Get a random meme',
        execute: async (sock, m, { reply }) => {
            await react(sock, m, '😂');
            try {
                const data = await apiGet('/fun/meme', {}, { timeout: 45000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const result = unwrap(data);
                const mediaUrl = result?.url || findMediaUrl(result);
                if (!mediaUrl) {
                    await react(sock, m, '❌');
                    return reply('🚫 No meme found.');
                }
                const caption = `😂 *${decodeEntities(result.title || 'Random Meme')}*\n👤 ${result.author || 'Unknown'} | ⬆️ ${result.ups || 0}\n\n> Powered by Keith APIs`;
                try {
                    if (/\.gif(\?|$)/i.test(mediaUrl)) {
                        await sock.sendMessage(m.chat, {
                            video: { url: mediaUrl },
                            gifPlayback: true,
                            caption
                        }, { quoted: m });
                    } else {
                        await sock.sendMessage(m.chat, {
                            image: { url: mediaUrl },
                            caption
                        }, { quoted: m });
                    }
                } catch {
                    await reply(`😂 ${result.title || 'Random Meme'}\n\n${mediaUrl}`);
                }
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'quoteaudio',
        aliases: ['qaudio'],
        category: 'fun',
        description: 'Get a random quote with audio',
        execute: async (sock, m, { reply }) => {
            await react(sock, m, '🔊');
            try {
                const data = await apiGet('/quote/audio', {}, { timeout: 60000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const result = unwrap(data);
                const audioUrl = result?.mp3 || findMediaUrl(result);
                const quotes = Array.isArray(result?.data)
                    ? result.data.filter(item => item.type === 'quote' && item.text).map(item => item.text)
                    : [];
                const caption = quotes.length ? quotes.join('\n\n') : 'Random quote';

                if (!audioUrl) {
                    await react(sock, m, '❌');
                    return reply(`📜 *Quote*\n\n${clip(caption, 3500)}`);
                }

                await sock.sendMessage(m.chat, {
                    audio: { url: audioUrl },
                    mimetype: 'audio/mpeg',
                    fileName: 'quote.mp3'
                }, { quoted: m });
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    }
];
