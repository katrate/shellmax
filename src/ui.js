'use strict';
const chalk = require('chalk');

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
  const { style = 'rounded', title = '', padding = 1, border = 'dim' } = opts;
  const b = BOX_STYLES[style] || BOX_STYLES.rounded;
  const borderFn = border === 'accent' ? COLORS.accent : COLORS.borderDim;
  
  const lines = content.split('\n');
  const maxLen = Math.max(...lines.map(l => strip(l).length), title.length);
  const width = maxLen + (padding * 2) + 2;
  
  let result = '';
  result += borderFn(b.tl) + b.h.repeat(width - 2) + borderFn(b.tr) + '\n';
  
  if (title) {
    const titlePad = Math.max(0, width - 4 - strip(title).length);
    const leftPad = Math.floor(titlePad / 2);
    const rightPad = titlePad - leftPad;
    result += borderFn(b.v) + ' ' + COLORS.accentBright.bold(title) + ' '.repeat(leftPad + rightPad) + ' ' + borderFn(b.v) + '\n';
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

function header(title) {
  const w = (process.stdout.columns || 80) - 1;
  const line = COLORS.borderDim('─'.repeat(w));
  return `\n${COLORS.accent('╭')}${COLORS.borderDim('─'.repeat(w - 2))}${COLORS.accent('╮')}\n` +
         `${COLORS.borderDim('│')} ${COLORS.accentBright.bold(title)}${' '.repeat(w - strip(title).length - 3)}${COLORS.borderDim('│')}\n` +
         `${COLORS.accent('╰')}${line}${COLORS.accent('╯')}`;
}

function separator() {
  const w = (process.stdout.columns || 80) - 1;
  return COLORS.borderDim('─'.repeat(w));
}

function section(title, content) {
  return header(title) + '\n' + content + '\n';
}

function status(msg, type = 'info') {
  const icons = { success: '✔', error: '✖', warning: '⚠', info: 'ℹ' };
  const colors = { success: COLORS.success, error: COLORS.error, warning: COLORS.warning, info: COLORS.secondary };
  return `  ${colors[type](icons[type])} ${colors[type](msg)}`;
}

function cmd(input) {
  return `${COLORS.accent('▸')} ${COLORS.text(input)}`;
}

function dim(text) {
  return COLORS.dim(text);
}

function accent(text) {
  return COLORS.accent(text);
}

function errorMsg(msg) {
  return `  ${COLORS.error('✖')} ${COLORS.error(msg)}`;
}

function successMsg(msg) {
  return `  ${COLORS.success('✔')} ${COLORS.success(msg)}`;
}

function promptBox(input) {
  const w = Math.min(process.stdout.columns || 80, 70);
  const promptText = `${COLORS.accent('◆')} ${COLORS.text('ShellMax')} ${COLORS.dim('│')}`;
  const inputArea = COLORS.cyan(input || '');
  const border = COLORS.borderDim('─'.repeat(w - 2));
  
  return `\n${COLORS.borderDim('┌')}${border}${COLORS.borderDim('┐')}\n` +
         `${COLORS.borderDim('│')} ${promptText} ${inputArea}${' '.repeat(Math.max(0, w - strip(promptText).length - strip(input || '').length - 3))}${COLORS.borderDim('│')}\n` +
         `${COLORS.borderDim('└')}${border}${COLORS.borderDim('┘')}`;
}

function helpCategory(title, commands) {
  let result = `\n${COLORS.accent('▸')} ${COLORS.accentBright.bold(title)}\n`;
  result += COLORS.dim('─'.repeat(40)) + '\n';
  commands.forEach(([cmd, desc]) => {
    result += `  ${COLORS.accent(cmd.padEnd(28))} ${COLORS.dim(desc)}\n`;
  });
  return result;
}

function logo(text) {
  return COLORS.accentBright.bold(text);
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