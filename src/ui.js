'use strict';
const chalk = require('chalk');
const { applyAccent, applyDim, applyPrimary } = require('./themes');

const COLORS = {
  accent: chalk.hex('#A855F7'),
  accentBright: chalk.hex('#C084FC'),
  secondary: chalk.cyan,
  dim: chalk.gray,
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  text: chalk.white,
  textDim: chalk.gray,
  border: chalk.hex('#6366F1'),
  borderDim: chalk.hex('#4B5563'),
  purple: chalk.hex('#A855F7'),
  pink: chalk.hex('#EC4899'),
  cyan: chalk.cyan,
};

const ICONS = {
  terminal: '◆',
  arrow: '▸',
  check: '✔',
  cross: '✖',
  info: 'ℹ',
  star: '★',
  folder: '📁',
  file: '📄',
  spark: '⚡',
};

const BOX_STYLES = {
  rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', v: '│', h: '─' },
  double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', v: '║', h: '═' },
  heavy: { tl: '┏', tr: '┓', bl: '┗', br: '┛', v: '┃', h: '━' },
  light: { tl: '┌', tr: '┐', bl: '└', br: '┘', v: '│', h: '─' },
};

function box(content, opts = {}) {
  const { style = 'rounded', title = '', padding = 1, border = 'dim', theme = 'midnight' } = opts;
  const b = BOX_STYLES[style] || BOX_STYLES.rounded;
  const borderFn = border === 'accent' ? (s) => applyAccent(theme, s) : (s) => applyDim(theme, s);
  
  const lines = content.split('\n');
  const maxLen = Math.max(...lines.map(l => strip(l).length), title.length);
  const width = maxLen + (padding * 2) + 2;
  
  let result = '';
  result += borderFn(b.tl) + b.h.repeat(width - 2) + borderFn(b.tr) + '\n';
  
  if (title) {
    const titlePad = Math.max(0, width - 4 - strip(title).length);
    const leftPad = Math.floor(titlePad / 2);
    const rightPad = titlePad - leftPad;
    result += borderFn(b.v) + ' ' + applyAccent(theme, title) + ' '.repeat(leftPad + rightPad) + ' ' + borderFn(b.v) + '\n';
    result += borderFn(b.v) + b.h.repeat(width - 2) + borderFn(b.v) + '\n';
  }
  
  for (const line of lines) {
    const pad = width - 2 - strip(line).length;
    result += borderFn(b.v) + ' '.repeat(padding) + line + ' '.repeat(padding) + ' '.repeat(pad) + borderFn(b.v) + '\n';
  }
  
  result += borderFn(b.bl) + b.h.repeat(width - 2) + borderFn(b.br);
  return result;
}

function strip(str) {
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

function header(title, theme = 'midnight') {
  const w = (process.stdout.columns || 80) - 1;
  const line = applyDim(theme, '─'.repeat(w));
  return `\n${applyAccent(theme, '╭')}${applyDim(theme, '─'.repeat(w - 2))}${applyAccent(theme, '╮')}\n` +
         `${applyDim(theme, '│')} ${applyAccent(theme, title)}${' '.repeat(w - strip(title).length - 3)}${applyDim(theme, '│')}\n` +
         `${applyAccent(theme, '╰')}${line}${applyAccent(theme, '╯')}`;
}

function separator(theme = 'midnight') {
  const w = (process.stdout.columns || 80) - 1;
  return applyDim(theme, '─'.repeat(w));
}

function section(title, content, theme = 'midnight') {
  return header(title, theme) + '\n' + content + '\n';
}

function status(msg, type = 'info', theme = 'midnight') {
  const icons = { success: '✔', error: '✖', warning: '⚠', info: 'ℹ' };
  const colorFns = {
    success: (s) => applyPrimary(theme, s),
    error: (s) => applyAccent(theme, s),
    warning: (s) => applyAccent(theme, s),
    info: (s) => applyPrimary(theme, s)
  };
  const fn = colorFns[type] || colorFns.info;
  return `  ${fn(icons[type])} ${fn(msg)}`;
}

function cmd(input, theme = 'midnight') {
  return `${applyAccent(theme, '▸')} ${applyPrimary(theme, input)}`;
}

function dim(text, theme = 'midnight') {
  return applyDim(theme, text);
}

function accent(text, theme = 'midnight') {
  return applyAccent(theme, text);
}

function errorMsg(msg, theme = 'midnight') {
  return `  ${applyAccent(theme, '✖')} ${applyAccent(theme, msg)}`;
}

function successMsg(msg, theme = 'midnight') {
  return `  ${applyPrimary(theme, '✔')} ${applyPrimary(theme, msg)}`;
}

function promptBox(input, theme = 'midnight') {
  const w = Math.min(process.stdout.columns || 80, 70);
  const promptText = `${applyAccent(theme, '◆')} ${applyPrimary(theme, 'ShellMax')} ${applyDim(theme, '│')}`;
  const inputArea = applyPrimary(theme, input || '');
  const border = applyDim(theme, '─'.repeat(w - 2));
  
  return `\n${applyDim(theme, '┌')}${border}${applyDim(theme, '┐')}\n` +
         `${applyDim(theme, '│')} ${promptText} ${inputArea}${' '.repeat(Math.max(0, w - strip(promptText).length - strip(input || '').length - 3))}${applyDim(theme, '│')}\n` +
         `${applyDim(theme, '└')}${border}${applyDim(theme, '┘')}`;
}

function helpCategory(title, commands, theme = 'midnight') {
  let result = `\n${applyAccent(theme, '▸')} ${applyAccent(theme, title)}\n`;
  result += applyDim(theme, '─'.repeat(40)) + '\n';
  commands.forEach(([cmd, desc]) => {
    result += `  ${applyAccent(theme, cmd.padEnd(28))} ${applyDim(theme, desc)}\n`;
  });
  return result;
}

function logo(text, theme = 'midnight') {
  return applyAccent(theme, text);
}

module.exports = {
  COLORS,
  ICONS,
  box,
  header,
  separator,
  section,
  status,
  cmd,
  dim,
  accent,
  errorMsg,
  successMsg,
  promptBox,
  helpCategory,
  logo,
};