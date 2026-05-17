'use strict';
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const chalk = require('chalk');

const CREDS_FILE = path.join(os.homedir(), '.shellmax', 'sessions', 'instagram.json');

let _ig = null;

// ─── STORAGE ──────────────────────────────────────────────────────────────────
function loadCreds() {
  try { return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8')); } catch { return null; }
}

function saveCreds(data) {
  fs.mkdirSync(path.dirname(CREDS_FILE), { recursive: true });
  fs.writeFileSync(CREDS_FILE, JSON.stringify(data, null, 2));
}

function ask(rl, q) { return new Promise((res) => rl.question(q, res)); }

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
  if (_ig) return _ig;

  const creds = loadCreds();
  if (!creds) throw new Error('Instagram not connected. Run: connect ig');

  const { IgApiClient } = require('instagram-private-api');
  const ig = new IgApiClient();
  ig.state.generateDevice(creds.username);

  // Restore saved session
  if (creds.session) {
    await ig.state.deserialize(creds.session);
  }

  await ig.account.currentUser().catch(async () => {
    // Session expired — re-login
    await ig.account.login(creds.username, creds.password);
    creds.session = await ig.state.serialize();
    saveCreds(creds);
  });

  _ig = ig;
  return ig;
}

// ─── GET USER ID ──────────────────────────────────────────────────────────────
async function getUserId(ig, username) {
  const info = await ig.user.searchExact(username);
  return info.pk;
}

// ─── SEND ─────────────────────────────────────────────────────────────────────
async function send(username, text) {
  const ig     = await init();
  const userId = await getUserId(ig, username);
  const thread = ig.entity.directThread([userId.toString()]);
  await thread.broadcastText(text);
}

// ─── VIEW ─────────────────────────────────────────────────────────────────────
async function view(username) {
  const ig     = await init();
  const userId = await getUserId(ig, username);

  const threads   = ig.feed.directInbox();
  const firstPage = await threads.items();
  const thread    = firstPage.find(
    (t) => t.users && t.users.some((u) => u.pk === userId)
  );

  if (!thread) return [];

  return thread.items.slice(0, 10).reverse().map((m) => ({
    from: m.user_id === userId ? username : 'You',
    body: m.text || m.link?.text || '[media]',
    time: new Date(m.timestamp / 1000).toLocaleTimeString(),
  }));
}

// ─── CONNECT WIZARD ───────────────────────────────────────────────────────────
async function connect() {
  const { ask } = require('../prompt');
  process.stdout.write(chalk.yellow('\n  ⚠  Instagram Warning:\n'));
  process.stdout.write(chalk.gray(
    '  Using unofficial API. Low risk but not zero risk.\n' +
    '  Avoid sending too many messages too fast.\n\n'
  ));

  const username = await ask(chalk.gray('  Instagram username → '));
  const password = await ask(chalk.gray('  Password → '));

  const { IgApiClient } = require('instagram-private-api');
  const ig = new IgApiClient();
  ig.state.generateDevice(username.trim());

  await ig.account.login(username.trim(), password.trim());
  const session = await ig.state.serialize();

  saveCreds({ username: username.trim(), password: password.trim(), session });
  _ig = ig;

  return true;
}

module.exports = { init, send, view, connect };
