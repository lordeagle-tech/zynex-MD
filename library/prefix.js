const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'settings', 'prefix.json');
let cached = null;

function getPrefix() {
    if (cached !== null) return cached;
    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        cached = typeof data.prefix === 'string' && data.prefix ? data.prefix : '.';
    } catch {
        cached = '.';
    }
    return cached;
}

function setPrefix(prefix) {
    cached = prefix;
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ prefix }, null, 2));
    } catch {}
    return cached;
}

module.exports = { getPrefix, setPrefix };
