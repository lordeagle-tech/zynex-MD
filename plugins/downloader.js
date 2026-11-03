const yts = require('yt-search');
const {
    apiGet,
    apiError,
    errorText,
    findMediaUrl,
    isUrl,
    react,
    safeName
} = require('../library/apiHelper');

function detectKind(url, kind = 'auto') {
    if (kind && kind !== 'auto') return kind;
    if (/\.(mp3|m4a|wav|ogg|opus|aac)(\?|$)/i.test(url)) return 'audio';
    if (/\.(mp4|mkv|webm|mov)(\?|$)/i.test(url)) return 'video';
    if (/\.(jpe?g|png|gif|webp)(\?|$)/i.test(url)) return 'image';
    return 'document';
}

async function sendMedia(sock, m, url, kind, title, fallbackName) {
    const name = safeName(title, fallbackName);
    const type = detectKind(url, kind);
    const caption = `✅ *${title || safeName(fallbackName)}*\n\n> Powered by Keith APIs`;

    if (type === 'audio') {
        return sock.sendMessage(m.chat, {
            audio: { url },
            mimetype: 'audio/mpeg',
            fileName: `${name}.mp3`
        }, { quoted: m });
    }
    if (type === 'image') {
        return sock.sendMessage(m.chat, {
            image: { url },
            caption
        }, { quoted: m });
    }
    if (type === 'video') {
        return sock.sendMessage(m.chat, {
            video: { url },
            mimetype: 'video/mp4',
            fileName: `${name}.mp4`,
            caption
        }, { quoted: m });
    }
    return sock.sendMessage(m.chat, {
        document: { url },
        mimetype: 'application/octet-stream',
        fileName: name,
        caption
    }, { quoted: m });
}

function urlDownloader({ command, aliases = [], endpoint, label, kind = 'auto', timeout = 90000 }) {
    return {
        command,
        aliases,
        category: 'downloader',
        description: `Download media from ${label}`,
        execute: async (sock, m, { text, prefix, reply }) => {
            const input = String(text || '').trim().split(/\s+/)[0];
            if (!input) {
                return reply(`❌ Send a ${label} link.\nExample: ${prefix}${command} https://...`);
            }
            if (!isUrl(input)) {
                return reply(`🚫 Please send a valid ${label} URL.`);
            }

            await react(sock, m, '⬇️');
            try {
                const data = await apiGet(endpoint, { url: input }, { timeout });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }

                const mediaUrl = findMediaUrl(data);
                if (!mediaUrl) {
                    await react(sock, m, '❌');
                    return reply(`🚫 No downloadable media found for that ${label} link.`);
                }

                const title = data?.result?.title || data?.title || data?.result?.heading || label;
                await sendMedia(sock, m, mediaUrl, kind, title, command);
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    };
}

async function searchYouTube(input) {
    const { videos } = await yts(input);
    if (!videos || !videos.length) return null;
    return videos[0];
}

module.exports = [
    {
        command: 'play',
        aliases: ['song', 'mp3', 'yta'],
        category: 'downloader',
        description: 'Download songs from YouTube',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Please provide a song name!\nExample: ${prefix}play Alan Walker Faded`);
            }

            await react(sock, m, '🔍');
            try {
                const video = await searchYouTube(text);
                if (!video) {
                    await react(sock, m, '❌');
                    return reply('⚠️ No results found for your query!');
                }

                await react(sock, m, '⬇️');
                await sock.sendMessage(m.chat, {
                    image: { url: video.thumbnail },
                    caption: `🎵 *${video.title}*\n\n⬇️ Downloading audio...`
                }, { quoted: m });

                const data = await apiGet('/download/audio', { url: video.url }, { timeout: 90000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }

                const mediaUrl = findMediaUrl(data);
                if (!mediaUrl) {
                    await react(sock, m, '❌');
                    return reply('🚫 Download failed. Try again later.');
                }

                await sendMedia(sock, m, mediaUrl, 'audio', video.title, 'audio');
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    {
        command: 'video',
        aliases: ['ytmp4', 'ytv'],
        category: 'downloader',
        description: 'Download videos from YouTube',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Please provide a video name or YouTube link!\nExample: ${prefix}video funny cats`);
            }

            await react(sock, m, '⏳');
            try {
                let videoUrl = '';
                let videoTitle = '';
                let videoThumbnail = '';

                if (isUrl(text)) {
                    videoUrl = text.trim();
                    const info = await yts(videoUrl).catch(() => null);
                    const first = info?.videos?.[0];
                    if (first) {
                        videoTitle = first.title;
                        videoThumbnail = first.thumbnail;
                    }
                } else {
                    const video = await searchYouTube(text);
                    if (!video) {
                        await react(sock, m, '❌');
                        return reply('⚠️ No videos found for your search!');
                    }
                    videoUrl = video.url;
                    videoTitle = video.title;
                    videoThumbnail = video.thumbnail;
                }

                const ytRegex = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/|playlist\?list=)?)([a-zA-Z0-9_-]{11})/i;
                if (!ytRegex.test(videoUrl)) {
                    await react(sock, m, '❌');
                    return reply('🚫 Invalid YouTube link provided!');
                }

                await react(sock, m, '⬇️');
                const data = await apiGet('/download/video', { url: videoUrl }, { timeout: 120000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }

                const mediaUrl = findMediaUrl(data);
                if (!mediaUrl) {
                    await react(sock, m, '❌');
                    return reply('🚫 Failed to fetch video from API. Try again later.');
                }

                const title = videoTitle || 'YouTube Video';
                const previewText = `🎬 *${title}*\n\n⬇️ Downloading video...\n🎥 Quality: 720p\n\n> Powered by Keith APIs`;
                if (videoThumbnail) {
                    await sock.sendMessage(m.chat, {
                        image: { url: videoThumbnail },
                        caption: previewText
                    }, { quoted: m });
                } else {
                    await sock.sendMessage(m.chat, { text: previewText }, { quoted: m });
                }

                await sendMedia(sock, m, mediaUrl, 'video', title, 'video');
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    urlDownloader({
        command: 'tiktok',
        aliases: ['tt'],
        endpoint: '/download/tiktokdl3',
        label: 'TikTok',
        kind: 'video'
    }),
    urlDownloader({
        command: 'instagram',
        aliases: ['igdl', 'insta'],
        endpoint: '/download/instadl',
        label: 'Instagram',
        kind: 'video'
    }),
    urlDownloader({
        command: 'facebook',
        aliases: ['fbdl', 'fb'],
        endpoint: '/download/fbdown',
        label: 'Facebook',
        kind: 'video'
    }),
    urlDownloader({
        command: 'twitter',
        aliases: ['xdl', 'xdown'],
        endpoint: '/download/twitter',
        label: 'Twitter/X',
        kind: 'video'
    }),
    urlDownloader({
        command: 'spotify',
        aliases: ['spot'],
        endpoint: '/download/spotify',
        label: 'Spotify',
        kind: 'audio'
    }),
    {
        command: 'soundcloud',
        aliases: ['scdl'],
        category: 'downloader',
        description: 'Download audio from SoundCloud',
        execute: async (sock, m, { text, prefix, reply }) => {
            const input = String(text || '').trim().split(/\s+/)[0];
            if (!input) {
                return reply(`❌ Send a SoundCloud link.\nExample: ${prefix}soundcloud https://soundcloud.com/...`);
            }
            if (!isUrl(input)) {
                return reply('🚫 Please send a valid SoundCloud URL.');
            }

            await react(sock, m, '⬇️');
            try {
                const data = await apiGet('/download/soundcloud', { url: input }, { timeout: 90000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }

                const result = data.result || data;
                const mediaUrl = result?.download || result?.stream;
                if (!mediaUrl) {
                    await react(sock, m, '❌');
                    return reply('🚫 SoundCloud audio is not available for that track.');
                }

                await sendMedia(sock, m, mediaUrl, 'audio', result.title || 'SoundCloud', 'soundcloud');
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    },
    urlDownloader({
        command: 'pinterest',
        aliases: ['pin'],
        endpoint: '/download/pinterest',
        label: 'Pinterest',
        kind: 'auto'
    }),
    urlDownloader({
        command: 'capcut',
        aliases: ['ccdl'],
        endpoint: '/download/capcut',
        label: 'CapCut',
        kind: 'video'
    }),
    urlDownloader({
        command: 'applemusic',
        aliases: ['apple'],
        endpoint: '/download/apple',
        label: 'Apple Music',
        kind: 'audio'
    }),
    urlDownloader({
        command: 'mediafire',
        aliases: ['mfire'],
        endpoint: '/download/mfire',
        label: 'MediaFire',
        kind: 'document'
    }),
    urlDownloader({
        command: 'telegram',
        aliases: ['tgdl'],
        endpoint: '/download/telegram',
        label: 'Telegram',
        kind: 'auto'
    }),
    {
        command: 'apk',
        aliases: ['apkdl'],
        category: 'downloader',
        description: 'Search and download APKs',
        execute: async (sock, m, { text, prefix, reply }) => {
            if (!text) {
                return reply(`❌ Provide an app name.\nExample: ${prefix}apk xender`);
            }

            await react(sock, m, '🔍');
            try {
                const searchData = await apiGet('/search/apk', { q: text }, { timeout: 60000 });
                const searchError = apiError(searchData);
                if (searchError) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${searchError}`);
                }

                const results = Array.isArray(searchData.result) ? searchData.result : [];
                const first = results[0];
                if (!first || !first.link) {
                    await react(sock, m, '❌');
                    return reply('⚠️ No APK results found.');
                }

                await react(sock, m, '⬇️');
                const data = await apiGet('/download/apk', { url: first.link }, { timeout: 120000 });
                const err = apiError(data);
                if (err) {
                    await react(sock, m, '❌');
                    return reply(`🚫 ${err}`);
                }

                const mediaUrl = findMediaUrl(data);
                if (!mediaUrl) {
                    await react(sock, m, '❌');
                    return reply('🚫 APK download link not found.');
                }

                const title = first.title || text;
                await sock.sendMessage(m.chat, {
                    document: { url: mediaUrl },
                    mimetype: 'application/vnd.android.package-archive',
                    fileName: `${safeName(title, 'app')}.apk`,
                    caption: `📦 *${title}*\n👤 ${first.developer || 'Unknown'}\n\n> Powered by Keith APIs`
                }, { quoted: m });
                await react(sock, m, '✅');
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ ${errorText(err)}`);
            }
        }
    }
];
