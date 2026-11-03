
// 漏 2025 Debraj. All Rights Reserved.
// respect the work, don鈥檛 just copy-paste.

const fs = require('fs')

const config = {
    owner: "254717459770",
    botNumber: "254717459770",
    setPair: "K0MRAID1",
    thumbUrl: "https://i.ibb.co/NgsYSg3f/212c6c45769c.jpg",
    channel: "https://whatsapp.com/channel/0029Vb8LcTLKWEKo4JlMb51I",
    session: "sessions",
    sessionId: process.env.SESSION_ID || "",
    sessionUrl: process.env.SESSION_URL || "https://session.lordeagle.tech",
    sessionUrlFallbacks: ["https://www.eaglegnick.tech"],
    sessionPrefix: process.env.SESSION_PREFIX || "Zynex~",
    status: {
        public: true,
        terminal: true,
        reactsw: false
    },
    message: {
        owner: "no, this is for owners only",
        group: "this is for groups only",
        admin: "this command is for admin only",
        private: "this is specifically for private chat"
    },
    mess: {
        owner: 'This command is only for the bot owner!',
        done: 'Mode changed successfully!',
        error: 'Something went wrong!',
        wait: 'Please wait...'
    },
    settings: {
        title: "Zynex Bot",
        packname: 'ZYNE-X',
        description: "Zynex Bot - Multi Device WhatsApp Bot",
        author: 'https://github.com/lordeagle-tech',
        footer: "Zynex Bot"
    },
    api: {
        baseurl: "https://apis.keithsite.lol/",
        apikey: ""
    },
    sticker: {
        packname: "ZyNex Bot",
        author: "Lordeagle-tech"
    }
}

module.exports = config;

let file = require.resolve(__filename)
require('fs').watchFile(file, () => {
  require('fs').unwatchFile(file)
  console.log('\x1b[0;32m'+__filename+' \x1b[1;32mupdated!\x1b[0m')
  delete require.cache[file]
  require(file)
})
