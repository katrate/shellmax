'use strict';
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const chalk = require('chalk');

const CREDS_FILE = path.join(os.homedir(), '.shellmax', 'sessions', 'slack.json');

let _client = null;

function loadCreds() {
  try { return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8')); } catch { return null; }
}

function saveCreds(data) {
  fs.mkdirSync(path.dirname(CREDS_FILE), { recursive: true });
  fs.writeFileSync(CREDS_FILE, JSON.stringify(data, null, 2));
}

async function init() {
  if (_client) return _client;

  const creds = loadCreds();
  if (!creds || !creds.botToken) {
    throw new Error('Slack not connected. Run: connect slack');
  }

  const { WebClient } = require('@slack/web-api');
  _client = new WebClient(creds.botToken);

  try {
    await _client.auth.test();
  } catch (e) {
    _client = null;
    throw new Error('Slack token expired. Run: connect slack');
  }

  return _client;
}

async function send(channelOrUser, text, isChannel = true) {
  const slack = await init();

  let target = channelOrUser;

  if (!isChannel && !target.startsWith('@') && !target.startsWith('U')) {
    const users = await slack.users.list();
    const user = users.members.find(u =>
      u.name.toLowerCase() === channelOrUser.toLowerCase() ||
      (u.profile?.real_name && u.profile.real_name.toLowerCase() === channelOrUser.toLowerCase())
    );
    if (user) target = user.id;
    else throw new Error(`User "${channelOrUser}" not found`);
  }

  if (isChannel && !target.startsWith('#') && !target.startsWith('C')) {
    const channels = await slack.conversations.list();
    const chan = channels.channels.find(c =>
      c.name.toLowerCase() === channelOrUser.toLowerCase()
    );
    if (chan) target = chan.id;
    else throw new Error(`Channel "${channelOrUser}" not found`);
  }

  await slack.chat.postMessage({ channel: target, text });
}

async function view(channelOrUser, isChannel = true) {
  const slack = await init();

  let target = channelOrUser;

  if (!isChannel && !target.startsWith('U')) {
    const users = await slack.users.list();
    const user = users.members.find(u =>
      u.name.toLowerCase() === channelOrUser.toLowerCase() ||
      (u.profile?.real_name && u.profile.real_name.toLowerCase() === channelOrUser.toLowerCase())
    );
    if (!user) throw new Error(`User "${channelOrUser}" not found`);
    target = user.id;

    const result = await slack.conversations.list({ types: 'im', limit: 100 });
    const im = result.channels.find(c => c.user === target);
    if (!im) return [];

    const history = await slack.conversations.history({ channel: im.id, limit: 10 });
    return history.messages.reverse().map(m => ({
      from: m.user === target ? channelOrUser : 'You',
      body: m.text || '[message]',
      time: new Date(parseFloat(m.ts) * 1000).toLocaleTimeString(),
    }));
  }

  if (isChannel && !target.startsWith('C')) {
    const channels = await slack.conversations.list();
    const chan = channels.channels.find(c =>
      c.name.toLowerCase() === channelOrUser.toLowerCase()
    );
    if (!chan) throw new Error(`Channel "${channelOrUser}" not found`);
    target = chan.id;
  }

  const history = await slack.conversations.history({ channel: target, limit: 10 });
  const users = (await slack.users.list()).members;
  const getName = (id) => {
    const u = users.find(x => x.id === id);
    return u ? (u.profile?.real_name || u.name) : id;
  };

  return history.messages.reverse().map(m => ({
    from: getName(m.user),
    body: m.text || '[message]',
    time: new Date(parseFloat(m.ts) * 1000).toLocaleTimeString(),
  }));
}

async function connect() {
  const { ask } = require('../prompt');

  process.stdout.write(chalk.cyan('\n  Slack setup requires a Slack App with Bot Token.\n'));
  process.stdout.write(chalk.gray(
    '  1. Go to https://api.slack.com/apps\n' +
    '  2. Create a new app (From scratch)\n' +
    '  3. Add Bot Token Scopes: chat:write, channels:read, users:read, conversations:read\n' +
    '  4. Install to workspace\n' +
    '  5. Copy the Bot User OAuth Token (starts with xoxb-)\n\n'
  ));

  const botToken = await ask(chalk.gray('  Bot Token (xoxb-...) → '));

  const { WebClient } = require('@slack/web-api');
  const testClient = new WebClient(botToken.trim());

  try {
    const auth = await testClient.auth.test();
    process.stdout.write(chalk.green(`  ✔  Connected as @${auth.user}\n`));
  } catch (e) {
    throw new Error('Invalid token. Check your Slack App settings.');
  }

  saveCreds({ botToken: botToken.trim() });
  _client = testClient;
  return true;
}

module.exports = { init, send, view, connect };