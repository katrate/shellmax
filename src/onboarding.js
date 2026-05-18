'use strict';
const readline = require('readline');
const figlet   = require('figlet');
const inquirer = require('inquirer');

const { updateConfig, loadConfig } = require('./config');
const { PLATFORMS, connectPlatform } = require('./messaging/index');
const { animateLogo } = require('./logo');
const { applyAccent, applyDim, applyPrimary } = require('./themes');

function clear() { process.stdout.write('\x1Bc'); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function figletAsync(text, font) {
  return new Promise((res) => {
    figlet.text(text, { font: font || 'Slant' }, (err, data) => res(err ? text : data));
  });
}

function center(text, termW) {
  return text.split('\n').map((line) => {
    const raw = line.replace(/\x1B\[[0-9;]*m/g, '');
    const pad = Math.max(0, Math.floor((termW - raw.length) / 2));
    return ' '.repeat(pad) + line;
  }).join('\n');
}

function ask(rl, q) { return new Promise((res) => rl.question(q, res)); }

function line(char, len) { return char.repeat(len); }

// ─── LOGO SCREEN ─────────────────────────────────────────────────────────────
async function showLogoScreen(cfg) {
  clear();
  const theme = cfg.theme || 'midnight';
  const colorFn = (s) => applyPrimary(theme, s);
  const termH = process.stdout.rows || 24;
  const topPad = Math.max(1, Math.floor(termH / 2) - 5);
  process.stdout.write('\n'.repeat(topPad));
  await animateLogo(3080, colorFn, []);
  await sleep(250);
}

// ─── SEPARATOR ───────────────────────────────────────────────────────────────
function sep(theme, width = 60) {
  const bar = line('─', width);
  return applyDim(theme, bar);
}

// ─── NAME STEP ────────────────────────────────────────────────────────────────
async function askName(cfg) {
  const theme = cfg.theme || 'midnight';
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  clear();
  console.log('\n');
  console.log('  ' + sep(theme));
  console.log();
  console.log('  ' + applyPrimary(theme, 'What should I call you?'));
  console.log();
  console.log('  ' + sep(theme));
  console.log();

  const rawName = await ask(rl, applyDim(theme, '  > '));
  const name = rawName.trim() || 'User';

  rl.close();
  return name;
}

// ─── FILE ACCESS STEP ──────────────────────────────────────────────────────────
async function askFileAccess(cfg) {
  const theme = cfg.theme || 'midnight';
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  clear();
  console.log('\n');
  console.log('  ' + sep(theme));
  console.log();
  console.log('  ' + applyPrimary(theme, 'File Access'));
  console.log();
  console.log('  ' + applyDim(theme, 'ShellMax needs file access to run commands'));
  console.log('  ' + applyDim(theme, 'in your working directory and home folder.'));
  console.log();
  console.log('  ' + sep(theme));
  console.log();

  const raw = await ask(rl, applyDim(theme, '  Allow file access? (y/n) > '));
  const allow = raw.trim().toLowerCase() !== 'n';

  rl.close();
  return allow;
}

// ─── MESSAGING STEP ───────────────────────────────────────────────────────────
async function askMessaging(cfg) {
  const theme = cfg.theme || 'midnight';
  const w = process.stdout.columns || 80;

  clear();
  console.log('\n');
  console.log('  ' + sep(theme, w - 4));
  console.log();
  console.log('  ' + applyPrimary(theme, 'Connect Messaging Apps (Optional)'));
  console.log();
  console.log('  ' + applyDim(theme, 'Select which apps you want to connect.'));
  console.log('  ' + applyDim(theme, 'You can skip this and connect later via st > Connected Accounts.'));
  console.log();
  console.log('  ' + sep(theme, w - 4));

  const choices = PLATFORMS.map(p => ({
    name: `  ${p.label}`,
    value: p.id
  }));
  choices.push({ name: '  Skip for now', value: 'skip' });

  const { platforms } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'platforms',
    message: '',
    choices: choices,
    pageSize: 10
  }]);

  return platforms;
}

// ─── WELCOME SCREEN ───────────────────────────────────────────────────────────
async function showWelcome(name, cfg) {
  const theme = cfg.theme || 'midnight';
  const termW = process.stdout.columns || 80;
  const termH = process.stdout.rows || 24;
  const topPad = Math.max(1, Math.floor(termH / 2) - 2);

  clear();
  process.stdout.write('\n'.repeat(topPad));
  console.log(center(applyPrimary(theme, 'Welcome ') + applyDim(theme, name), termW));
  console.log();
  console.log(center(applyDim(theme, 'Premium Terminal Experience'), termW));
  await sleep(1000);
  clear();
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function onboard() {
  const cfg = loadConfig();

  if (cfg.name) {
    return cfg;
  }

  // Step 1: Logo
  await showLogoScreen(cfg);

  // Step 2: Name
  const name = await askName(cfg);

  // Step 3: File access
  const fileAccess = await askFileAccess(cfg);

  // Step 4: Save basic config
  updateConfig({ name, fileAccess });

  // Step 5: Messaging (optional)
  const selected = await askMessaging(cfg);

  if (selected && selected.length > 0 && !selected.includes('skip')) {
    console.log('\n');
    for (const id of selected) {
      const p = PLATFORMS.find(x => x.id === id);
      if (p) {
        const theme = cfg.theme || 'midnight';
        console.log('  ' + applyDim(theme, `Connecting ${p.label}...`));
        try {
          await connectPlatform(id);
          console.log('  ' + applyPrimary(theme, `  ✓ ${p.label} connected`));
        } catch (e) {
          console.log('  ' + applyDim(theme, `  ✗ ${p.label} failed: ${e.message}`));
        }
      }
    }
    await sleep(500);
  }

  const newCfg = loadConfig();
  await showWelcome(name, newCfg);

  return newCfg;
}

module.exports = { onboard, figletAsync, clear, center, sleep };