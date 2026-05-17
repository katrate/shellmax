'use strict';
const chalk    = require('chalk');
const readline = require('readline');
const inquirer = require('inquirer');
const { loadConfig, updateConfig } = require('../config');
const { applyAccent, applyDim, applyPrimary, applySecondary } = require('../themes');

const PLATFORMS = [
  { id: 'wa',   label: 'WhatsApp',  emoji: '📱', mod: () => require('./whatsapp')  },
  { id: 'dc',   label: 'Discord',   emoji: '🎮', mod: () => require('./discord')   },
  { id: 'tg',   label: 'Telegram',  emoji: '✈️ ', mod: () => require('./telegram')  },
  { id: 'mail', label: 'Gmail',     emoji: '📧', mod: () => require('./gmail')     },
  { id: 'slack',label: 'Slack',     emoji: '💬', mod: () => require('./slack')     },
  { id: 'teams',label: 'Teams',     emoji: '👥', mod: () => require('./teams')     },
];

function getThemeColors() {
  const cfg = loadConfig();
  return {
    primary: (s) => applyPrimary(cfg.theme, s),
    accent: (s) => applyAccent(cfg.theme, s),
    dim: (s) => applyDim(cfg.theme, s),
    secondary: (s) => applySecondary(cfg.theme, s),
  };
}

// ─── PRINT HELPERS ───────────────────────────────────────────────────────────
const ok  = (m) => { const c = getThemeColors(); process.stdout.write(`  ${c.primary('✔')}  ${c.accent(m)}\n`); };
const err = (m) => process.stdout.write(chalk.red(`  ✖  ${m}\n`));
const inf = (m) => { const c = getThemeColors(); process.stdout.write(`  ${c.dim(m)}\n`); };
const ui = require('../ui');
const { COLORS, accent, dim } = ui;

// ─── IS CONNECTED ─────────────────────────────────────────────────────────────
function isConnected(platformId) {
  const cfg = loadConfig();
  return !!(cfg.connected && cfg.connected[platformId]);
}

function setConnected(platformId, value) {
  const cfg = loadConfig();
  updateConfig({ connected: { ...(cfg.connected || {}), [platformId]: value } });
}

// ─── CONNECT ONE PLATFORM ─────────────────────────────────────────────────────
async function connectPlatform(platformId) {
  const p = PLATFORMS.find((x) => x.id === platformId);
  if (!p) throw new Error(`Unknown platform: ${platformId}`);
  const c = getThemeColors();

  process.stdout.write(`\n  ${c.primary('◆')}  ${c.accent(`Connecting ${p.label}…`)}\n`);
  try {
    await p.mod().connect();
    setConnected(platformId, true);
    ok(`${p.label} connected!`);
    return true;
  } catch (e) {
    err(`${p.label} connection failed: ${e.message}`);
    return false;
  }
}

// ─── ONBOARDING WIZARD ───────────────────────────────────────────────────────
async function onboardingWizard() {
  console.log();
  const choices = PLATFORMS.map(p => ({
    name: ` ${p.emoji}  ${dim(p.label)}`,
    value: p.id
  }));

  choices.push(new inquirer.Separator());
  choices.push({ name: accent('Skip for later'), value: 'skip' });

  const { selected } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: accent('Connect messaging apps (Space to toggle, Enter to confirm)'),
      choices: choices,
      prefix: COLORS.accent('◆')
    }
  ]);

  if (!selected || selected.length === 0) {
    return [];
  }

  return selected.filter(s => s !== 'skip');
}

// ─── RUN ONBOARDING MESSAGING STEP ───────────────────────────────────────────
async function onboardingConnect() {
  const toConnect = await onboardingWizard();
  if (toConnect.length === 0) {
    inf('Skipped. You can connect apps later via:  st → Connected Accounts');
    return;
  }

  for (const id of toConnect) {
    const p = PLATFORMS.find(x => x.id === id);
    console.log();

    const { connectNow } = await inquirer.prompt([
      {
        type: 'list',
        name: 'connectNow',
        message: accent(`Connect ${p.emoji} ${p.label} now?`),
        choices: [
          { name: accent('Yes, connect now'), value: 'connect' },
          { name: dim('Skip for later'), value: 'skip' },
          { name: dim('Go back'), value: 'back' }
        ],
        prefix: COLORS.accent('◆')
      }
    ]);

    if (connectNow === 'back') {
      return await onboardingConnect();
    }

    if (connectNow === 'skip') {
      inf(`${p.label} skipped. You can connect later via settings.`);
      continue;
    }

    await connectPlatform(id);
    console.log();
  }
}

// ─── RENDER MESSAGES ─────────────────────────────────────────────────────────
function renderMessages(msgs, title) {
  if (!msgs.length) { inf('No messages found.'); return; }
  process.stdout.write(`\n  ${chalk.cyan('◆')}  ${chalk.bold(title)}\n`);
  process.stdout.write(`  ${chalk.gray('─'.repeat(60))}\n`);
  msgs.forEach((m) => {
    const from = chalk.cyan(m.from.padEnd(16));
    const time = chalk.gray(m.time);
    process.stdout.write(`  ${from}  ${time}\n`);
    process.stdout.write(`  ${chalk.white(m.body)}\n\n`);
  });
}

// ─── PARSE QUOTED ARGS ───────────────────────────────────────────────────────
// Splits a string respecting "quoted phrases" as single tokens.
// msg wa "John Doe" hello there  →  ['John Doe', 'hello there']
// msg wa katrate hello           →  ['katrate', 'hello']
// msg dc "My Server" #general Hi →  ['My Server', '#general', 'Hi']
function parseArgs(str) {
  const tokens = [];
  let current  = '';
  let inQuote  = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"' || ch === "'") {
      inQuote = !inQuote;
    } else if (ch === ' ' && !inQuote) {
      if (current) { tokens.push(current); current = ''; }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

// ─── MSG COMMAND ──────────────────────────────────────────────────────────────
// Syntax:
//   msg wa "John Doe" hello there
//   msg wa katrate    hello there
//   msg dc "My Server" #general  hello
//   msg dc username   hello
//   msg tg @username  hello
//   msg ig username   hello
async function handleMsg(parts) {
  const prefix = parts[1]?.toLowerCase();
  if (!prefix) {
    err('Usage: msg wa|dc|tg|ig|slack|teams "Name or number" text');
    return;
  }

  if (!isConnected(prefix)) {
    err(`${prefix} is not connected. Type: connect ${prefix}`);
    return;
  }

  // Re-parse the raw input after the platform prefix to respect quotes
  const rawAfterPrefix = parts.slice(2).join(' ');
  const args           = parseArgs(rawAfterPrefix);

  if (args.length < 2) {
    err('Usage: msg wa|dc|tg|ig "Name or number" your message text');
    return;
  }

  try {
    if (prefix === 'wa') {
      const name = args[0];
      const text = args.slice(1).join(' ');
      await require('./whatsapp').send(name, text);
      ok(`WhatsApp → ${name}: ${text}`);

    } else if (prefix === 'dc') {
      // msg dc "Server Name" #channel text   OR   msg dc username text
      if (args[1] && args[1].startsWith('#')) {
        const [server, channel, ...textParts] = args;
        await require('./discord').sendChannel(server, channel, textParts.join(' '));
        ok(`Discord → ${server} ${channel}: ${textParts.join(' ')}`);
      } else {
        const [username, ...textParts] = args;
        await require('./discord').sendDM(username, textParts.join(' '));
        ok(`Discord DM → ${username}: ${textParts.join(' ')}`);
      }

    } else if (prefix === 'tg') {
      const [username, ...textParts] = args;
      await require('./telegram').send(username, textParts.join(' '));
      ok(`Telegram → ${username}: ${textParts.join(' ')}`);

    } else if (prefix === 'ig') {
      const [username, ...textParts] = args;
      await require('./instagram').send(username, textParts.join(' '));
      ok(`Instagram → ${username}: ${textParts.join(' ')}`);

    } else if (prefix === 'slack') {
      const [channel, ...textParts] = args;
      const isChannel = channel?.startsWith('#');
      await require('./slack').send(channel, textParts.join(' '), isChannel);
      ok(`Slack → ${channel}: ${textParts.join(' ')}`);

    } else if (prefix === 'teams') {
      const [target, ...textParts] = args;
      const isChannel = target?.startsWith('#');
      await require('./teams').send(target, textParts.join(' '), isChannel);
      ok(`Teams → ${target}: ${textParts.join(' ')}`);

    } else {
      err(`Unknown platform: ${prefix}. Use wa, dc, tg, ig, slack, teams`);
    }
  } catch (e) {
    err(e.message);
  }
}

// ─── MAIL COMMAND ─────────────────────────────────────────────────────────────
// mail <email> <subject> <body> [filepath]
async function handleMail(parts) {
  if (parts.length < 4) {
    err('Usage: mail <email> <subject> <body> [filepath]');
    return;
  }
  if (!isConnected('mail')) {
    err('Gmail not connected. Type: connect mail');
    return;
  }
  const [, email, subject, body, filepath] = parts;
  try {
    await require('./gmail').send(email, subject, body, filepath);
    ok(`Email sent to ${email}`);
  } catch (e) {
    err(e.message);
  }
}

// ─── VIEW COMMAND ─────────────────────────────────────────────────────────────
// view wa "John Doe"
// view dc "Server Name" #general
// view tg @username
// view ig username
// view someone@gmail.com
async function handleView(parts) {
  const prefix = parts[1]?.toLowerCase();

  // view <email@...> → gmail
  if (prefix && prefix.includes('@')) {
    if (!isConnected('mail')) { err('Gmail not connected.'); return; }
    try {
      const msgs = await require('./gmail').view(prefix);
      renderMessages(msgs, `Emails — ${prefix}`);
    } catch (e) { err(e.message); }
    return;
  }

  if (!prefix) {
    err('Usage: view wa|dc|tg|ig|slack|teams "Name"   or   view email@gmail.com');
    return;
  }

  if (!isConnected(prefix)) {
    err(`${prefix} is not connected. Type: connect ${prefix}`);
    return;
  }

  const rawAfterPrefix = parts.slice(2).join(' ');
  const args           = parseArgs(rawAfterPrefix);

  try {
    let msgs;
    if (prefix === 'wa') {
      const name = args[0];
      msgs = await require('./whatsapp').view(name);
      renderMessages(msgs, `WhatsApp — ${name}`);

    } else if (prefix === 'dc') {
      if (args[1] && args[1].startsWith('#')) {
        msgs = await require('./discord').viewChannel(args[0], args[1]);
        renderMessages(msgs, `Discord — ${args[0]} ${args[1]}`);
      } else {
        msgs = await require('./discord').viewDM(args[0]);
        renderMessages(msgs, `Discord DM — ${args[0]}`);
      }

    } else if (prefix === 'tg') {
      msgs = await require('./telegram').view(args[0]);
      renderMessages(msgs, `Telegram — ${args[0]}`);

    } else if (prefix === 'ig') {
      msgs = await require('./instagram').view(args[0]);
      renderMessages(msgs, `Instagram — ${args[0]}`);

    } else if (prefix === 'slack') {
      const isChannel = args[0]?.startsWith('#');
      msgs = await require('./slack').view(args[0], isChannel);
      renderMessages(msgs, `Slack — ${args[0]}`);

    } else if (prefix === 'teams') {
      const isChannel = args[0]?.startsWith('#');
      msgs = await require('./teams').view(args[0], isChannel);
      renderMessages(msgs, `Teams — ${args[0]}`);

    } else {
      err(`Unknown platform: ${prefix}`);
    }
  } catch (e) {
    err(e.message);
  }
}

module.exports = {
  PLATFORMS,
  isConnected,
  connectPlatform,
  onboardingConnect,
  handleMsg,
  handleMail,
  handleView,
};
