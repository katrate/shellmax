'use strict';
const readline = require('readline');
const chalk    = require('chalk');
const os       = require('os');
const inquirer = require('inquirer');

const { loadConfig, updateConfig, session } = require('./config');
const { handle }                            = require('./commands');
const { run, getCwd }                       = require('./executor');
const { openSettings }                      = require('./settings');
const { applyAccent, applyDim, applyBold }  = require('./themes');
const { startSepAnimation, stopSepAnimation, staticSep } = require('./logo');
const { figletAsync, clear, center, themeFn }            = require('./onboarding');

const ui = require('./ui');
const { box, header, separator, section, status, cmd, dim, accent, errorMsg, successMsg, helpCategory, logo, COLORS } = ui;

const MAX_HISTORY = 40;
let chatHistory = [];

function shortCwd() {
  return getCwd().replace(os.homedir(), '~');
}

function clearScreen() {
  process.stdout.write('\x1Bc');
}

function getTerminalWidth() {
  return process.stdout.columns || 80;
}

function wrapText(text, maxWidth) {
  const lines = text.split('\n');
  const wrapped = [];
  
  for (const line of lines) {
    if (line.length <= maxWidth) {
      wrapped.push(line);
    } else {
      let remaining = line;
      while (remaining.length > maxWidth) {
        wrapped.push(remaining.substring(0, maxWidth));
        remaining = remaining.substring(maxWidth);
      }
      if (remaining) wrapped.push(remaining);
    }
  }
  return wrapped;
}

function renderChat() {
  clearScreen();
  const w = getTerminalWidth();

  for (const msg of chatHistory) {
    if (msg.type === 'user') {
      const label = COLORS.accent('You');
      const lines = msg.text.split('\n');
      lines.forEach((line) => {
        process.stdout.write(label + '  ' + dim(line) + '\n');
      });
    } else if (msg.type === 'shellmax') {
      const label = COLORS.success('ShellMax');
      const lines = msg.text.split('\n');
      lines.forEach((line) => {
        process.stdout.write(label + '  ' + line + '\n');
      });
    } else {
      const label = COLORS.dim('•');
      const lines = msg.text.split('\n');
      lines.forEach((line) => {
        process.stdout.write(label + '  ' + line + '\n');
      });
    }
    process.stdout.write('\n');
  }

  process.stdout.write(separator() + '\n');
}

function addMessage(text, type) {
  chatHistory.push({ text, type });
  
  if (chatHistory.length > MAX_HISTORY) {
    chatHistory = chatHistory.slice(-MAX_HISTORY);
  }
}

async function printWelcome(cfg) {
  clearScreen();
  const { name, font } = cfg;
  const termW = process.stdout.columns || 80;

  const art = await figletAsync(`Welcome  ${name}`, font);
  const lines = art.split('\n').filter(line => line.trim() !== '').map(line => center(accent(line), termW)).join('\n');
  
  chatHistory = [];
  addMessage(lines, 'system');
  addMessage(`${accent('ℹ')}  ${dim('Type')} ${accent('help')} ${dim('for ShellMax commands')}`, 'system');
  
  renderChat();
}

function handleRename(input, cfg) {
  const m = input.trim().match(/^name\s+(.+)/i);
  if (!m) return false;
  const newName = m[1].trim();
  updateConfig({ name: newName });
  addMessage(successMsg(`Name changed to "${newName}"`), 'shellmax');
  return true;
}

async function startTerminal(cfg) {
  await printWelcome(cfg);

  async function loop() {
    const current = loadConfig();
    
    try {
      const { input } = await inquirer.prompt([{
        type: 'input',
        name: 'input',
        message: '',
        prefix: COLORS.accent('▸ ') + dim(''),
        suffix: dim(' >')
      }]);

      const trimmed = (input || '').trim();

      if (!trimmed) {
        return loop();
      }

      addMessage(trimmed, 'user');
      renderChat();

      if (handleRename(trimmed, current)) {
        renderChat();
        return loop();
      }

      const result = await handle(trimmed, () => openSettings(), null);

      if (result.output) {
        addMessage(result.output, 'output');
      }

      if (result.reload) {
        await printWelcome(loadConfig());
        return loop();
      }

      if (result.exit) {
        addMessage(box('Goodbye! Thanks for using ShellMax', { border: 'accent' }), 'shellmax');
        renderChat();
        stopSepAnimation();
        process.exit(0);
      }

      if (result.relaunch) {
        stopSepAnimation();
        process.exit(0);
      }

      if (!result.handled) {
        const shellOutput = await run(trimmed, null);
        if (shellOutput) {
          addMessage(shellOutput, 'output');
        }
      }

      renderChat();
      return loop();
    } catch (err) {
      if (err.message && err.message.includes('closed')) {
        stopSepAnimation();
        process.exit(0);
      }
      addMessage(errorMsg('Error: ' + err.message), 'shellmax');
      renderChat();
      return loop();
    }
  }

  process.on('SIGINT', () => {
    stopSepAnimation();
    process.stdout.write('\n');
  });

  loop();
}

module.exports = { startTerminal };