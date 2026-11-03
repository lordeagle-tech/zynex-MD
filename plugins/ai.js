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

function formatResult(result) {
    if (result == null) return '';
    if (typeof result === 'string') return result;
    if (typeof result === 'number' || typeof result === 'boolean') return String(result);
    if (Array.isArray(result)) {
        return result.map((item, index) => {
            if (typeof item === 'string') return `${index + 1}. ${item}`;
            return `${index + 1}. ${formatResult(item)}`;
        }).join('\n');
    }
    if (typeof result === 'object') {
        for (const key of ['answer', 'response', 'text', 'message', 'content', 'lyrics']) {
            if (typeof result[key] === 'string') return result[key];
        }
        return JSON.stringify(result, null, 2);
    }
    return String(result);
}

function aiCommand({ command, aliases = [], endpoint, label, param = 'q', timeout = 60000 }) {
    return {
        command,
        aliases,
        category: 'ai',
        description: `Ask ${label}`,
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide a prompt.\nExample: ${prefix}${command} hello`);
            }

            await react(sock, m, '🤖');
            try {
                const data = await apiGet(endpoint, { [param]: text }, { timeout });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }

                const output = formatResult(unwrap(data));
                if (!output) {
                    await react(sock, m, '❌');
                    return reply('🚫 The AI returned an empty response.');
                }

                await reply(`🤖 *${label}*\n\n${clip(output, 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    };
}

module.exports = [
    aiCommand({ command: 'gpt', aliases: ['ai', 'keithai'], endpoint: '/ai/gpt', label: 'GPT' }),
    aiCommand({ command: 'claude', aliases: ['claudeai'], endpoint: '/ai/claudeai', label: 'Claude' }),
    aiCommand({ command: 'gemini', endpoint: '/ai/gemini', label: 'Gemini' }),
    aiCommand({ command: 'deepseek', aliases: ['deepseekr'], endpoint: '/ai/deepseek', label: 'DeepSeek' }),
    aiCommand({ command: 'grok', aliases: ['grokai'], endpoint: '/ai/grok', label: 'Grok' }),
    aiCommand({ command: 'copilot', endpoint: '/ai/copilot', label: 'Copilot' }),
    aiCommand({ command: 'mistral', endpoint: '/ai/mistral', label: 'Mistral' }),
    aiCommand({ command: 'perplexity', endpoint: '/ai/perplexity', label: 'Perplexity' }),
    aiCommand({ command: 'llama', aliases: ['ilama'], endpoint: '/ai/ilama', label: 'Llama' }),
    aiCommand({ command: 'blackbox', endpoint: '/ai/blackbox', label: 'Blackbox' }),
    aiCommand({ command: 'metaai', aliases: ['metai'], endpoint: '/ai/metai', label: 'Meta AI' }),
    aiCommand({ command: 'qwen', aliases: ['qwenai'], endpoint: '/ai/qwenai', label: 'Qwen' }),
    aiCommand({ command: 'bard', aliases: ['bardai'], endpoint: '/ai/bard', label: 'Bard' }),
    aiCommand({ command: 'o3', endpoint: '/ai/o3', label: 'o3' }),
    aiCommand({ command: 'chatgpt4', aliases: ['gpt4'], endpoint: '/ai/chatgpt4', label: 'ChatGPT-4' }),
    aiCommand({ command: 'venice', aliases: ['veniceai'], endpoint: '/ai/venice', label: 'Venice AI' }),
    aiCommand({ command: 'dream', aliases: ['dreamanalyzer'], endpoint: '/ai/dreamanalyzer', label: 'Dream Analyzer' }),
    aiCommand({ command: 'codeexplain', aliases: ['whatcode'], endpoint: '/whatdoesthiscodedo', label: 'Code Explainer', param: 'code' }),
    aiCommand({ command: 'transcribe', aliases: ['stt'], endpoint: '/ai/transcribe', label: 'Speech to Text' }),
    {
        command: 'vision',
        aliases: ['imgai'],
        category: 'ai',
        description: 'Ask AI about an image URL',
        execute: async (sock, m, { text, prefix, reply }) => {
            const parts = String(text || '').trim().split(/\s+/);
            const imageUrl = parts.find(part => isUrl(part));
            if (!imageUrl) {
                return reply(`❌ Provide an image URL.\nExample: ${prefix}vision https://example.com/image.jpg what is this`);
            }
            const question = parts.filter(part => part !== imageUrl).join(' ') || 'Describe this image.';

            await react(sock, m, '👁️');
            try {
                const data = await apiGet('/ai/vision', { image: imageUrl, q: question }, { timeout: 90000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const output = formatResult(unwrap(data));
                await reply(`👁️ *Vision AI*\n\n${clip(output, 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'imagine',
        aliases: ['text2img', 'txt2img'],
        category: 'ai',
        description: 'Generate an image from text',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Describe the image you want.\nExample: ${prefix}imagine a cat astronaut`);
            }

            await react(sock, m, '🎨');
            try {
                const data = await apiGet('/ai/text2img', { q: text }, { timeout: 120000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const imageUrl = findMediaUrl(data);
                if (!imageUrl) {
                    await react(sock, m, '❌');
                    return reply('🚫 No image was generated.');
                }
                await sock.sendMessage(m.chat, {
                    image: { url: imageUrl },
                    caption: `🎨 *Generated Image*\n\n${clip(text, 500)}\n\n> Powered by Keith APIs`
                }, { quoted: m });
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'tts',
        aliases: ['text2speech'],
        category: 'ai',
        description: 'Convert text to speech',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide text to speak.\nExample: ${prefix}tts hello world`);
            }

            await react(sock, m, '🔊');
            try {
                const data = await apiGet('/ai/tts', { q: text }, { timeout: 90000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const audioUrl = findMediaUrl(data);
                if (!audioUrl) {
                    await react(sock, m, '❌');
                    return reply('🚫 No audio was generated.');
                }
                await sock.sendMessage(m.chat, {
                    audio: { url: audioUrl },
                    mimetype: 'audio/mpeg',
                    fileName: 'tts.mp3'
                }, { quoted: m });
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'shazam',
        aliases: ['findsong'],
        category: 'ai',
        description: 'Identify a song from an audio URL',
        execute: async (sock, m, { text, prefix, reply }) => {
            const audioUrl = String(text || '').trim().split(/\s+/).find(isUrl);
            if (!audioUrl) {
                return reply(`❌ Provide an audio URL.\nExample: ${prefix}shazam https://example.com/song.mp3`);
            }

            await react(sock, m, '🎧');
            try {
                const data = await apiGet('/ai/shazam', { url: audioUrl }, { timeout: 90000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const result = unwrap(data);
                const output = typeof result === 'object'
                    ? clip(JSON.stringify(result, null, 2), 3500)
                    : clip(formatResult(result), 3500);
                await reply(`🎧 *Song Found*\n\n${output}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'text2music',
        aliases: ['txt2music'],
        category: 'ai',
        description: 'Generate music from text',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Describe the music.\nExample: ${prefix}text2music calm piano`);
            }
            await react(sock, m, '🎵');
            try {
                const data = await apiGet('/ai/txt2music', { q: text }, { timeout: 120000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const audioUrl = findMediaUrl(data);
                if (!audioUrl) {
                    await react(sock, m, '❌');
                    return reply('🚫 No music was generated.');
                }
                await sock.sendMessage(m.chat, {
                    audio: { url: audioUrl },
                    mimetype: 'audio/mpeg',
                    fileName: 'music.mp3'
                }, { quoted: m });
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'text2video',
        aliases: ['txt2video'],
        category: 'ai',
        description: 'Generate a video from text',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Describe the video.\nExample: ${prefix}text2video a cat surfing`);
            }
            await react(sock, m, '🎬');
            try {
                const data = await apiGet('/ai/txt2video2', { q: text }, { timeout: 180000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                const videoUrl = findMediaUrl(data);
                if (!videoUrl) {
                    await react(sock, m, '❌');
                    return reply('🚫 No video was generated.');
                }
                await sock.sendMessage(m.chat, {
                    video: { url: videoUrl },
                    mimetype: 'video/mp4',
                    fileName: 'generated.mp4',
                    caption: `🎬 ${clip(text, 300)}\n\n> Powered by Keith APIs`
                }, { quoted: m });
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'lyricsgen',
        aliases: ['makelyrics'],
        category: 'ai',
        description: 'Generate song lyrics',
        execute: async (sock, m, { text, prefix, reply }) => {
            const topic = String(text || '').trim();
            if (!topic) {
                return reply(`❌ Provide a topic.\nExample: ${prefix}lyricsgen heartbreak`);
            }
            await react(sock, m, '✍️');
            try {
                const data = await apiGet('/ai/lyricsgen', {
                    topic,
                    genre: 'pop',
                    mood: 'emotional',
                    structure: 'verse_chorus_bridge',
                    language: 'en'
                }, { timeout: 90000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                await reply(`🎵 *Lyrics: ${clip(topic, 100)}*\n\n${clip(formatResult(unwrap(data)), 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'speechwriter',
        aliases: ['writespeech'],
        category: 'ai',
        description: 'Write a speech',
        execute: async (sock, m, { text, prefix, reply }) => {
            const topic = String(text || '').trim();
            if (!topic) {
                return reply(`❌ Provide a topic.\nExample: ${prefix}speechwriter how to pass exams`);
            }
            await react(sock, m, '✍️');
            try {
                const data = await apiGet('/ai/speechwriter', {
                    topic,
                    length: 'short',
                    type: 'speech',
                    tone: 'serious'
                }, { timeout: 90000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }
                await reply(`📝 *Speech: ${clip(topic, 100)}*\n\n${clip(formatResult(unwrap(data)), 3500)}`);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    }
];
