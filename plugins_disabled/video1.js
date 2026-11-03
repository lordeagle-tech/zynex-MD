const axios = require('axios');
const yts = require('yt-search');

module.exports = {
    command: 'video',
    description: 'Download YouTube videos in HD quality',
    category: 'downloader',
    execute: async (sock, m, {
        args,
        text,
        q,
        quoted,
        mime,
        qmsg,
        isMedia,
        groupMetadata,
        groupName,
        participants,
        groupOwner,
        groupAdmins,
        isBotAdmins,
        isAdmins,
        isGroupOwner,
        isCreator,
        prefix,
        reply,
        config,
        sender
    }) => {
        try {
            if (!text) {
                return await reply(`🎬 *Queen Aria Video Downloader*\n\n❌ Please provide a video name or YouTube URL!\n📝 Example: ${prefix}video funny cats compilation\n🔗 Or send a YouTube link directly\n\n⚡ Powered by Hector Manuel's API`);
            }

            // Initial reaction
            await sock.sendMessage(m.chat, { 
                react: { text: "🔍", key: m.key } 
            });

            let processingMsg = await sock.sendMessage(m.chat, { 
                text: `🎬 *Searching YouTube...*\n\n🔍 Query: "${text}"\n⏳ Please wait while I find your video...` 
            }, { quoted: m });

            let videoUrl = '';
            let videoData = null;

            // Check if input is URL or search query
            if (text.startsWith('http://') || text.startsWith('https://')) {
                videoUrl = text;
            } else {
                const { videos } = await yts(text);
                if (!videos || videos.length === 0) {
                    await sock.sendMessage(m.chat, { 
                        react: { text: "😔", key: m.key } 
                    });
                    await sock.sendMessage(m.chat, { 
                        text: "❌ *No Results Found*\n\nI couldn't find any videos matching your search.\n💡 Try different keywords or check the spelling!" 
                    }, { quoted: m });
                    return;
                }
                videoUrl = videos[0].url;
                videoData = videos[0];
            }

            // Validate URL
            const ytRegex = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/|playlist\?list=)?)([a-zA-Z0-9_-]{11})/gi;
            if (!ytRegex.test(videoUrl)) {
                await sock.sendMessage(m.chat, { 
                    react: { text: "🚫", key: m.key } 
                });
                return await reply("❌ *Invalid YouTube Link*\n\nPlease provide a valid YouTube URL or search term.");
            }

            // Update to downloading
            await sock.sendMessage(m.chat, { 
                react: { text: "⬇️", key: m.key } 
            });
            await sock.sendMessage(m.chat, { 
                text: `✅ *Video Found!*\n\n⬇️ Starting download process...\n⚡ Using Hector Manuel's API\n🎥 Preparing 360p quality` ,
                edit: processingMsg.key
            });

            // Fetch video data
            const apiUrl = `https://yt-dl.officialhectormanuel.workers.dev/?url=${encodeURIComponent(videoUrl)}`;
            const response = await axios.get(apiUrl, { 
                headers: { 'Accept': 'application/json' },
                timeout: 30000
            });

            if (response.status !== 200 || !response.data.status) {
                await sock.sendMessage(m.chat, { 
                    react: { text: "😢", key: m.key } 
                });
                return await reply("🚫 *Download Failed*\n\nThe video service is currently unavailable.\n⚡ Please try again in a few minutes.");
            }

            const data = response.data;
            const title = data.title || (videoData?.title || 'YouTube Video');
            const thumbnail = data.thumbnail || (videoData?.thumbnail || '');
            const videoDownloadUrl = data.videos["360"];
            const filename = `🎬 ${title.substring(0, 50)}.mp4`.replace(/[<>:"/\\|?*]/g, '');

            // Send preview with details
            await sock.sendMessage(m.chat, {
                image: { url: thumbnail },
                caption: `🎬 *Video Details*\n\n📀 Title: ${title}\n🎥 Quality: 360p HD\n📊 Status: Downloading...\n\n👑 *Queen Aria Video Service*`
            }, { quoted: m });

            // Send the video
            await sock.sendMessage(m.chat, {
                video: { url: videoDownloadUrl },
                mimetype: 'video/mp4',
                fileName: filename,
                caption: `🎬 *Download Complete!*\n\n📀 ${title}\n🎥 Quality: 360p HD\n✅ Successfully downloaded\n\n👑 Powered by Queen Aria\n⚡ Hector Manuel's API`,
                contextInfo: {
                    externalAdReply: {
                        title: "🎬 Queen Aria Video",
                        body: "Click for more downloads!",
                        mediaType: 2,
                        thumbnailUrl: thumbnail,
                        sourceUrl: config.channel
                    }
                }
            }, { quoted: m });

            // Final success reaction
            await sock.sendMessage(m.chat, { 
                react: { text: "✅", key: m.key } 
            });

        } catch (error) {
            console.error('Error in video command:', error);
            await sock.sendMessage(m.chat, { 
                react: { text: "💥", key: m.key } 
            });
            await reply("💥 *Download Error*\n\n❌ Something went wrong during the download process.\n🔧 Please try again with a different video or check your connection.");
        }
    }
};