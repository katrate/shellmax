'use strict';
const readline = require('readline');
const figlet   = require('figlet');
const inquirer = require('inquirer');

const { updateConfig, loadConfig } = require('./config');
const { onboardingConnect, PLATFORMS, connectPlatform } = require('./messaging/index');
const { animateLogo, staticSep }   = require('./logo');
const { applyAccent, applyDim, applyBold, applyPrimary } = require('./themes');
const { COLORS, accent, dim } = require('./ui');

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

// ─── THEME COLOR FUNCTION ─────────────────────────────────────────────────────
function themeFn(id) {
  return (s) => applyPrimary(id, s);
}

function themeAccent(id) {
  return (s) => applyAccent(id, s);
}

function themeDim(id) {
  return (s) => applyDim(id, s);
}

// ─── LOGO SCREEN ─────────────────────────────────────────────────────────────
async function showLogoScreen(cfg) {
  clear();
  const termW   = process.stdout.columns || 80;
  const colorFn = themeFn(cfg.theme);
  const dimFn   = themeDim(cfg.theme);
  const accentFn = themeAccent(cfg.theme);

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
  const colorFn = themeFn(cfg.theme);
  const dimFn = themeDim(cfg.theme);

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

  if (cfg.name) {
    return cfg;
  }

  await showLogoScreen(cfg);
  clear();

  const termW   = process.stdout.columns || 80;
  const bar     = accent('━'.repeat(Math.min(termW - 4, 58)));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  process.stdout.write('\n\n  ' + bar + '\n');
  process.stdout.write('  ' + accent('What should I call you?') + '\n');
  process.stdout.write('  ' + bar + '\n');
  const rawName = await ask(rl, dim('  → '));
  const name    = rawName.trim() || 'User';

  process.stdout.write('\n  ' + bar + '\n');
  process.stdout.write('  ' + dim('ShellMax needs file access to run commands in your\n'));
  process.stdout.write('  ' + dim('working directory and home folder.\n'));
  process.stdout.write('  ' + bar + '\n');
  const accRaw     = await ask(rl, dim('  Allow file access? (y/n) → '));
  const fileAccess = accRaw.trim().toLowerCase() !== 'n';

  rl.close();

  updateConfig({ name, fileAccess });

  await onboardingConnect(true);

  const newCfg = loadConfig();
  await showWelcomeScreen(name, newCfg);
  return newCfg;
}

module.exports = { onboard, figletAsync, clear, center, themeFn, sleep };
