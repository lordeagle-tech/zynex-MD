const config = require('../settings/config');

async function sendButtons(sock, jid, { text, rows, footer = config.settings.footer, quoted, image } = {}) {
    if (!Array.isArray(rows) || !rows.length) return null;
    try {
        return await sock.sendInteractiveRows(jid, {
            ...(image ? { image } : {}),
            text,
            footer,
            interactiveRows: rows
        }, quoted ? { quoted } : {});
    } catch (e) {
        const links = rows.map(row => {
            try {
                const params = typeof row.buttonParamsJson === 'string' ? JSON.parse(row.buttonParamsJson) : row.buttonParamsJson;
                return params?.url || params?.link?.url;
            } catch {
                return null;
            }
        }).filter(Boolean);
        const fallbackText = links.length ? `${text}\n\n${links.join('\n')}` : text;
        try {
            return await sock.sendMessage(jid, image ? { image, caption: fallbackText } : { text: fallbackText }, quoted ? { quoted } : {});
        } catch (e2) {
            return null;
        }
    }
}

async function sendLinkButton(sock, jid, { text, label, url, footer = config.settings.footer, quoted, image } = {}) {
    if (!url) return null;
    return sendButtons(sock, jid, {
        text,
        footer,
        quoted,
        image,
        rows: [{
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
                display_text: String(label).slice(0, 30),
                url
            })
        }]
    });
}

module.exports = { sendButtons, sendLinkButton };
