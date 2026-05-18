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
const MAX_COMMAND_HISTORY = 50;
let chatHistory = [];
let commandHistory = [];
let commandHistoryIndex = -1;
let aiInstance = null;
let aiReady = false;

async function getAI() {
  if (!aiInstance) {
    const ShellMaxAI = require('./ai/index');
    aiInstance = new ShellMaxAI();
    await aiInstance.init().catch(() => {});
  }
  return aiInstance;
}

function shortCwd() {
  return getCwd().replace(os.homedir(), '~');
}

function clearScreen() {
  process.stdout.write('\x1Bc');
}

function getTerminalWidth() {
  return process.stdout.columns || 80;
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
    const text = msg.text || '';
    const lines = text.split('\n');
    
    if (msg.type === 'user') {
      const label = accentFn('You');
      process.stdout.write(label + '  ' + dimFn(lines[0]));
      for (let i = 1; i < lines.length; i++) {
        process.stdout.write('\n' + dimFn('          ') + dimFn(lines[i]));
      }
      process.stdout.write('\n');
    } else if (msg.type === 'ai') {
      const label = accentFn('AI');
      process.stdout.write(label + '  ' + primaryFn(lines[0]));
      for (let i = 1; i < lines.length; i++) {
        process.stdout.write('\n' + primaryFn('          ') + primaryFn(lines[i]));
      }
      process.stdout.write('\n');
    } else if (msg.type === 'shellmax') {
      const label = primaryFn('ShellMax');
      process.stdout.write(label + '  ' + primaryFn(lines[0]));
      for (let i = 1; i < lines.length; i++) {
        process.stdout.write('\n' + primaryFn('              ') + primaryFn(lines[i]));
      }
      process.stdout.write('\n');
    } else {
      const label = dimFn('•');
      process.stdout.write(label + '  ' + dimFn(lines[0]));
      for (let i = 1; i < lines.length; i++) {
        process.stdout.write('\n' + dimFn('          ') + dimFn(lines[i]));
      }
      process.stdout.write('\n');
    }
  }
  process.stdout.write('\x1B[0m'); // Reset colors

  const sepLine = dimFn('─'.repeat(w));
  process.stdout.write(sepLine + '\n');
}

function addMessage(text, type) {
  if (!text || typeof text !== 'string') {
    console.error('addMessage called with invalid text:', text, 'type:', type);
    text = '(empty)';
  }
  chatHistory.push({ text: String(text), type });
  
  if (chatHistory.length > MAX_HISTORY) {
    chatHistory = chatHistory.slice(-MAX_HISTORY);
  }
}

let thinkingInterval = null;
let thinkingCancelled = false;
let thinkingAbortController = null;

function showThinking(theme, textColor) {
  const dots = ['.', '..', '...'];
  let i = 0;
  
  process.stdout.write('\n');
  thinkingInterval = setInterval(() => {
    process.stdout.write(`\r${applyAccent(theme, '  AI')}${applyDim(theme, dots[i])}   `);
    i = (i + 1) % 3;
  }, 400);
  
  return thinkingInterval;
}

function clearThinking() {
  if (thinkingInterval) {
    clearInterval(thinkingInterval);
    thinkingInterval = null;
  }
  thinkingCancelled = false;
  process.stdout.write('\r' + ' '.repeat(80) + '\r');
}

function cancelThinking() {
  if (thinkingInterval) {
    thinkingCancelled = true;
    clearThinking();
    return true;
  }
  return false;
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
  addMessage(`${applyAccent(theme, 'ℹ')}  Everything goes to AI by default`, 'system');
  addMessage(`${applyDim(theme, '/')}  ${applyDim(theme, 'Use')} ${applyAccent(theme, '/help')} ${applyDim(theme, 'for commands')}   ${applyDim(theme, '*')}  ${applyDim(theme, 'Run terminal commands like')} ${applyAccent(theme, '*ls')} ${applyDim(theme, 'or')} ${applyAccent(theme, '*ping google.com')}`, 'system');
  
  renderChat(cfg);
}

async function startTerminal(cfg) {
  await printWelcome(cfg);

  const ai = await getAI();
  if (ai && !ai.error) {
    aiReady = true;
  }

  async function loop() {
    const current = loadConfig();
    const tc = current.textColor || 'cyan';

    const input = await new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        completer: (line) => [[], line]
      });

      let historyIdx = commandHistoryIndex;

      const prompt = `${applyAccent(current.theme, '▸ ')}${applyTextColor(tc, 'You')} > `;
      rl.setPrompt(prompt);
      rl.prompt(true);

      rl.on('line', (line) => {
        const trimmed = line.trim();
        rl.close();
        resolve(trimmed);
      });

      rl.on('keypress', (s, key) => {
        if (key.name === 'up' && commandHistory.length > 0) {
          if (historyIdx < commandHistory.length - 1) {
            historyIdx++;
          }
          rl.line = commandHistory[historyIdx];
          rl.cursor = rl.line.length;
          rl._refreshLine();
        } else if (key.name === 'down') {
          if (historyIdx > 0) {
            historyIdx--;
            rl.line = commandHistory[historyIdx];
          } else {
            historyIdx = -1;
            rl.line = '';
          }
          rl.cursor = rl.line.length;
          rl._refreshLine();
        }
      });
    });

    const trimmed = (input || '').trim();

    if (!trimmed) {
      return loop();
    }

    commandHistory.unshift(trimmed);
    if (commandHistory.length > MAX_COMMAND_HISTORY) {
      commandHistory.pop();
    }
    commandHistoryIndex = -1;

    addMessage(trimmed, 'user');

    // SHELLMAX COMMANDS (prefix: /)
    if (trimmed.startsWith('/')) {
      renderChat(current);

      const cmdStr = trimmed.slice(1).trim();

      if (cmdStr === 'help' || cmdStr === '/help') {
        const result = await handle('help', () => openSettings(), null);
        if (result.output) addMessage(result.output, 'shellmax');
        renderChat(current);
        return loop();
      }

      if (cmdStr === 'st' || cmdStr === 'settings') {
        const stdin = process.stdin;
        if (stdin.isRaw) stdin.setRawMode(false);
        const result = await openSettings();
        if (result && result.reloaded) {
          const newConfig = loadConfig();
          chatHistory = [];
          await printWelcome(newConfig);
        } else {
          renderChat(current);
        }
        return loop();
      }

      if (cmdStr === 'exit' || cmdStr === 'quit') {
        addMessage(box('Goodbye! Thanks for using ShellMax', { border: 'accent', theme: current.theme }), 'shellmax');
        renderChat(current);
        stopSepAnimation();
        const stdin = process.stdin;
        if (stdin.isRaw) stdin.setRawMode(false);
        process.exit(0);
      }

      const result = await handle(cmdStr, () => openSettings(), null);
      if (result.output) {
        addMessage(result.output, 'shellmax');
      }
      if (result.exit) {
        stopSepAnimation();
        process.exit(0);
      }

      renderChat(current);
      return loop();
    }

    // TERMINAL COMMANDS (prefix: *)
    if (trimmed.startsWith('*')) {
      renderChat(current);

      const shellCmd = trimmed.slice(1).trim();
      const shellOutput = await run(shellCmd, null);
      if (shellOutput) {
        addMessage(shellOutput, 'output');
      } else {
        addMessage(applyDim(current.theme, '(no output)'), 'output');
      }

      renderChat(current);
      return loop();
    }

    // DEFAULT: SEND TO AI
    renderChat(current);

    if (!aiReady) {
      addMessage(`${applyAccent(current.theme, '⚠')}  ${applyDim(current.theme, 'AI not configured. Run:')}`, 'shellmax');
      addMessage(`${applyAccent(current.theme, '    /ai config openrouter <your-api-key>')}`, 'shellmax');
      renderChat(current);
      return loop();
    }

    showThinking(current.theme, current.textColor);

    let response;
    let aiError = null;

    ai.chat(trimmed).then(r => { response = r; }).catch(e => { aiError = e; });

    function checkAI() {
      if (response !== undefined || aiError !== null) {
        clearThinking();
        if (aiError) {
          addMessage(`${applyAccent(current.theme, '✖')}  ${applyDim(current.theme, aiError.message)}`, 'shellmax');
        } else if (response) {
          addMessage(response, 'ai');
        } else {
          addMessage(`${applyDim(current.theme, '(no response)')}`, 'shellmax');
        }
        renderChat(current);
        loop();
        return;
      }

      setTimeout(checkAI, 50);
    }

    checkAI();
  }

  process.on('SIGINT', () => {
    const stdin = process.stdin;
    if (stdin.isRaw) stdin.setRawMode(false);
    stopSepAnimation();
    process.stdout.write('\n');
  });

  process.on('exit', () => {
    const stdin = process.stdin;
    if (stdin.isRaw) stdin.setRawMode(false);
  });

  loop();
}

module.exports = { startTerminal, addMessage };