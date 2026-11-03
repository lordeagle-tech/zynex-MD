const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'settings', 'features.json');

const DEFAULTS = {
    autostatusview: false,
    autostatusreact: false,
    antiviewonce: false,
    autoread: false,
    autotyping: false,
    autorecording: false,
    autotypingrecording: false,
    antidelete: false,
    antilink: 'off',
    sudo: []
};

let cache = null;

function normalizeNumber(value) {
    return String(value || '').replace(/[^0-9]/g, '');
}

function load() {
    if (cache) return cache;
    try {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        cache = { ...DEFAULTS, ...raw };
        if (!Array.isArray(cache.sudo)) cache.sudo = [];
    } catch {
        cache = { ...DEFAULTS };
    }
    return cache;
}

function save() {
    if (!cache) load();
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(cache, null, 2));
    } catch (err) {
        console.log('Failed to save features:', err.message);
    }
}

function getFeatures() {
    const data = load();
    return { ...data, sudo: [...data.sudo] };
}

function getFeature(key) {
    return load()[key];
}

function setFeature(key, value) {
    const data = load();
    data[key] = value;
    save();
    return value;
}

function isSudo(jidOrNumber) {
    const number = normalizeNumber(jidOrNumber);
    if (!number) return false;
    return load().sudo.some(item => normalizeNumber(item) === number);
}

function addSudo(jidOrNumber) {
    const number = normalizeNumber(jidOrNumber);
    if (!number) return false;
    const data = load();
    if (!data.sudo.some(item => normalizeNumber(item) === number)) {
        data.sudo.push(number);
        save();
    }
    return number;
}

function removeSudo(jidOrNumber) {
    const number = normalizeNumber(jidOrNumber);
    if (!number) return false;
    const data = load();
    const before = data.sudo.length;
    data.sudo = data.sudo.filter(item => normalizeNumber(item) !== number);
    save();
    return data.sudo.length !== before;
}

function getSudoList() {
    return [...load().sudo];
}

async function applyPresence(sock, jid) {
    const data = load();
    try {
        if (data.autotypingrecording) {
            await sock.sendPresenceUpdate('recording', jid);
            await new Promise(resolve => setTimeout(resolve, 700));
            await sock.sendPresenceUpdate('composing', jid);
        } else if (data.autotyping) {
            await sock.sendPresenceUpdate('composing', jid);
        } else if (data.autorecording) {
            await sock.sendPresenceUpdate('recording', jid);
        }
    } catch {}
}

module.exports = {
    DEFAULTS,
    normalizeNumber,
    getFeatures,
    getFeature,
    setFeature,
    isSudo,
    addSudo,
    removeSudo,
    getSudoList,
    applyPresence
};
