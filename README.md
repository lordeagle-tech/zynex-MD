# Zynex MD Bot

A modular WhatsApp Multi-Device bot built with Node.js and Baileys. Zynex uses a dynamic plugin system, supports pairing-code and Session ID login, and provides tools for groups, media downloads, AI, search, utilities, news, entertainment, and bot administration.

## Current bot details

| Item | Details |
| --- | --- |
| Bot name | Zynex Bot |
| Version | 1.2 |
| Platform | WhatsApp Multi-Device |
| Runtime | Node.js |
| Default prefix | `^` |
| Default mode | Public |
| Owner number | `+254 717 459 770` |
| Owner WhatsApp | [Chat with the owner](https://wa.me/254717459770) |
| GitHub | [lordeagle-tech](https://github.com/lordeagle-tech) |
| WhatsApp channel | [Join the official channel](https://whatsapp.com/channel/0029Vb8LcTLKWEKo4JlMb51I) |
| Session service | [session.lordeagle.tech](https://session.lordeagle.tech) |

> The owner number and other bot settings are configured in [`settings/config.js`](settings/config.js). Change them before deploying your own instance.

## Features

- WhatsApp Multi-Device support through Baileys
- Pairing-code login or Session ID login
- Dynamic plugin loader: add a JavaScript plugin without changing the core handler
- Automatic plugin reload support
- Public and self/private bot modes
- Owner and sudo-user permissions
- Group administration tools
- YouTube and social-media downloading tools
- AI, image, text-to-speech, music, and video features
- Search, news, movie, spiritual, education, fun, and utility menus
- Configurable command prefix
- Profile name, bio, and profile-picture management
- Deleted-message and view-once forwarding support

## Requirements

- Node.js 18 or newer
- A WhatsApp account for the bot
- Internet access
- FFmpeg support for media conversion features

## Installation

```bash
git clone https://github.com/lordeagle-tech/zynex-MD.git
cd zynex-MD
npm install
npm start
```

The bot starts from `index.js`. The npm start script runs `node index.js`.

## Login and session setup

### Pairing code

1. Start the bot with `npm start`.
2. When prompted, choose the pairing-code login method.
3. Enter the WhatsApp number in international format without `+` or spaces, for example:

```text
254717459770
```

4. Enter the pairing code shown by WhatsApp on the linked-devices screen.

### Session ID

You can provide a Session ID through the environment before starting the bot:

### Get a Session ID

Choose either session service below to generate or retrieve a Session ID:

<p>
  <a href="https://www.eaglegnick.tech" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/SESSION%201-eaglegnick.tech-2563eb?style=for-the-badge" alt="Get Session 1 from eaglegnick.tech">
  </a>
  <a href="https://session.lordeagle.tech" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/SESSION%202-session.lordeagle.tech-16a34a?style=for-the-badge" alt="Get Session 2 from session.lordeagle.tech">
  </a>
</p>

After generating a session, copy the complete Session ID and add it to `SESSION_ID` as shown below.

```bash
SESSION_ID="Zynex~your-session-id" npm start
```

Optional session settings:

```bash
SESSION_URL="https://session.lordeagle.tech" \
SESSION_PREFIX="Zynex~" \
SESSION_ID="Zynex~your-session-id" \
npm start
```

The bot stores authentication data in the configured `sessions` directory. Never publish or share `creds.json`, device keys, or any other session files: they can give access to the connected WhatsApp account.

## Commands

The default prefix is `^`, so a command looks like `^ping`. The prefix can be changed by the owner with `^setprefix !`.

Use the bot's menu command to view the active commands and categories. The currently active plugin categories include:

- **General:** `alive`, `ping`, `speed`, `uptime`, `runtime`, `baileys`
- **AI:** `vision`, `imagine`, `tts`, `shazam`, `text2music`, `text2video`, `lyricsgen`, `speechwriter`
- **Download:** `play`, `video`, `tiktok`, `instagram`, `facebook`, `twitter`, `spotify`, `soundcloud`, `pinterest`, `capcut`, `applemusic`, `mediafire`, `telegram`, `apk`
- **Group:** `groupinfo`, `admins`, `promote`, `demote`, `kick`, `add`, `tagall`, `hidetag`, `group`, `mute`, `unmute`, `gname`, `gdesc`, `gpic`, `kickall`, `gid`, `del`
- **Owner:** `mode`, `public`, `self`, `owner`, `setprefix`, `setbio`, `setname`, `setpp`, `join`, `block`, `unblock`, `eval`, `exec`, `restart`
- **Settings:** `antilink`, `addsudo`, `delsudo`, `sudolist`, `settings`
- **Search:** `images`, `reverseimage`, `lyrics`, `biblesearch`, `stickersearch`, `tgs`, `movsearch`, `iguser`
- **Tools:** `translate`, `tempmail`, `inbox`, `fancy`, `ssweb`, `ip`, `onwa`, `pp`, `walink`, `tempnumber`, `github`, `ascii`, `exchange`
- **News:** `news`, `footballnews`
- **Movies:** `movie`, `trailer`, `ibox`, `dramabox`, `actor`
- **Spiritual:** `bible`, `hymn`, `adventist`, `surahlist`, `surah`
- **Education:** `dictionary`, `poem`
- **Fun and random:** `meme`, `quoteaudio`, `randomvid`, `randomncs`, `randombible`, `inspirobot`

Aliases are also available. For example, `^ping`, `^speed`, and `^latency` provide related status or response checks where supported.

## Owner controls

The configured owner can use the following administration commands:

```text
^owner              Show owner and bot information
^mode                View the current public/self mode
^public              Allow everyone to use the bot
^self                Restrict the bot to the owner and permitted users
^setprefix !         Change the command prefix
^setname Zynex Bot   Change the bot profile name
^setbio Your bio     Change the bot profile bio
^setpp <image-url>   Change the bot profile picture
^addsudo <number>    Add a sudo user
^delsudo <number>    Remove a sudo user
^sudolist            List sudo users
^restart             Restart the bot process
```

Commands such as `^eval` and `^exec` execute JavaScript or shell code and are restricted to the owner. Do not grant owner or sudo access to untrusted users.

## Configuration

Edit [`settings/config.js`](settings/config.js) to customize the bot name, owner number, channel, session directory, default mode, sticker metadata, and API settings. The default command prefix is stored in [`settings/prefix.json`](settings/prefix.json).

The most important settings are:

```js
owner: "254717459770",
botNumber: "254717459770",
session: "sessions",
sessionUrl: "https://session.lordeagle.tech",
sessionPrefix: "Zynex~",
status: {
  public: true,
  terminal: true
}
```

For private/self mode, set `status.public` to `false` or use the owner command `^self` after the bot connects.

## Adding a plugin

1. Create a new `.js` file in [`plugins/`](plugins/).
2. Export a command object with `command`, `category`, and `execute`.
3. Restart the bot or use the reload functionality when available.

Example:

```js
module.exports = {
  command: 'hello',
  aliases: ['hi'],
  category: 'general',
  description: 'Reply with a greeting',
  execute: async (sock, m, { reply }) => {
    await reply('Hello from Zynex Bot!');
  }
};
```

## Project structure

```text
├── index.js              # WhatsApp connection and startup
├── message.js            # Message handling and plugin loader
├── settings/config.js    # Bot and owner configuration
├── settings/prefix.json  # Current command prefix
├── plugins/              # Active command plugins
├── plugins_disabled/     # Disabled or archived plugins
├── library/              # Shared helpers and services
├── thumbnail/            # Bot media assets
└── sessions/             # Local WhatsApp authentication data
```

## Credits

- **Project and bot:** [Lordeagle Tech](https://github.com/lordeagle-tech)
- **Original base author:** Debraj
- **WhatsApp library:** [Baileys](https://github.com/WhiskeySockets/Baileys)

## Disclaimer

This project is provided for educational and personal automation purposes. Use it responsibly and follow WhatsApp's terms of service. You are responsible for the account connected to the bot and for any commands or content sent through it.

## License

This project is released under the MIT License. See [`package.json`](package.json) for the project metadata.
