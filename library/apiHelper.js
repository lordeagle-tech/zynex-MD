// Shared helpers for Keith API backed plugins.
const axios = require('axios');
const config = require('../settings/config');

function baseUrl() {
    return String((config.api && config.api.baseurl) || 'https://apis.keithsite.lol/').replace(/\/+$/, '') + '/';
}

function buildUrl(endpoint) {
    return baseUrl() + String(endpoint).replace(/^\/+/, '');
}

async function apiGet(endpoint, params = {}, options = {}) {
    const {
        timeout = 60000,
        headers = {},
        returnRaw = false
    } = options;

    try {
        const res = await axios.get(buildUrl(endpoint), {
            params,
            timeout,
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; ZynexBot/1.2)',
                ...headers
            },
            validateStatus: status => status >= 200 && status < 500,
            maxContentLength: 25 * 1024 * 1024,
            maxBodyLength: 25 * 1024 * 1024
        });

        if (returnRaw) return res;

        const data = res.data;
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid API response');
        }
        return data;
    } catch (err) {
        if (err.response) {
            throw new Error(`API error (${err.response.status})`);
        }
        if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '')) {
            throw new Error('API request timed out');
        }
        throw new Error(err.message || 'API request failed');
    }
}

function apiError(data) {
    if (!data || typeof data !== 'object') return 'Empty API response';
    if (data.status === false && data.error) return String(data.error);
    if (data.result && typeof data.result === 'object' && data.result.error) {
        return String(data.result.error);
    }
    if (data.error && data.status !== true) return String(data.error);
    return null;
}

function isUrl(value) {
    return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value.trim());
}

function unwrap(data) {
    if (data && typeof data === 'object' && 'result' in data) return data.result;
    return data;
}

const MEDIA_KEYS = [
    'download',
    'downloadUrl',
    'download_url',
    'dl_url',
    'dl',
    'audio',
    'audioUrl',
    'audio_url',
    'video',
    'videoUrl',
    'video_url',
    'mp3',
    'mp4',
    'media',
    'mediaUrl',
    'media_url',
    'hd',
    'sd',
    'url',
    'link',
    'result'
];

function findMediaUrl(value, depth = 0, seen = new Set()) {
    if (value == null || depth > 6) return null;
    if (typeof value === 'string') return isUrl(value) ? value.trim() : null;
    if (typeof value !== 'object') return null;
    if (seen.has(value)) return null;
    seen.add(value);

    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findMediaUrl(item, depth + 1, seen);
            if (found) return found;
        }
        return null;
    }

    for (const key of MEDIA_KEYS) {
        if (key in value) {
            const found = findMediaUrl(value[key], depth + 1, seen);
            if (found) return found;
        }
    }

    for (const entry of Object.values(value)) {
        const found = findMediaUrl(entry, depth + 1, seen);
        if (found) return found;
    }
    return null;
}

function findUrls(value, depth = 0, out = []) {
    if (value == null || depth > 6) return out;
    if (typeof value === 'string') {
        if (isUrl(value)) out.push(value.trim());
        return out;
    }
    if (Array.isArray(value)) {
        for (const item of value) findUrls(item, depth + 1, out);
        return out;
    }
    if (typeof value === 'object') {
        for (const item of Object.values(value)) findUrls(item, depth + 1, out);
    }
    return out;
}

function toArray(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.result)) return data.result;
    if (Array.isArray(data?.result?.items)) return data.result.items;
    if (Array.isArray(data?.items)) return data.items;
    return [];
}

function clip(text, max = 3500) {
    const value = String(text == null ? '' : text);
    if (value.length <= max) return value;
    return value.slice(0, max - 3).trimEnd() + '...';
}

function formatNumber(value) {
    const num = Number(String(value == null ? '' : value).replace(/,/g, ''));
    if (!Number.isFinite(num)) return String(value == null ? '' : value);
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return String(num);
}

function safeName(value, fallback = 'file') {
    const name = String(value || fallback)
        .replace(/[\\/:*?"<>|]+/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 80);
    return name || fallback;
}

async function react(sock, m, emoji) {
    try {
        await sock.sendMessage(m.chat, { react: { text: emoji, key: m.key } });
    } catch {}
}

function errorText(err) {
    const msg = err && err.message ? err.message : String(err || 'Unknown error');
    if (/timed out/i.test(msg)) return 'API request timed out. Please try again.';
    if (/API error \(5\d\d\)/i.test(msg)) return 'API server is unavailable right now. Please try again later.';
    if (/Invalid API response/i.test(msg)) return 'API returned an invalid response. Please try again later.';
    return msg;
}

module.exports = {
    apiGet,
    apiError,
    buildUrl,
    clip,
    errorText,
    findMediaUrl,
    findUrls,
    formatNumber,
    isUrl,
    react,
    safeName,
    toArray,
    unwrap
};
