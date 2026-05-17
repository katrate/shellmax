'use strict';
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const chalk = require('chalk');

const TOKEN_FILE = path.join(os.homedir(), '.shellmax', 'sessions', 'discord.json');

let _client = null;

// ─── LOAD TOKEN ───────────────────────────────────────────────────────────────
function loadToken() {
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')).token; } catch { return null; }
}

function saveToken(token) {
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token }));
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
  if (_client) return _client;

  const token = loadToken();
  if (!token) throw new Error('Discord not connected. Run: connect dc');

  const { Client } = require('discord.js-selfbot-v13');
  _client = new Client({ checkUpdate: false });

  return new Promise((resolve, reject) => {
    _client.once('ready', () => {
      process.stdout.write(chalk.gray(`  Discord: logged in as ${_client.user.tag}\n`));
      resolve(_client);
    });
    _client.login(token).catch(reject);
  });
}

// ─── SEND DM ──────────────────────────────────────────────────────────────────
async function sendDM(username, text) {
  const dc   = await init();
  const user = dc.users.cache.find(
    (u) => u.username.toLowerCase() === username.toLowerCase() ||
           u.tag.toLowerCase() === username.toLowerCase()
  ) || await dc.users.fetch(username).catch(() => null);

  if (!user) throw new Error(`Discord user "${username}" not found`);
  const dm = await user.createDM();
  await dm.send(text);
}

// ─── SEND TO CHANNEL ──────────────────────────────────────────────────────────
async function sendChannel(serverName, channelName, text) {
  const dc    = await init();
  const guild = dc.guilds.cache.find(
    (g) => g.name.toLowerCase().includes(serverName.toLowerCase())
  );
  if (!guild) throw new Error(`Server "${serverName}" not found`);

  const ch = guild.channels.cache.find(
    (c) => c.name.toLowerCase() === channelName.replace('#', '').toLowerCase() &&
           c.type === 'GUILD_TEXT'
  );
  if (!ch) throw new Error(`Channel "${channelName}" not found in ${guild.name}`);
  await ch.send(text);
}

// ─── VIEW DM ──────────────────────────────────────────────────────────────────
async function viewDM(username) {
  const dc   = await init();
  const user = dc.users.cache.find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
  if (!user) throw new Error(`User "${username}" not found`);

  const dm   = await user.createDM();
  const msgs = await dm.messages.fetch({ limit: 10 });
  return [...msgs.values()].reverse().map((m) => ({
    from: m.author.username,
    body: m.content || '[attachment]',
    time: m.createdAt.toLocaleTimeString(),
  }));
}

// ─── VIEW CHANNEL ─────────────────────────────────────────────────────────────
async function viewChannel(serverName, channelName) {
  const dc    = await init();
  const guild = dc.guilds.cache.find(
    (g) => g.name.toLowerCase().includes(serverName.toLowerCase())
  );
  if (!guild) throw new Error(`Server "${serverName}" not found`);

  const ch = guild.channels.cache.find(
    (c) => c.name.toLowerCase() === channelName.replace('#', '').toLowerCase()
  );
  if (!ch) throw new Error(`Channel "${channelName}" not found`);

  const msgs = await ch.messages.fetch({ limit: 10 });
  return [...msgs.values()].reverse().map((m) => ({
    from: m.author.username,
    body: m.content || '[attachment]',
    time: m.createdAt.toLocaleTimeString(),
  }));
}

// ─── CONNECT WIZARD ───────────────────────────────────────────────────────────
async function connect() {
  const { ask } = require('../prompt');
  process.stdout.write(chalk.cyan('\n  How to get your Discord token:\n'));
  process.stdout.write(chalk.gray(
    '  1. Open Discord in Chrome/Edge\n' +
    '  2. Press F12 → Network tab\n' +
    '  3. Send any message\n' +
    '  4. Find a request → Headers → look for "Authorization"\n' +
    '  5. Copy that value (starts with MTk... or OT...)\n\n'
  ));
  process.stdout.write(chalk.yellow('  ⚠  Using a user token is against Discord ToS.\n\n'));

  const token = await ask(chalk.gray('  Paste token → '));

  if (!token.trim()) throw new Error('No token provided');
  saveToken(token.trim());

  await init();
  return true;
}

module.exports = { init, sendDM, sendChannel, viewDM, viewChannel, connect };
