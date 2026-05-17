'use strict';
const path      = require('path');
const os        = require('os');
const chalk     = require('chalk');

const SESSION_PATH = path.join(os.homedir(), '.shellmax', 'sessions', 'whatsapp');

let _client = null;
let _ready  = false;

// ─── INIT / CONNECT ───────────────────────────────────────────────────────────
async function init() {
  if (_client && _ready) return _client;

  const { Client, LocalAuth } = require('whatsapp-web.js');
  const qrcode = require('qrcode-terminal');

  _client = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    },
  });

  return new Promise((resolve, reject) => {
    process.stdout.write(chalk.gray('\n  Connecting to WhatsApp…\n'));

    _client.on('qr', (qr) => {
      process.stdout.write(chalk.cyan('\n  Scan this QR code with WhatsApp on your phone:\n\n'));
      qrcode.generate(qr, { small: true });
      process.stdout.write(chalk.gray('\n  Waiting for scan…\n'));
    });

    _client.on('ready', () => {
      _ready = true;
      process.stdout.write(chalk.green('  ✔  WhatsApp connected!\n\n'));
      resolve(_client);
    });

    _client.on('auth_failure', (msg) => reject(new Error(`WhatsApp auth failed: ${msg}`)));
    _client.on('disconnected', () => { _ready = false; _client = null; });

    _client.initialize().catch(reject);
  });
}

// ─── FIND CHAT ────────────────────────────────────────────────────────────────
async function findChat(wa, raw) {
  // Strip accidental angle brackets e.g. <Hamsafar> -> Hamsafar
  const nameOrNumber = raw.replace(/^<+|>+$/g, '').trim();

  // Phone number
  if (/^\+?\d[\d\s\-]{5,}$/.test(nameOrNumber)) {
    const num = nameOrNumber.replace(/\D/g, '');
    return `${num}@c.us`;
  }

  const query = nameOrNumber.toLowerCase();

  // 1. Search contacts (name / pushname / shortName)
  const contacts = await wa.getContacts();
  const contact  = contacts.find((c) =>
    (c.name      && c.name.toLowerCase().includes(query)) ||
    (c.pushname  && c.pushname.toLowerCase().includes(query)) ||
    (c.shortName && c.shortName.toLowerCase().includes(query))
  );
  if (contact) return contact.id._serialized;

  // 2. Search open chats (catches contacts not in phonebook)
  const chats = await wa.getChats();
  const chat  = chats.find((ch) => ch.name && ch.name.toLowerCase().includes(query));
  if (chat) return chat.id._serialized;

  throw new Error(
    `Contact "${nameOrNumber}" not found.\n  Try the number:  msg wa +91XXXXXXXXXX your message`
  );
}

// ─── SEND ─────────────────────────────────────────────────────────────────────
async function send(nameOrNumber, text) {
  const wa   = await init();
  const chat = await findChat(wa, nameOrNumber);
  await wa.sendMessage(chat, text);
}

// ─── VIEW ─────────────────────────────────────────────────────────────────────
async function view(nameOrNumber) {
  const fs     = require('fs');
  const path   = require('path');
  const os     = require('os');
  const wa     = await init();
  const chatId = await findChat(wa, nameOrNumber);
  const chat   = await wa.getChatById(chatId);
  const msgs   = await chat.fetchMessages({ limit: 10 });

  const result = [];
  for (const m of msgs) {
    let body = m.body || '';

    if (m.hasMedia) {
      try {
        const media = await m.downloadMedia();
        if (media && media.data) {
          const ext      = (media.mimetype || 'image/jpeg').split('/')[1].split(';')[0];
          const fname    = `shellmax_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const tmpPath  = path.join(os.tmpdir(), fname);
          fs.writeFileSync(tmpPath, Buffer.from(media.data, 'base64'));
          body = `[${media.mimetype}]  →  ${tmpPath}`;
        } else {
          body = '[media - unavailable]';
        }
      } catch {
        body = body || '[media]';
      }
    }

    result.push({
      from: m.fromMe ? 'You' : (m._data.notifyName || nameOrNumber),
      body: body || '[empty]',
      time: new Date(m.timestamp * 1000).toLocaleTimeString(),
    });
  }
  return result;
}

// ─── CONNECT WIZARD ───────────────────────────────────────────────────────────
async function connect() {
  process.stdout.write(chalk.gray(
    '\n  WhatsApp uses your phone — no password needed.\n' +
    '  A QR code will appear. Scan it with WhatsApp → Linked Devices.\n\n'
  ));
  await init();
  return true;
}

module.exports = { init, send, view, connect };
