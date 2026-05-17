'use strict';
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const chalk = require('chalk');

const CREDS_FILE = path.join(os.homedir(), '.shellmax', 'sessions', 'telegram.json');

let _client = null;

// ─── STORAGE ──────────────────────────────────────────────────────────────────
function loadCreds() {
  try { return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8')); } catch { return null; }
}

function saveCreds(data) {
  fs.mkdirSync(path.dirname(CREDS_FILE), { recursive: true });
  fs.writeFileSync(CREDS_FILE, JSON.stringify(data, null, 2));
}

// ─── PROMPT HELPER ────────────────────────────────────────────────────────────
function ask(rl, q) { return new Promise((res) => rl.question(q, res)); }

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
  if (_client) return _client;

  const creds = loadCreds();
  if (!creds) throw new Error('Telegram not connected. Run: connect tg');

  const { TelegramClient }  = require('telegram');
  const { StringSession }   = require('telegram/sessions');

  const session = new StringSession(creds.session || '');
  _client = new TelegramClient(session, parseInt(creds.apiId), creds.apiHash, {
    connectionRetries: 3,
  });

  await _client.connect();
  return _client;
}

// ─── SEND ─────────────────────────────────────────────────────────────────────
async function send(usernameOrPhone, text) {
  const tg = await init();
  await tg.sendMessage(usernameOrPhone, { message: text });
}

// ─── VIEW ─────────────────────────────────────────────────────────────────────
async function view(usernameOrPhone) {
  const tg   = await init();
  const msgs = await tg.getMessages(usernameOrPhone, { limit: 10 });
  return msgs.reverse().map((m) => ({
    from:  m.out ? 'You' : (m.sender?.firstName || usernameOrPhone),
    body:  m.text || '[media]',
    time:  new Date(m.date * 1000).toLocaleTimeString(),
  }));
}

// ─── CONNECT WIZARD ───────────────────────────────────────────────────────────
async function connect() {
  const { ask } = require('../prompt');
  process.stdout.write(chalk.cyan('\n  Telegram setup requires API credentials.\n'));
  process.stdout.write(chalk.gray(
    '  1. Go to https://my.telegram.org\n' +
    '  2. Log in with your phone number\n' +
    '  3. Click "API Development Tools"\n' +
    '  4. Create an app — copy API ID and API Hash\n\n'
  ));

  const apiId   = await ask(chalk.gray('  API ID    → '));
  const apiHash = await ask(chalk.gray('  API Hash  → '));
  const phone   = await ask(chalk.gray('  Your phone number (+91...) → '));

  const { TelegramClient }  = require('telegram');
  const { StringSession }   = require('telegram/sessions');

  const tgSession = new StringSession('');
  const client    = new TelegramClient(tgSession, parseInt(apiId), apiHash.trim(), {
    connectionRetries: 3,
  });

  await client.start({
    phoneNumber:   async () => phone.trim(),
    password:      async () => await ask(chalk.gray('  2FA password (leave blank if none) → ')),
    phoneCode:     async () => await ask(chalk.gray('  OTP sent to your Telegram → ')),
    onError:       (err) => { throw err; },
  });

  const sessionStr = client.session.save();
  saveCreds({ apiId: apiId.trim(), apiHash: apiHash.trim(), session: sessionStr, phone: phone.trim() });

  _client = client;
  return true;
}

module.exports = { init, send, view, connect };
