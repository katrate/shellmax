'use strict';
const readline = require('readline');
const chalk    = require('chalk');
const os       = require('os');
const inquirer = require('inquirer');

const { loadConfig, updateConfig, session } = require('./config');
const { handle }                            = require('./commands');
const { run, getCwd }                       = require('./executor');
const { openSettings }                      = require('./settings');
const { applyAccent, applyDim, applyBold, applyPrimary, applyTextColor } = require('./themes');
const { startSepAnimation, stopSepAnimation, staticSep } = require('./logo');
const { figletAsync, clear, center }        = require('./onboarding');

const ui = require('./ui');
const { box, header, separator, section, status, cmd, errorMsg, successMsg, helpCategory, logo } = ui;

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

function renderChat(cfg) {
  clearScreen();
  const theme = cfg.theme || 'midnight';
  const textColor = cfg.textColor || 'cyan';
  const w = getTerminalWidth();

  const primaryFn = (s) => applyTextColor(textColor, s);
  const accentFn = (s) => applyAccent(theme, s);
  const dimFn = (s) => applyDim(theme, s);

  for (const msg of chatHistory) {
    if (msg.type === 'user') {
      const label = accentFn('You');
      const lines = msg.text.split('\n');
      lines.forEach((line) => {
        process.stdout.write(label + '  ' + dimFn(line) + '\n');
      });
    } else if (msg.type === 'shellmax') {
      const label = primaryFn('ShellMax');
      const lines = msg.text.split('\n');
      lines.forEach((line) => {
        process.stdout.write(label + '  ' + primaryFn(line) + '\n');
      });
    } else {
      const label = dimFn('•');
      const lines = msg.text.split('\n');
      lines.forEach((line) => {
        process.stdout.write(label + '  ' + dimFn(line) + '\n');
      });
    }
    process.stdout.write('\n');
  }

  const sepLine = dimFn('─'.repeat(w));
  process.stdout.write(sepLine + '\n');
}

function addMessage(text, type) {
  chatHistory.push({ text, type });
  
  if (chatHistory.length > MAX_HISTORY) {
    chatHistory = chatHistory.slice(-MAX_HISTORY);
  }
}

async function printWelcome(cfg) {
  clearScreen();
  const { name, font, theme, textColor } = cfg;
  const termW = process.stdout.columns || 80;
  const tc = textColor || 'cyan';

  const art = await figletAsync(`Welcome  ${name}`, font);
  const lines = art.split('\n').filter(line => line.trim() !== '').map(line => center(applyTextColor(tc, line), termW)).join('\n');
  
  chatHistory = [];
  addMessage(lines, 'system');
  addMessage(`${applyAccent(theme, 'ℹ')}  ${applyDim(theme, 'Type')} ${applyAccent(theme, 'help')} ${applyDim(theme, 'for ShellMax commands')}`, 'system');
  
  renderChat(cfg);
}

function handleRename(input, cfg) {
  const m = input.trim().match(/^name\s+(.+)/i);
  if (!m) return false;
  const newName = m[1].trim();
  updateConfig({ name: newName });
  addMessage(successMsg(`Name changed to "${newName}"`, cfg.theme), 'shellmax');
  return true;
}

async function startTerminal(cfg) {
  await printWelcome(cfg);

  async function loop() {
    const current = loadConfig();
    const tc = current.textColor || 'cyan';
    
    try {
      const { input } = await inquirer.prompt([{
        type: 'input',
        name: 'input',
        message: '',
        prefix: applyAccent(current.theme, '▸ '),
        suffix: applyTextColor(tc, ' >')
      }]);

      const trimmed = (input || '').trim();

      if (!trimmed) {
        return loop();
      }

      addMessage(trimmed, 'user');
      renderChat(current);

      if (handleRename(trimmed, current)) {
        renderChat(current);
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
        addMessage(box('Goodbye! Thanks for using ShellMax', { border: 'accent', theme: current.theme }), 'shellmax');
        renderChat(current);
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

      renderChat(current);
      return loop();
    } catch (err) {
      if (err.message && err.message.includes('closed')) {
        stopSepAnimation();
        process.exit(0);
      }
      addMessage(errorMsg('Error: ' + err.message, current.theme), 'shellmax');
      renderChat(current);
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