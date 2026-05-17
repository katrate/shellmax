#!/usr/bin/env node
'use strict';

// This runs as a SEPARATE PROCESS spawned by ShellMax.
// It has full control of stdin/stdout — no readline conflicts possible.

const readline = require('readline');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');

const platform = process.argv[2];
if (!platform) { console.error('Usage: connect-wizard <platform>'); process.exit(1); }

const SESSIONS = path.join(os.homedir(), '.shellmax', 'sessions');
const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });

const rl  = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

async function main() {
  const chalk = require('chalk');

  // ── Gmail ────────────────────────────────────────────────────────────────
  if (platform === 'mail') {
    console.log(chalk.cyan('\n  Gmail — App Password setup'));
    console.log(chalk.gray('  1. myaccount.google.com → Security'));
    console.log(chalk.gray('  2. Enable 2-Step Verification'));
    console.log(chalk.gray('  3. Search "App Passwords" → create one for Mail'));
    console.log(chalk.gray('  4. Copy the 16-character password\n'));

    const email    = (await ask(chalk.gray('  Gmail address → '))).trim();
    const password = (await ask(chalk.gray('  App Password  → '))).trim().replace(/\s/g, '');

    if (!email || !password) throw new Error('Email and App Password are required');

    ensureDir(SESSIONS);
    fs.writeFileSync(path.join(SESSIONS, 'gmail.json'),
      JSON.stringify({ email, appPassword: password }, null, 2));
    console.log(chalk.green('\n  ✔  Gmail connected!\n'));
  }

  // ── Discord ──────────────────────────────────────────────────────────────
  else if (platform === 'dc') {
    console.log(chalk.cyan('\n  Discord — User Token'));
    console.log(chalk.gray('  1. Open Discord in Chrome → F12 → Network tab'));
    console.log(chalk.gray('  2. Send any message'));
    console.log(chalk.gray('  3. Click any request → Headers → copy "Authorization" value\n'));
    console.log(chalk.yellow('  ⚠  Using a user token is against Discord ToS.\n'));

    const token = (await ask(chalk.gray('  Paste token → '))).trim();
    if (!token) throw new Error('No token provided');

    ensureDir(SESSIONS);
    fs.writeFileSync(path.join(SESSIONS, 'discord.json'), JSON.stringify({ token }, null, 2));
    console.log(chalk.green('\n  ✔  Discord connected!\n'));
  }

  // ── Telegram ─────────────────────────────────────────────────────────────
  else if (platform === 'tg') {
    console.log(chalk.cyan('\n  Telegram — API credentials'));
    console.log(chalk.gray('  1. Go to https://my.telegram.org'));
    console.log(chalk.gray('  2. Log in → API Development Tools'));
    console.log(chalk.gray('  3. Create an app → copy API ID and API Hash\n'));

    const apiId   = (await ask(chalk.gray('  API ID    → '))).trim();
    const apiHash = (await ask(chalk.gray('  API Hash  → '))).trim();
    const phone   = (await ask(chalk.gray('  Phone number (+91...) → '))).trim();

    rl.close();

    const { TelegramClient } = require('telegram');
    const { StringSession }  = require('telegram/sessions');

    const sess   = new StringSession('');
    const client = new TelegramClient(sess, parseInt(apiId), apiHash, { connectionRetries: 3 });

    const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask2 = (q) => new Promise((res) => rl2.question(q, res));

    await client.start({
      phoneNumber: async () => phone,
      password:    async () => (await ask2(chalk.gray('  2FA password (blank if none) → '))).trim(),
      phoneCode:   async () => (await ask2(chalk.gray('  OTP from Telegram app → '))).trim(),
      onError:     (e)  => { throw e; },
    });
    rl2.close();

    const sessionStr = client.session.save();
    ensureDir(SESSIONS);
    fs.writeFileSync(path.join(SESSIONS, 'telegram.json'),
      JSON.stringify({ apiId, apiHash, session: sessionStr, phone }, null, 2));
    console.log(chalk.green('\n  ✔  Telegram connected!\n'));
    await client.disconnect();
  }

  // ── Instagram ────────────────────────────────────────────────────────────
  else if (platform === 'ig') {
    console.log(chalk.yellow('\n  ⚠  Instagram — unofficial API, avoid heavy usage.\n'));

    const username = (await ask(chalk.gray('  Instagram username → '))).trim();
    const password = (await ask(chalk.gray('  Password → '))).trim();
    rl.close();

    const { IgApiClient } = require('instagram-private-api');
    const ig = new IgApiClient();
    ig.state.generateDevice(username);
    await ig.account.login(username, password);
    const igSession = await ig.state.serialize();

    ensureDir(SESSIONS);
    fs.writeFileSync(path.join(SESSIONS, 'instagram.json'),
      JSON.stringify({ username, password, session: igSession }, null, 2));
    console.log(chalk.green('\n  ✔  Instagram connected!\n'));
  }

  // ── WhatsApp ─────────────────────────────────────────────────────────────
  else if (platform === 'wa') {
    rl.close();
    console.log(require('chalk').cyan('\n  WhatsApp — scan QR code with your phone'));
    console.log(require('chalk').gray('  WhatsApp → Linked Devices → Link a Device\n'));
    const { init } = require('./whatsapp');
    await init();
  }

  else {
    throw new Error(`Unknown platform: ${platform}. Use wa, dc, tg, mail, ig`);
  }

  try { rl.close(); } catch {}
  process.exit(0);
}

main().catch((e) => {
  const chalk = require('chalk');
  console.error(chalk.red(`\n  ✖  ${e.message}\n`));
  try { rl.close(); } catch {}
  process.exit(1);
});
