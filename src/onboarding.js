'use strict';
const readline = require('readline');
const figlet   = require('figlet');
const inquirer = require('inquirer');

const { updateConfig, loadConfig } = require('./config');
const { onboardingConnect, PLATFORMS, connectPlatform } = require('./messaging/index');
const { animateLogo, staticSep }   = require('./logo');
const { applyAccent, applyDim, applyBold, applyPrimary } = require('./themes');

// ─── UTILS ───────────────────────────────────────────────────────────────────
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

// ─── LOGO SCREEN ─────────────────────────────────────────────────────────────
async function showLogoScreen(cfg) {
  clear();
  const termW   = process.stdout.columns || 80;
  const theme   = cfg.theme || 'midnight';
  const colorFn = (s) => applyPrimary(theme, s);
  const dimFn   = (s) => applyDim(theme, s);
  const accentFn = (s) => applyAccent(theme, s);

  const termH = process.stdout.rows || 24;
  const topPad = Math.max(1, Math.floor(termH / 2) - 5);
  process.stdout.write('\n'.repeat(topPad));

  await animateLogo(3080, colorFn, []);
  await sleep(250);
}

// ─── WELCOME SCREEN ───────────────────────────────────────────────────────────
async function showWelcomeScreen(name, cfg) {
  clear();
  const termW = process.stdout.columns || 80;
  const theme = cfg.theme || 'midnight';
  const colorFn = (s) => applyPrimary(theme, s);
  const dimFn = (s) => applyDim(theme, s);

  const termH = process.stdout.rows || 24;
  const topPad = Math.max(1, Math.floor(termH / 2) - 2);
  process.stdout.write('\n'.repeat(topPad));

  process.stdout.write(center(colorFn('Welcome ') + dimFn(name), termW) + '\n\n');
  process.stdout.write(center(dimFn('Premium Terminal Experience'), termW) + '\n');

  await sleep(800);
  clear();
}

// ─── MAIN ONBOARDING ─────────────────────────────────────────────────────────
async function onboard() {
  const cfg = loadConfig();
  const theme = cfg.theme || 'midnight';

  if (cfg.name) {
    return cfg;
  }

  await showLogoScreen(cfg);
  clear();

  const termW   = process.stdout.columns || 80;
  const bar     = applyDim(theme, '━'.repeat(Math.min(termW - 4, 58)));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  process.stdout.write('\n\n  ' + bar + '\n');
  process.stdout.write('  ' + applyAccent(theme, 'What should I call you?') + '\n');
  process.stdout.write('  ' + bar + '\n');
  const rawName = await ask(rl, applyDim(theme, '  → '));
  const name    = rawName.trim() || 'User';

  process.stdout.write('\n  ' + bar + '\n');
  process.stdout.write('  ' + applyDim(theme, 'ShellMax needs file access to run commands in your\n'));
  process.stdout.write('  ' + applyDim(theme, 'working directory and home folder.\n'));
  process.stdout.write('  ' + bar + '\n');
  const accRaw     = await ask(rl, applyDim(theme, '  Allow file access? (y/n) → '));
  const fileAccess = accRaw.trim().toLowerCase() !== 'n';

  rl.close();

  updateConfig({ name, fileAccess });

  await onboardingConnect(true);

  const newCfg = loadConfig();
  await showWelcomeScreen(name, newCfg);
  return newCfg;
}

module.exports = { onboard, figletAsync, clear, center, sleep };
