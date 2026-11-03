const os = require('os');
const packageInfo = require('../package.json');
const baileysInfo = require('@lordeagle21/baileys/package.json');

function formatUptime(seconds) {
    seconds = Math.max(0, Number(seconds) || 0);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
}

function memoryUsage() {
    const used = process.memoryUsage();
    return {
        rss: (used.rss / (1024 * 1024)).toFixed(2),
        heap: (used.heapUsed / (1024 * 1024)).toFixed(2)
    };
}

module.exports = [
    {
        command: 'ping',
        description: 'Check bot response time',
        category: 'general',
        execute: async (sock, m, { reply }) => {
            const start = Date.now();
            await reply('Pong!');
            const latency = Date.now() - start;
            await reply(`Pong!\nResponse Time: ${latency}ms\nRuntime: ${process.uptime().toFixed(2)}s`);
        }
    },
    {
        command: 'speed',
        aliases: ['latency', 'velocity'],
        description: 'Check bot response speed and message latency',
        category: 'general',
        execute: async (sock, m, { reply }) => {
            const start = Date.now();
            await sock.readMessages([m.key]).catch(() => {});
            const response = Date.now() - start;
            const latency = Math.max(0, Date.now() - Number(m.messageTimestamp) * 1000);
            const memory = memoryUsage();
            await reply(
                `*SPEED*\n\n` +
                `Response: ${response}ms\n` +
                `Message Latency: ${latency}ms\n` +
                `Memory: ${memory.heap}MB / ${memory.rss}MB\n` +
                `Uptime: ${formatUptime(process.uptime())}`
            );
        }
    },
    {
        command: 'uptime',
        aliases: ['up'],
        description: 'Show how long the bot has been running',
        category: 'general',
        execute: async (sock, m, { reply }) => {
            const uptime = process.uptime();
            const started = new Date(Date.now() - uptime * 1000);
            await reply(
                `*BOT UPTIME*\n\n` +
                `Uptime: ${formatUptime(uptime)}\n` +
                `Started: ${started.toLocaleString()}\n` +
                `System Uptime: ${formatUptime(os.uptime())}`
            );
        }
    },
    {
        command: 'runtime',
        aliases: ['rt'],
        description: 'Show Node.js runtime information',
        category: 'general',
        execute: async (sock, m, { reply }) => {
            const memory = memoryUsage();
            await reply(
                `*RUNTIME*\n\n` +
                `Node.js: ${process.version}\n` +
                `Platform: ${os.platform()} ${os.arch()}\n` +
                `PID: ${process.pid}\n` +
                `Uptime: ${formatUptime(process.uptime())}\n` +
                `Heap Used: ${memory.heap}MB\n` +
                `RSS: ${memory.rss}MB`
            );
        }
    },
    {
        command: 'baileys',
        aliases: ['lib', 'library', 'baileysversion'],
        description: 'Show Baileys library and bot version information',
        category: 'general',
        execute: async (sock, m, { reply }) => {
            await reply(
                `*BAILEYS INFO*\n\n` +
                `Baileys: v${baileysInfo.version}\n` +
                `Bot: ${packageInfo.name} v${packageInfo.version}\n` +
                `Node.js: ${process.version}\n` +
                `Platform: ${os.platform()} ${os.arch()}`
            );
        }
    }
];
