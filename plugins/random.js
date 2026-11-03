const {
    apiGet,
    apiError,
    clip,
    errorText,
    findMediaUrl,
    react,
    unwrap
} = require('../library/apiHelper');

module.exports = [
    {
        command: 'randomvid',
        aliases: ['rvideo'],
        category: 'random',
        description: 'Get a random video',
        execute: async (sock, m, { reply }) => {
            await react(sock, m, '🎲');
            try {
                const data = await apiGet('/random/randomvideo', {}, { timeout: 90000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const videoUrl = findMediaUrl(data);
                if (!videoUrl) {
                    await react(sock, m, '❌');
                    return reply('🚫 No random video found.');
                }
                await sock.sendMessage(m.chat, {
                    video: { url: videoUrl },
                    mimetype: 'video/mp4',
                    fileName: 'random.mp4',
                    caption: '🎲 *Random Video*\n\n> Powered by Keith APIs'
                }, { quoted: m });
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'randomncs',
        aliases: ['rncs'],
        category: 'random',
        description: 'Get a random NCS track',
        execute: async (sock, m, { reply }) => {
            await react(sock, m, '🎵');
            try {
                const data = await apiGet('/random/ncs', {}, { timeout: 90000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const audioUrl = findMediaUrl(data);
                if (!audioUrl) {
                    await react(sock, m, '❌');
                    return reply('🚫 No random track found.');
                }
                await sock.sendMessage(m.chat, {
                    audio: { url: audioUrl },
                    mimetype: 'audio/mpeg',
                    fileName: 'random-ncs.mp3'
                }, { quoted: m });
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'randombible',
        aliases: ['rbible'],
        category: 'random',
        description: 'Get a random Bible verse',
        execute: async (sock, m, { reply }) => {
            await react(sock, m, '📖');
            try {
                const data = await apiGet('/random/bible', {}, { timeout: 45000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const result = unwrap(data);
                const verse = result?.verse || {};
                const reference = `${verse.book || ''} ${verse.chapter || ''}:${verse.verse || ''}`.trim();
                const text = verse.text || JSON.stringify(result);
                await reply(`📖 *${clip(reference || 'Random Verse', 100)}*\n\n${clip(text, 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'inspirobot',
        aliases: ['inspire'],
        category: 'random',
        description: 'Get a random inspirational image',
        execute: async (sock, m, { reply }) => {
            await react(sock, m, '💡');
            try {
                const data = await apiGet('/random/inspirobot', {}, { timeout: 45000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const imageUrl = findMediaUrl(data);
                if (!imageUrl) {
                    await react(sock, m, '❌');
                    return reply('🚫 No inspirational image found.');
                }
                await sock.sendMessage(m.chat, {
                    image: { url: imageUrl },
                    caption: '💡 *InspiroBot*\n\n> Powered by Keith APIs'
                }, { quoted: m });
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    }
];
