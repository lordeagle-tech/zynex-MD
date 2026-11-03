console.clear();
const config = () => require('./settings/config');
const { getPrefix } = require('./library/prefix');
const { getFeature } = require('./library/features');
process.on("uncaughtException", console.error);

let makeWASocket, Browsers, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidDecode, downloadContentFromMessage, jidNormalizedUser, isPnUser;

const loadBaileys = async () => {
  const baileys = await import('@lordeagle21/baileys');
  
  makeWASocket = baileys.default;
  Browsers = baileys.Browsers;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  DisconnectReason = baileys.DisconnectReason;
  fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
  jidDecode = baileys.jidDecode;
  downloadContentFromMessage = baileys.downloadContentFromMessage;
  jidNormalizedUser = baileys.jidNormalizedUser;
  isPnUser = baileys.isPnUser;
};

const pino = require('pino');
const FileType = require('file-type');
const readline = require("readline");
const fs = require('fs');
const chalk = require("chalk");
const path = require("path");
const zlib = require('zlib');

const { getBuffer } = require('./library/function');
const { smsg } = require('./library/serialize');
const { videoToWebp, writeExifImg, writeExifVid, addExif, toPTT, toAudio } = require('./library/exif');
const listcolor = ['cyan', 'magenta', 'green', 'yellow', 'blue'];
const randomcolor = listcolor[Math.floor(Math.random() * listcolor.length)];

const question = (text) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        rl.question(chalk.yellow(text), (answer) => {
            resolve(answer);
            rl.close();
        });
    });
};

function unwrapMessage(message, depth = 0) {
    if (!message || depth > 5) return message;
    const keys = Object.keys(message);
    if (keys.length !== 1) return message;
    const key = keys[0];
    if (['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage', 'deviceSentMessage'].includes(key)) {
        const inner = message[key]?.message;
        if (inner) return unwrapMessage(inner, depth + 1);
    }
    return message;
}

function findViewOnceContent(message, depth = 0) {
    if (!message || depth > 5) return null;
    for (const key of ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension']) {
        const inner = message[key]?.message;
        if (inner) return inner;
    }
    for (const key of ['ephemeralMessage', 'documentWithCaptionMessage', 'deviceSentMessage']) {
        const inner = message[key]?.message;
        if (inner) {
            const found = findViewOnceContent(inner, depth + 1);
            if (found) return found;
        }
    }
    return null;
}

function botChatJid(sock) {
    const id = sock.user?.id || '';
    return `${id.split(':')[0]}@s.whatsapp.net`;
}

async function downloadMediaBuffer(media, type) {
    const stream = await downloadContentFromMessage(media, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

async function forwardContent(sock, content, caption) {
    if (!content) return false;
    const jid = botChatJid(sock);
    const type = Object.keys(content)[0];
    const media = content[type];
    try {
        if (type === 'imageMessage') {
            const buffer = await downloadMediaBuffer(media, 'image');
            await sock.sendMessage(jid, { image: buffer, caption });
            return true;
        }
        if (type === 'videoMessage') {
            const buffer = await downloadMediaBuffer(media, 'video');
            await sock.sendMessage(jid, { video: buffer, caption, mimetype: media.mimetype || 'video/mp4' });
            return true;
        }
        if (type === 'audioMessage') {
            const buffer = await downloadMediaBuffer(media, 'audio');
            await sock.sendMessage(jid, { audio: buffer, mimetype: media.mimetype || 'audio/mp4', ptt: Boolean(media.ptt) });
            return true;
        }
        if (type === 'stickerMessage') {
            const buffer = await downloadMediaBuffer(media, 'sticker');
            await sock.sendMessage(jid, { sticker: buffer });
            return true;
        }
        if (type === 'documentMessage') {
            const buffer = await downloadMediaBuffer(media, 'document');
            await sock.sendMessage(jid, { document: buffer, caption, mimetype: media.mimetype || 'application/octet-stream', fileName: media.fileName || 'document' });
            return true;
        }
        const text = content.conversation ||
            content.extendedTextMessage?.text ||
            content.imageMessage?.caption ||
            content.videoMessage?.caption ||
            content.documentMessage?.caption || '';
        if (text) {
            await sock.sendMessage(jid, { text: caption ? `${caption}\n\n${text}` : text });
            return true;
        }
    } catch (err) {
        console.log('Forward failed:', err.message);
    }
    return false;
}

function forwardingCaption(title, mek) {
    const sender = mek.key?.participant || mek.key?.remoteJid || 'unknown';
    return `${title}\n\n👤 From: ${String(sender).split('@')[0]}\n💬 Chat: ${mek.key?.remoteJid}\n🕒 ${new Date().toLocaleString()}`;
}

async function captureViewOnce(sock, mek, content) {
    return forwardContent(sock, content, forwardingCaption('👁️ *View Once Captured*', mek));
}

const forwardedDeletes = new Set();

async function forwardStoredMessage(sock, store, remoteJid, messageId) {
    if (!remoteJid || !messageId) return false;
    const cacheKey = `${remoteJid}:${messageId}`;
    if (forwardedDeletes.has(cacheKey)) return false;
    const original = store?.messages?.get(cacheKey);
    if (!original?.message) return false;
    forwardedDeletes.add(cacheKey);
    if (forwardedDeletes.size > 500) {
        const oldest = forwardedDeletes.values().next().value;
        if (oldest) forwardedDeletes.delete(oldest);
    }
    const viewOnce = findViewOnceContent(original.message);
    const content = viewOnce || unwrapMessage(original.message);
    const title = viewOnce ? '🗑️ *Deleted View Once*' : '🗑️ *Deleted Message*';
    const sent = await forwardContent(sock, content, forwardingCaption(title, original));
    if (!sent) forwardedDeletes.delete(cacheKey);
    return sent;
}

let activeSock = null;
let reconnectScheduled = false;

const clientstart = async() => {
    await loadBaileys();
    
    const browserOptions = [
        Browsers.macOS('Safari'),
        Browsers.macOS('Chrome'),
        Browsers.windows('Firefox'),
        Browsers.ubuntu('Chrome'),
        Browsers.baileys('Baileys'),
        Browsers.macOS('Edge'),
        Browsers.windows('Edge'),
    ];
    
    const randomBrowser = browserOptions[Math.floor(Math.random() * browserOptions.length)];
    
    const store = {
        messages: new Map(),
        contacts: new Map(),
        groupMetadata: new Map(),
        loadMessage: async (jid, id) => store.messages.get(`${jid}:${id}`) || null,
        bind: (ev) => {
            ev.on('messages.upsert', ({ messages }) => {
                for (const msg of messages) {
                    if (msg.key?.remoteJid && msg.key?.id) {
                        store.messages.set(`${msg.key.remoteJid}:${msg.key.id}`, msg);
                    }
                }
            });
            
            ev.on('lid-mapping.update', ({ mappings }) => {
                console.log(chalk.cyan('📋 LID Mapping Update:'), mappings);
            });
        }
    };
    
    const sessionDir = `./${config().session}`;
    const sessionUrl = (config().sessionUrl || 'https://session.lordeagle.tech').replace(/\/+$/, '');
    const sessionUrls = [...new Set([sessionUrl, ...(config().sessionUrlFallbacks || [])].map(u => String(u).replace(/\/+$/, '')))];
    const sessionPrefix = config().sessionPrefix || 'Zynex~';

    const decodeSessionPayload = (text) => {
        let val = String(text || '').trim();
        if (!val) return null;
        if (val.startsWith(sessionPrefix)) val = val.slice(sessionPrefix.length);
        if (val.startsWith('{')) {
            try { JSON.parse(val); return val; } catch { return null; }
        }
        try {
            const buf = Buffer.from(val, 'base64');
            let decoded;
            try { decoded = zlib.gunzipSync(buf).toString('utf8'); }
            catch { decoded = buf.toString('utf8'); }
            decoded = decoded.trim();
            if (decoded.startsWith('{')) {
                try { JSON.parse(decoded); return decoded; } catch { return null; }
            }
        } catch {}
        return null;
    };

    const resolveSession = async (input) => {
        const raw = String(input || '').trim();
        if (!raw) return null;
        let short = raw;
        if (short.startsWith(sessionPrefix)) short = short.slice(sessionPrefix.length);
        const direct = decodeSessionPayload(raw);
        if (direct) return direct;
        for (const base of sessionUrls) {
            for (const id of [...new Set([short, raw])]) {
                try {
                    const res = await fetch(`${base}/session/${encodeURIComponent(id)}`);
                    if (!res.ok) continue;
                    const fetched = decodeSessionPayload(await res.text());
                    if (fetched) return fetched;
                } catch {}
            }
        }
        return null;
    };

    const sessionIdEnv = (config().sessionId || process.env.SESSION_ID || '').toString().trim();
    let sessionIdToLoad = sessionIdEnv;
    if (!sessionIdToLoad) {
        try {
            const hasCreds = fs.existsSync(path.join(sessionDir, 'creds.json'));
            if (!hasCreds) {
                const choice = await question('Login method:\n1) Pairing code\n2) Paste Session ID from site\nChoose 1 or 2: ');
                if (choice.trim() === '2') {
                    sessionIdToLoad = await question('Paste your Session ID here:\n');
                }
            }
        } catch (e) {}
    }
    if (sessionIdToLoad && sessionIdToLoad.trim()) {
        try {
            const creds = await resolveSession(sessionIdToLoad);
            if (!creds) throw new Error(`could not resolve session from ${sessionUrls.join(', ')} - check the ID/prefix or SESSION_URL`);
            if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
            fs.writeFileSync(path.join(sessionDir, 'creds.json'), creds);
            console.log(chalk.green('[SESSION] Loaded session from Session ID'));
        } catch (err) {
            console.log(chalk.red('[SESSION] Failed to load Session ID:'), err.message);
            if (fs.existsSync(path.join(sessionDir, 'creds.json'))) {
                try { fs.unlinkSync(path.join(sessionDir, 'creds.json')); } catch {}
            }
        }
    }
    
    const { state, saveCreds } = await useMultiFileAuthState(`./${config().session}`);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: !config().status.terminal,
        auth: state,
        version: version,
        browser: randomBrowser,
        autoReconnect: false
    });
    activeSock = sock;

    sock.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {};
            return decode.user && decode.server && decode.user + '@' + decode.server || jid;
        } else return jid;
    };

    sock.public = config().status.public;
    
    if (config().status.terminal && !sock.authState.creds.registered) {
        const phoneNumber = await question('enter your WhatsApp number, starting with country code (e.g. 254717459770):\nnumber WhatsApp: ');
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(chalk.green(`your pairing code: ` + chalk.bold.green(code)));
    }
    
    store.bind(sock.ev);
    
    const lidMapping = sock.signalRepository.lidMapping;
    
    sock.getLIDForPN = async (phoneNumber) => {
        try {
            const lid = await lidMapping.getLIDForPN(phoneNumber);
            return lid;
        } catch (error) {
            console.log('No LID found for PN:', phoneNumber);
            return null;
        }
    };
    
    sock.getPNForLID = async (lid) => {
        try {
            const pn = await lidMapping.getPNForLID(lid);
            return pn;
        } catch (error) {
            console.log('No PN found for LID:', lid);
            return null;
        }
    };
    
    sock.storeLIDPNMapping = async (lid, phoneNumber) => {
        try {
            await lidMapping.storeLIDPNMapping(lid, phoneNumber);
            console.log(chalk.green(`✓ Stored LID<->PN mapping: ${lid} <-> ${phoneNumber}`));
        } catch (error) {
            console.log('Error storing LID/PN mapping:', error);
        }
    };
    
    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (connection === 'connecting') {
            console.log(chalk.yellow('🔄 Connecting to WhatsApp...'));
        }
        
        if (connection === 'open') {
            activeSock = sock;
            reconnectScheduled = false;
            console.log(chalk.green('✅ Connected to WhatsApp successfully!'));
            
            // Send connection success message to the bot owner
            const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const channel = config().channel || "https://whatsapp.com/channel/0029Vb8LcTLKWEKo4JlMb51I";
            const onlineText =
                `👑 *${config().settings.title}* is Online!\n\n` +
                `> 📌 User: ${sock.user.name || 'Unknown'}\n` +
                `> ⚡ Prefix: [ ${getPrefix()} ]\n` +
                `> 🚀 Mode: ${sock.public ? 'Public' : 'Self'}\n` +
                `> 🤖 Version: 1.2\n` +
                `> 👑 Owner: ${config().owner}\n\n` +
                `✅ Bot connected successfully`;
            sock.sendInteractiveRows(botNumber, {
                text: onlineText,
                footer: config().settings.footer,
                interactiveRows: [
                    {
                        name: 'cta_url',
                        buttonParamsJson: JSON.stringify({
                            display_text: 'Join Channel',
                            url: channel
                        })
                    }
                ]
            }).catch(async () => {
                await sock.sendMessage(botNumber, { text: `${onlineText}\n\n📢 ${channel}` }).catch(console.error);
            });
        }
        
        if (connection === 'close') {
            if (activeSock && activeSock !== sock) return;
            activeSock = null;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            
            console.log(chalk.red('❌ Connection closed:'), lastDisconnect?.error);
            
            if (statusCode === DisconnectReason.loggedOut) {
                console.log(chalk.red('🚫 Logged out, please restart the bot.'));
                process.exit(1);
            }
            if (statusCode === DisconnectReason.connectionReplaced) {
                console.log(chalk.red('🚫 Connection replaced by another session.'));
                process.exit(1);
            }
            if (statusCode === DisconnectReason.badSession) {
                console.log(chalk.red('🚫 Bad session. Delete sessions and re-pair.'));
                process.exit(1);
            }
            if (reconnectScheduled) return;
            reconnectScheduled = true;
            console.log(chalk.yellow('🔄 Attempting to reconnect...'));
            setTimeout(() => {
                reconnectScheduled = false;
                clientstart();
            }, 5000);
        }
        
        if (qr) {
            console.log(chalk.blue('📱 Scan the QR code above to connect.'));
        }
        
    });

    sock.ev.on('messages.upsert', async chatUpdate => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek || !mek.message) return;
            
            mek.message = Object.keys(mek.message)[0] === 'ephemeralMessage' 
                ? mek.message.ephemeralMessage.message 
                : mek.message;

            const remoteJid = mek.key?.remoteJid;
            
            if (remoteJid === 'status@broadcast') {
                if (getFeature('autostatusview')) {
                    await sock.readMessages([mek.key]).catch(() => {});
                }
                if (getFeature('autostatusreact') || config().status.reactsw) {
                    const emoji = ['😘', '😭', '😂', '😹', '😍', '😋', '🙏', '😜', '😢', '😠', '🤫', '😎'];
                    const sigma = emoji[Math.floor(Math.random() * emoji.length)];
                    await sock.sendMessage('status@broadcast', {
                        react: {
                            text: sigma,
                            key: mek.key
                        }
                    }, { statusJidList: [mek.key.participant] }).catch(() => {});
                }
                return;
            }

            if (getFeature('autoread') && !mek.key.fromMe && chatUpdate.type === 'notify') {
                await sock.readMessages([mek.key]).catch(() => {});
            }

            const protocol = mek.message?.protocolMessage;
            if (protocol && (protocol.type === 0 || protocol.type === 'REVOKE') && protocol.key?.id) {
                if (getFeature('antidelete')) {
                    await forwardStoredMessage(sock, store, remoteJid, protocol.key.id);
                }
                return;
            }

            if (getFeature('antiviewonce')) {
                const viewOnceContent = findViewOnceContent(mek.message);
                if (viewOnceContent) {
                    await captureViewOnce(sock, mek, viewOnceContent);
                    return;
                }
            }
            
            if (!sock.public && !mek.key.fromMe && chatUpdate.type === 'notify') return;
            if (mek.key.id.startsWith('BASE-') && mek.key.id.length === 12) return;
            
            const m = await smsg(sock, mek, store);
            require("./message")(sock, m, chatUpdate, store);
        } catch (err) {
            console.log(err);
        }
    });

    sock.ev.on('messages.update', async updates => {
        try {
            if (!getFeature('antidelete')) return;
            for (const item of updates || []) {
                const update = item.update || {};
                if (update.messageStubType === 1) {
                    await forwardStoredMessage(sock, store, item.key?.remoteJid, item.key?.id);
                    continue;
                }
                const protocol = update.message?.protocolMessage;
                if (protocol && (protocol.type === 0 || protocol.type === 'REVOKE') && protocol.key?.id) {
                    await forwardStoredMessage(sock, store, item.key?.remoteJid, protocol.key.id);
                }
            }
        } catch (err) {
            console.log(err);
        }
    });

    sock.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = contact.id;
            if (store && store.contacts) {
                store.contacts.set(id, {
                    id: id,
                    lid: contact.lid || null,
                    phoneNumber: contact.phoneNumber || null,
                    name: contact.notify || contact.name || null
                });
            }
        }
    });

    sock.sendText = async (jid, text, quoted = '', options) => {
        return sock.sendMessage(jid, {
            text: text,
            ...options
        }, { quoted });
    };
    
    sock.downloadMediaMessage = async (message) => {
        let mime = (message.msg || message).mimetype || '';
        let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
        const stream = await downloadContentFromMessage(message, messageType);
        let buffer = Buffer.from([]);
        for await(const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        return buffer;
    };

    sock.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path) ? 
            path : /^data:.*?\/.*?;base64,/i.test(path) ?
            Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ?
            await (await getBuffer(path)) : fs.existsSync(path) ? 
            fs.readFileSync(path) : Buffer.alloc(0);
        
        let buffer;
        if (options && (options.packname || options.author)) {
            buffer = await writeExifImg(buff, options);
        } else {
            buffer = await addExif(buff);
        }
        
        await sock.sendMessage(jid, { 
            sticker: { url: buffer }, 
            ...options 
        }, { quoted });
        return buffer;
    };
    
    sock.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
        let quoted = message.msg ? message.msg : message;
        let mime = (message.msg || message).mimetype || "";
        let messageType = message.mtype ? message.mtype.replace(/Message/gi, "") : mime.split("/")[0];

        const stream = await downloadContentFromMessage(quoted, messageType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        let type = await FileType.fromBuffer(buffer);
        let trueFileName = attachExtension ? filename + "." + type.ext : filename;
        await fs.writeFileSync(trueFileName, buffer);
        
        return trueFileName;
    };

    sock.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
        let buff = Buffer.isBuffer(path) ? 
            path : /^data:.*?\/.*?;base64,/i.test(path) ?
            Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ?
            await (await getBuffer(path)) : fs.existsSync(path) ? 
            fs.readFileSync(path) : Buffer.alloc(0);

        let buffer;
        if (options && (options.packname || options.author)) {
            buffer = await writeExifVid(buff, options);
        } else {
            buffer = await videoToWebp(buff);
        }

        await sock.sendMessage(jid, {
            sticker: { url: buffer }, 
            ...options 
        }, { quoted });
        return buffer;
    };
    
    sock.getFile = async (PATH, returnAsFilename) => {
        let res, filename;
        const data = Buffer.isBuffer(PATH) ?
              PATH : /^data:.*?\/.*?;base64,/i.test(PATH) ?
              Buffer.from(PATH.split`,`[1], 'base64') : /^https?:\/\//.test(PATH) ?
              await (res = await fetch(PATH)).buffer() : fs.existsSync(PATH) ?
              (filename = PATH, fs.readFileSync(PATH)) : typeof PATH === 'string' ? 
              PATH : Buffer.alloc(0);
              
        if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer');
        
        const type = await FileType.fromBuffer(data) || {
            mime: 'application/octet-stream',
            ext: '.bin'
        };
        
        if (data && returnAsFilename && !filename) {
            filename = path.join(__dirname, './tmp/' + new Date() * 1 + '.' + type.ext);
            await fs.promises.writeFile(filename, data);
        }
        
        return {
            res,
            filename,
            ...type,
            data,
            deleteFile() {
                return filename && fs.promises.unlink(filename);
            }
        };
    };
    
    sock.sendFile = async (jid, path, filename = '', caption = '', quoted, ptt = false, options = {}) => {
        let type = await sock.getFile(path, true);
        let { res, data: file, filename: pathFile } = type;
        
        if (res && res.status !== 200 || file.length <= 65536) {
            try {
                throw { json: JSON.parse(file.toString()) };
            } catch (e) { 
                if (e.json) throw e.json;
            }
        }
        
        let opt = { filename };
        if (quoted) opt.quoted = quoted;
        if (!type) options.asDocument = true;
        
        let mtype = '', mimetype = type.mime, convert;
        
        if (/webp/.test(type.mime) || (/image/.test(type.mime) && options.asSticker)) mtype = 'sticker';
        else if (/image/.test(type.mime) || (/webp/.test(type.mime) && options.asImage)) mtype = 'image';
        else if (/video/.test(type.mime)) mtype = 'video';
        else if (/audio/.test(type.mime)) {
            convert = await (ptt ? toPTT : toAudio)(file, type.ext);
            file = convert.data;
            pathFile = convert.filename;
            mtype = 'audio';
            mimetype = 'audio/ogg; codecs=opus';
        }
        else mtype = 'document';
        
        if (options.asDocument) mtype = 'document';
        
        let message = {
            ...options,
            caption,
            ptt,
            [mtype]: { url: pathFile },
            mimetype
        };
        
        let m;
        try {
            m = await sock.sendMessage(jid, message, {
                ...opt,
                ...options
            });
        } catch (e) {
            console.error(e);
            m = null;
        } finally {
            if (!m) {
                m = await sock.sendMessage(jid, {
                    ...message,
                    [mtype]: file
                }, {
                    ...opt,
                    ...options 
                });
            }
            return m;
        }
    };
    
    return sock;
};

clientstart();

const ignoredErrors = [
    'Socket connection timeout',
    'EKEYTYPE',
    'item-not-found',
    'rate-overlimit',
    'Connection Closed',
    'Timed Out',
    'Value not found',
    'Bad MAC'
];

let file = require.resolve(__filename);
require('fs').watchFile(file, () => {
  delete require.cache[file];
  require(file);
});

process.on('unhandledRejection', reason => {
    if (ignoredErrors.some(e => String(reason).includes(e))) return;
    console.log('Unhandled Rejection:', reason);
});

const ignoredInfo = [
    'Closing session:',
    'Decrypted message with closed session',
    'Closing open session in favor of incoming prekey bundle',
    'Session already closed',
    'No session to close'
];

const originalConsoleInfo = console.info;
console.info = function (msg, ...args) {
    const text = typeof msg === 'string' ? msg : '';
    if (ignoredInfo.some(e => text.includes(e))) return;
    originalConsoleInfo.apply(console, [msg, ...args]);
};

const originalConsoleError = console.error;
console.error = function (msg, ...args) {
    if (typeof msg === 'string' && ignoredErrors.some(e => msg.includes(e))) return;
    originalConsoleError.apply(console, [msg, ...args]);
};

const originalStderrWrite = process.stderr.write;
process.stderr.write = function (msg, encoding, fd) {
    if (typeof msg === 'string' && ignoredErrors.some(e => msg.includes(e))) return;
    originalStderrWrite.apply(process.stderr, arguments);
};