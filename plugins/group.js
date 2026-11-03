const { isUrl, react } = require('../library/apiHelper');

function normalizeJid(value) {
    if (!value || typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (trimmed.includes('@')) return trimmed;
    const digits = trimmed.replace(/[^0-9]/g, '');
    return digits ? `${digits}@s.whatsapp.net` : '';
}

function botJid(sock) {
    const id = sock?.user?.id || '';
    if (!id) return '';
    return normalizeJid(id.split(':')[0]);
}

function getTargets(sock, m, text) {
    const found = [];
    if (Array.isArray(m.mentionedJid)) found.push(...m.mentionedJid);
    if (m.quoted?.sender) found.push(m.quoted.sender);
    if (m.quoted?.participant) found.push(m.quoted.participant);

    const numbers = String(text || '')
        .split(/\s+/)
        .map(part => part.replace(/[^0-9]/g, ''))
        .filter(part => part.length >= 7);
    found.push(...numbers.map(normalizeJid));

    const self = botJid(sock);
    const sender = normalizeJid(m.sender);
    return [...new Set(found.map(normalizeJid).filter(jid => jid && jid !== self && jid !== sender))];
}

function mentionList(ids) {
    return ids.map(id => `@${String(id).split('@')[0]}`).join(' ');
}

function requireBotAdmin(reply) {
    return reply('🚫 I need to be an admin to do that.');
}

async function updateParticipants(sock, chat, ids, action) {
    return sock.groupParticipantsUpdate(chat, ids, action);
}

async function getImageInput(sock, m, text) {
    const url = String(text || '').trim().split(/\s+/).find(isUrl);
    if (url) return { url };

    if (!m.quoted) return null;
    try {
        if (typeof m.quoted.download === 'function') {
            const buffer = await m.quoted.download();
            if (buffer) return buffer;
        }
    } catch {}
    try {
        const buffer = await sock.downloadMediaMessage(m.quoted);
        if (buffer) return buffer;
    } catch {}
    return null;
}

function resultSummary(results, successText) {
    const ok = Array.isArray(results)
        ? results.filter(item => item && (item.status === '200' || item.status === 200 || item.status === undefined)).length
        : 0;
    if (Array.isArray(results) && results.length && ok === 0) {
        return '❌ Action failed. Check my admin permissions.';
    }
    return successText;
}

module.exports = [
    {
        command: 'groupinfo',
        aliases: ['ginfo', 'gc'],
        category: 'group',
        group: true,
        description: 'Show information about this group',
        execute: async (sock, m, { reply, groupMetadata, participants, groupName, groupOwner, isBotAdmins, prefix }) => {
            const meta = groupMetadata || {};
            const admins = (participants || []).filter(p => p.admin === 'admin' || p.admin === 'superadmin');
            const created = meta.creation ? new Date(meta.creation * 1000).toLocaleString() : 'Unknown';
            const settings = meta.announce ? '🔒 Closed (admins only)' : '🔓 Open';

            const text = [
                `👥 *${groupName || meta.subject || 'Group Info'}*`,
                '',
                `🆔 *ID:* ${m.chat}`,
                `👑 *Owner:* ${groupOwner ? `@${String(groupOwner).split('@')[0]}` : 'Unknown'}`,
                `👤 *Members:* ${(participants || []).length}`,
                `🛡️ *Admins:* ${admins.length}`,
                `⚙️ *Settings:* ${settings}`,
                `🤖 *Bot Admin:* ${isBotAdmins ? 'Yes' : 'No'}`,
                `📅 *Created:* ${created}`,
                meta.desc ? `\n📝 *Description:*\n${meta.desc}` : '',
                '',
                `> ${prefix}group help for controls`
            ].filter(Boolean).join('\n');

            await reply(text);
        }
    },
    {
        command: 'admins',
        aliases: ['listadmins', 'groupadmins'],
        category: 'group',
        group: true,
        description: 'List group admins',
        execute: async (sock, m, { reply, participants, groupName }) => {
            const admins = (participants || []).filter(p => p.admin === 'admin' || p.admin === 'superadmin');
            if (!admins.length) return reply('⚠️ No admins found.');
            const lines = admins.map((admin, index) => {
                const rank = admin.admin === 'superadmin' ? '👑' : '🛡️';
                return `${index + 1}. ${rank} @${String(admin.id).split('@')[0]}`;
            });
            await sock.sendMessage(m.chat, {
                text: `👥 *Admins in ${groupName || 'this group'}*\n\n${lines.join('\n')}`,
                mentions: admins.map(admin => admin.id)
            }, { quoted: m });
        }
    },
    {
        command: 'promote',
        aliases: ['makeadmin'],
        category: 'group',
        group: true,
        admin: true,
        description: 'Promote a member to admin',
        execute: async (sock, m, { text, reply, isBotAdmins }) => {
            const targets = getTargets(sock, m, text);
            if (!targets.length) return reply('❌ Mention, reply to, or provide the number of the member to promote.');
            if (!isBotAdmins) return requireBotAdmin(reply);

            await react(sock, m, '🛡️');
            try {
                const results = await updateParticipants(sock, m.chat, targets, 'promote');
                await react(sock, m, '✅');
                await sock.sendMessage(m.chat, {
                    text: resultSummary(results, `✅ Promoted ${mentionList(targets)} to admin.`),
                    mentions: targets
                }, { quoted: m });
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ Failed to promote: ${err.message}`);
            }
        }
    },
    {
        command: 'demote',
        aliases: ['removeadmin'],
        category: 'group',
        group: true,
        admin: true,
        description: 'Remove admin rights from a member',
        execute: async (sock, m, { text, reply, isBotAdmins }) => {
            const targets = getTargets(sock, m, text);
            if (!targets.length) return reply('❌ Mention, reply to, or provide the number of the admin to demote.');
            if (!isBotAdmins) return requireBotAdmin(reply);

            await react(sock, m, '🛡️');
            try {
                const results = await updateParticipants(sock, m.chat, targets, 'demote');
                await react(sock, m, '✅');
                await sock.sendMessage(m.chat, {
                    text: resultSummary(results, `✅ Demoted ${mentionList(targets)}.`),
                    mentions: targets
                }, { quoted: m });
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ Failed to demote: ${err.message}`);
            }
        }
    },
    {
        command: 'kick',
        aliases: ['remove', 'removemember'],
        category: 'group',
        group: true,
        admin: true,
        description: 'Kick a member from the group',
        execute: async (sock, m, { text, reply, isBotAdmins, groupOwner }) => {
            let targets = getTargets(sock, m, text);
            if (!targets.length) return reply('❌ Mention, reply to, or provide the number of the member to kick.');
            if (!isBotAdmins) return requireBotAdmin(reply);

            const owner = normalizeJid(groupOwner);
            targets = targets.filter(id => id !== owner && id !== botJid(sock));
            if (!targets.length) return reply('🚫 I cannot kick the group owner or myself.');

            await react(sock, m, '👢');
            try {
                const results = await updateParticipants(sock, m.chat, targets, 'remove');
                await react(sock, m, '✅');
                await sock.sendMessage(m.chat, {
                    text: resultSummary(results, `✅ Kicked ${mentionList(targets)}.`),
                    mentions: targets
                }, { quoted: m });
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ Failed to kick: ${err.message}`);
            }
        }
    },
    {
        command: 'add',
        aliases: ['addmember'],
        category: 'group',
        group: true,
        admin: true,
        description: 'Add a member to the group',
        execute: async (sock, m, { text, reply, isBotAdmins }) => {
            const number = String(text || '').match(/\d{7,15}/);
            if (!number) return reply('❌ Provide a phone number with country code.');
            if (!isBotAdmins) return requireBotAdmin(reply);

            const jid = normalizeJid(number[0]);
            await react(sock, m, '➕');
            try {
                const results = await updateParticipants(sock, m.chat, [jid], 'add');
                await react(sock, m, '✅');
                await sock.sendMessage(m.chat, {
                    text: resultSummary(results, `✅ Added @${String(jid).split('@')[0]}.`),
                    mentions: [jid]
                }, { quoted: m });
            } catch (err) {
                await react(sock, m, '❌');
                await reply(`❌ Failed to add member: ${err.message}`);
            }
        }
    },
    {
        command: 'tagall',
        aliases: ['everyone', 'mentionall'],
        category: 'group',
        group: true,
        description: 'Mention all group members',
        execute: async (sock, m, { text, reply, participants }) => {
            const members = (participants || []).map(p => p.id).filter(Boolean);
            if (!members.length) return reply('⚠️ No members found.');

            const message = String(text || '').trim();
            const textBody = `📢 *Tag All*\n${message ? `\n${message}\n` : ''}\n${members.map(id => `@${String(id).split('@')[0]}`).join(' ')}`;

            await react(sock, m, '📢');
            await sock.sendMessage(m.chat, { text: textBody, mentions: members }, { quoted: m });
        }
    },
    {
        command: 'hidetag',
        aliases: ['htag'],
        category: 'group',
        group: true,
        description: 'Mention all members silently',
        execute: async (sock, m, { text, reply, participants }) => {
            const members = (participants || []).map(p => p.id).filter(Boolean);
            if (!members.length) return reply('⚠️ No members found.');

            await react(sock, m, '📢');
            await sock.sendMessage(m.chat, {
                text: String(text || '').trim() || '📢',
                mentions: members
            }, { quoted: m });
        }
    },
    {
        command: 'group',
        aliases: ['gcsettings', 'groupsettings'],
        category: 'group',
        group: true,
        admin: true,
        description: 'Manage group settings: open, close, name, desc, photo, link, revoke, leave, help',
        execute: async (sock, m, { text, prefix, reply, isBotAdmins, isCreator, isGroupOwner }) => {
            const parts = String(text || '').trim().split(/\s+/);
            const action = (parts.shift() || 'help').toLowerCase();
            const value = parts.join(' ');

            const help = [
                `⚙️ *Group Controls*`,
                '',
                `${prefix}group open — allow everyone to send`,
                `${prefix}group close — admins only`,
                `${prefix}group name <new name>`,
                `${prefix}group desc <new description>`,
                `${prefix}group photo <image url> — or reply to an image`,
                `${prefix}group link — get invite link`,
                `${prefix}group revoke — reset invite link`,
                `${prefix}group leave — bot leaves the group`
            ].join('\n');

            if (action === 'help') return reply(help);

            if (action === 'open' || action === 'unmute') {
                if (!isBotAdmins) return requireBotAdmin(reply);
                await sock.groupSettingUpdate(m.chat, 'not_announcement');
                return reply('🔓 Group opened. Everyone can send messages.');
            }

            if (action === 'close' || action === 'mute') {
                if (!isBotAdmins) return requireBotAdmin(reply);
                await sock.groupSettingUpdate(m.chat, 'announcement');
                return reply('🔒 Group closed. Only admins can send messages.');
            }

            if (action === 'name' || action === 'subject') {
                if (!value) return reply(`❌ Usage: ${prefix}group name <new name>`);
                if (!isBotAdmins) return requireBotAdmin(reply);
                await sock.groupUpdateSubject(m.chat, value);
                return reply(`✅ Group name changed to *${value}*.`);
            }

            if (action === 'desc' || action === 'description') {
                if (!value) return reply(`❌ Usage: ${prefix}group desc <new description>`);
                if (!isBotAdmins) return requireBotAdmin(reply);
                await sock.groupUpdateDescription(m.chat, value);
                return reply('✅ Group description updated.');
            }

            if (action === 'photo' || action === 'pic' || action === 'setpic') {
                if (!isBotAdmins) return requireBotAdmin(reply);
                const input = await getImageInput(sock, m, value);
                if (!input) return reply(`❌ Provide an image URL or reply to an image.\nUsage: ${prefix}group photo <image url>`);
                try {
                    await sock.updateProfilePicture(m.chat, input);
                    return reply('✅ Group photo updated.');
                } catch (err) {
                    return reply(`❌ Failed to update group photo: ${err.message}`);
                }
            }

            if (action === 'link' || action === 'invite') {
                const code = await sock.groupInviteCode(m.chat);
                return reply(`🔗 *Group Link*\n\nhttps://chat.whatsapp.com/${code}`);
            }

            if (action === 'revoke' || action === 'resetlink') {
                if (!isBotAdmins) return requireBotAdmin(reply);
                let code = await sock.groupRevokeInvite(m.chat);
                if (!code) code = await sock.groupInviteCode(m.chat);
                return reply(`♻️ *Invite link reset*\n\nhttps://chat.whatsapp.com/${code}`);
            }

            if (action === 'leave' || action === 'exit') {
                if (!isCreator && !isGroupOwner) {
                    return reply('🚫 Only the bot owner or group owner can make the bot leave.');
                }
                await reply('👋 Leaving the group. Goodbye!');
                return sock.groupLeave(m.chat);
            }

            return reply(`❌ Unknown action.\n\n${help}`);
        }
    },
    {
        command: 'mute',
        aliases: ['closegroup'],
        category: 'group',
        group: true,
        admin: true,
        description: 'Close the group (admins only)',
        execute: async (sock, m, { reply, isBotAdmins }) => {
            if (!isBotAdmins) return requireBotAdmin(reply);
            await sock.groupSettingUpdate(m.chat, 'announcement');
            await reply('🔒 Group closed. Only admins can send messages.');
        }
    },
    {
        command: 'unmute',
        aliases: ['opengroup'],
        category: 'group',
        group: true,
        admin: true,
        description: 'Open the group to everyone',
        execute: async (sock, m, { reply, isBotAdmins }) => {
            if (!isBotAdmins) return requireBotAdmin(reply);
            await sock.groupSettingUpdate(m.chat, 'not_announcement');
            await reply('🔓 Group opened. Everyone can send messages.');
        }
    },
    {
        command: 'gname',
        aliases: ['setgcname', 'setgroupname'],
        category: 'group',
        group: true,
        admin: true,
        description: 'Change the group name',
        execute: async (sock, m, { text, prefix, reply, isBotAdmins }) => {
            const value = String(text || '').trim();
            if (!value) return reply(`❌ Usage: ${prefix}gname <new name>`);
            if (!isBotAdmins) return requireBotAdmin(reply);
            await sock.groupUpdateSubject(m.chat, value);
            await reply(`✅ Group name changed to *${value}*.`);
        }
    },
    {
        command: 'gdesc',
        aliases: ['setgcdesc', 'setgroupdesc'],
        category: 'group',
        group: true,
        admin: true,
        description: 'Change the group description',
        execute: async (sock, m, { text, prefix, reply, isBotAdmins }) => {
            const value = String(text || '').trim();
            if (!value) return reply(`❌ Usage: ${prefix}gdesc <new description>`);
            if (!isBotAdmins) return requireBotAdmin(reply);
            await sock.groupUpdateDescription(m.chat, value);
            await reply('✅ Group description updated.');
        }
    },
    {
        command: 'gpic',
        aliases: ['setgpic', 'gcphoto', 'groupphoto'],
        category: 'group',
        group: true,
        admin: true,
        description: 'Change the group photo from a URL or quoted image',
        execute: async (sock, m, { text, prefix, reply, isBotAdmins }) => {
            if (!isBotAdmins) return requireBotAdmin(reply);
            const input = await getImageInput(sock, m, text);
            if (!input) {
                return reply(`❌ Provide an image URL or reply to an image.\nUsage: ${prefix}gpic <image url>`);
            }
            try {
                await sock.updateProfilePicture(m.chat, input);
                await reply('✅ Group photo updated.');
            } catch (err) {
                await reply(`❌ Failed to update group photo: ${err.message}`);
            }
        }
    },
    {
        command: 'kickall',
        aliases: ['removeall'],
        category: 'group',
        group: true,
        admin: true,
        description: 'Remove all non-admin members (owner only)',
        execute: async (sock, m, { text, prefix, reply, participants, groupOwner, isBotAdmins, isCreator, isGroupOwner }) => {
            if (!isCreator && !isGroupOwner) {
                return reply('🚫 Only the bot owner or group owner can use kickall.');
            }
            if (!isBotAdmins) return requireBotAdmin(reply);

            const self = botJid(sock);
            const owner = normalizeJid(groupOwner);
            const sender = normalizeJid(m.sender);
            const targets = [...new Set((participants || [])
                .filter(p => p && p.id && p.admin !== 'admin' && p.admin !== 'superadmin')
                .map(p => normalizeJid(p.id))
                .filter(id => id && id !== self && id !== owner && id !== sender))];

            if (!targets.length) {
                return reply('⚠️ No non-admin members to kick.');
            }

            if (String(text || '').trim().toLowerCase() !== 'confirm') {
                return reply(`⚠️ *Kick All*\n\nThis will remove *${targets.length}* non-admin member(s).\nAdmins and the group owner will be kept.\n\nRun *${prefix}kickall confirm* to proceed.`);
            }

            await react(sock, m, '👢');
            let done = 0;
            let failed = 0;

            for (let index = 0; index < targets.length; index += 10) {
                const chunk = targets.slice(index, index + 10);
                try {
                    await sock.groupParticipantsUpdate(m.chat, chunk, 'remove');
                    done += chunk.length;
                } catch {
                    failed += chunk.length;
                }
                if (index + 10 < targets.length) {
                    await new Promise(resolve => setTimeout(resolve, 700));
                }
            }

            await react(sock, m, failed ? '⚠️' : '✅');
            await reply(`👢 *Kick All Complete*\n\n✅ Removed: ${done}\n❌ Failed: ${failed}\n\nAdmins and the group owner were kept.`);
        }
    },
    {
        command: 'gid',
        aliases: ['groupid'],
        category: 'group',
        group: true,
        description: 'Show the group ID',
        execute: async (sock, m, { reply }) => {
            await reply(`🆔 *Group ID*\n\n${m.chat}`);
        }
    },
    {
        command: 'del',
        aliases: ['delete'],
        category: 'group',
        admin: true,
        description: 'Delete a quoted message',
        execute: async (sock, m, { reply }) => {
            if (!m.quoted) return reply('❌ Reply to the message you want to delete.');
            try {
                if (typeof m.quoted.delete === 'function') {
                    await m.quoted.delete();
                } else {
                    await sock.sendMessage(m.chat, { delete: m.quoted.key });
                }
                await react(sock, m, '✅');
            } catch (err) {
                await reply(`❌ Failed to delete message: ${err.message}`);
            }
        }
    }
];
