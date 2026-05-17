'use strict';
const chalk = require('chalk');

// ─── LOGO T-REX — 3 running frames (multi-line pixel art) ────────────────────
//   Uses full-block █, half-blocks ▄▀, and ● for the eye
//   Each frame is an array of lines (same length for clean swapping)

const LOGO_FRAMES = [
  // Frame 0 – standing / left foot back
  [
    '            ▄██████▄            ',
    '           ████████████         ',
    '          ████●████████▌        ',
    '         ████████████████       ',
    '   ▄▄  ████████████████████▄    ',
    '  ████████████████████████████  ',
    '   ▀▀  █████████████████████▀   ',
    '          ████████████          ',
    '            ████████            ',
    '           ██      ██           ',
    '           █        █           ',
  ],
  // Frame 1 – mid stride
  [
    '            ▄██████▄            ',
    '           ████████████         ',
    '          ████●████████▌        ',
    '         ████████████████       ',
    '   ▄▄  ████████████████████▄    ',
    '  ████████████████████████████  ',
    '   ▀▀  █████████████████████▀   ',
    '          ████████████          ',
    '            ████████            ',
    '           ████  ███            ',
    '           ███    █             ',
  ],
  // Frame 2 – right foot back
  [
    '            ▄██████▄            ',
    '           ████████████         ',
    '          ████●████████▌        ',
    '         ████████████████       ',
    '   ▄▄  ████████████████████▄    ',
    '  ████████████████████████████  ',
    '   ▀▀  █████████████████████▀   ',
    '          ████████████          ',
    '            ████████            ',
    '           ████████             ',
    '            █    ██             ',
  ],
];

// ─── SEPARATOR MINI T-REX — 2 frames, 5 chars wide (walks along ━━━ line) ────
//
//   ╓─╖·   body = ╓─╖,  eye = ·,  leg alternates between ╙ and ╜
//   We render these IN the separator line so the dino runs along the bar.

const SEP_FRAMES = [
  '▄█▄·╷',   // frame 0 – left leg   (5 chars)
  '▄█▄·╵',   // frame 1 – right leg  (5 chars)
];
const SEP_FRAME_WIDTH = 5;   // must equal SEP_FRAMES[n].length

// ─── RENDER LOGO FRAME ────────────────────────────────────────────────────────
// Returns a colored, centered string for one frame of the logo T-Rex.
function renderLogoFrame(frameIdx, themeColorFn) {
  const frame = LOGO_FRAMES[frameIdx % LOGO_FRAMES.length];
  const termW = process.stdout.columns || 80;

  return frame.map((line) => {
    const rawLen = line.length;
    const pad    = Math.max(0, Math.floor((termW - rawLen) / 2));

    // Color the eye separately (white dot)
    const colored = line.replace('●', chalk.white.bold('●'));
    const body    = themeColorFn(colored);

    return ' '.repeat(pad) + body;
  }).join('\n');
}

// ─── ANIMATE LOGO (used during onboarding logo screen) ───────────────────────
// Draws the T-Rex + ShellMax title, animates for `durationMs`, then resolves.
function animateLogo(durationMs, themeColorFn, titleLines) {
  return new Promise((resolve) => {
    const termW  = process.stdout.columns || 80;
    let   frame  = 0;
    const totalH = LOGO_FRAMES[0].length + 1 + (titleLines ? titleLines.length : 0);

    // Hide cursor during animation
    process.stdout.write('\x1B[?25l');

    function draw() {
      // Move cursor to top of our block if not first draw
      if (frame > 0) {
        process.stdout.write(`\x1B[${totalH}A`); // up N lines
      }

      // Draw T-Rex frame
      process.stdout.write(renderLogoFrame(frame, themeColorFn) + '\n');

      // Draw title lines (figlet ShellMax + subtitle)
      if (titleLines) {
        titleLines.forEach((l) => {
          const raw = l.replace(/\x1B\[[0-9;]*m/g, '');
          const pad = Math.max(0, Math.floor((termW - raw.length) / 2));
          process.stdout.write(' '.repeat(pad) + l + '\n');
        });
      }

      frame++;
    }

    // First draw
    draw();

    const iv = setInterval(draw, 280);

    setTimeout(() => {
      clearInterval(iv);
      process.stdout.write('\x1B[?25h'); // restore cursor
      resolve();
    }, durationMs);
  });
}

// ─── SEPARATOR ANIMATION (walks along the ━ bar above the input prompt) ───────
//
//  Call `startSepAnimation(theme)` after printing the top separator.
//  It returns a `stop()` function – call it before processing a command.
//
//  Technique: save cursor → go up 1 line → rewrite separator → restore cursor.
//  Works because readline's input cursor is on the line BELOW the separator.

let _sepTimer   = null;
let _sepPos     = 0;
let _sepFrame   = 0;
let _sepRunning = false;

function buildSepLine(themeColorFn, pos, frameIdx) {
  const width  = Math.min(process.stdout.columns || 80, 100);
  const mini   = SEP_FRAMES[frameIdx % SEP_FRAMES.length];
  const miniW  = SEP_FRAME_WIDTH;

  // Clamp position so dino doesn't overflow
  const safePos = Math.min(pos, width - miniW);

  const before = '━'.repeat(safePos);
  const after  = '━'.repeat(Math.max(0, width - safePos - miniW));

  return themeColorFn(before) + chalk.yellowBright(mini) + themeColorFn(after);
}

function startSepAnimation(themeColorFn) {
  if (_sepRunning) stopSepAnimation();
  _sepRunning = true;

  const width = (process.stdout.columns || 80) - 1;

  _sepTimer = setInterval(() => {
    if (!_sepRunning) return;

    const line = buildSepLine(themeColorFn, _sepPos, _sepFrame);

    // Save cursor → up 1 → col 1 → write separator → restore
    process.stdout.write('\x1B[s');          // save pos
    process.stdout.write('\x1B[1A\r');       // up 1 line, col 1
    process.stdout.write(line);              // rewrite separator
    process.stdout.write('\x1B[u');          // restore pos

    _sepPos   = (_sepPos + 2) % (width - SEP_FRAME_WIDTH);
    _sepFrame++;
  }, 140);
}

function stopSepAnimation() {
  _sepRunning = false;
  if (_sepTimer) { clearInterval(_sepTimer); _sepTimer = null; }
}

// ─── STATIC SEPARATOR (no animation, used as bottom sep or fallback) ─────────
function staticSep(themeColorFn) {
  const width = (process.stdout.columns || 80) - 1;
  return themeColorFn('━'.repeat(width));
}

module.exports = {
  LOGO_FRAMES,
  SEP_FRAMES,
  animateLogo,
  renderLogoFrame,
  startSepAnimation,
  stopSepAnimation,
  staticSep,
};
