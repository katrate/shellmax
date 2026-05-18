'use strict';
const chalk = require('chalk');

chalk.level = 3;

// ─── 10 THEMES ────────────────────────────────────────────────────────────────
// Each theme defines chalk color keys (used via chalk[key] or chalk.hex(key))
const THEMES = [
  {
    id: 'midnight',  name: 'Midnight',
    primary:   (c) => c.cyan,
    secondary: (c) => c.white,
    accent:    (c) => c.magenta,
    dim:       (c) => c.gray,
    bold:      (c) => c.cyanBright.bold,
    desc: 'Deep dark with electric cyan glow',
  },
  {
    id: 'matrix',    name: 'Matrix',
    primary:   (c) => c.green,
    secondary: (c) => c.greenBright,
    accent:    (c) => c.greenBright,
    dim:       (c) => c.gray,
    bold:      (c) => c.greenBright.bold,
    desc: 'Classic hacker green on black',
  },
  {
    id: 'dracula',   name: 'Dracula',
    primary:   (c) => c.magenta,
    secondary: (c) => c.white,
    accent:    (c) => c.cyanBright,
    dim:       (c) => c.gray,
    bold:      (c) => c.magentaBright.bold,
    desc: 'Purple/pink dark fantasy',
  },
  {
    id: 'neonpunk',  name: 'Neon Punk',
    primary:   (c) => c.magentaBright,
    secondary: (c) => c.white,
    accent:    (c) => c.yellowBright,
    dim:       (c) => c.gray,
    bold:      (c) => c.magentaBright.bold,
    desc: 'Cyberpunk neon on black',
  },
  {
    id: 'ocean',     name: 'Ocean',
    primary:   (c) => c.blueBright,
    secondary: (c) => c.cyan,
    accent:    (c) => c.cyanBright,
    dim:       (c) => c.gray,
    bold:      (c) => c.cyanBright.bold,
    desc: 'Deep ocean electric blue',
  },
  {
    id: 'sunset',    name: 'Sunset',
    primary:   (c) => c.yellow,
    secondary: (c) => c.white,
    accent:    (c) => c.red,
    dim:       (c) => c.gray,
    bold:      (c) => c.yellowBright.bold,
    desc: 'Warm sunset orange and red',
  },
  {
    id: 'arctic',    name: 'Arctic',
    primary:   (c) => c.blueBright,
    secondary: (c) => c.white,
    accent:    (c) => c.whiteBright,
    dim:       (c) => c.gray,
    bold:      (c) => c.whiteBright.bold,
    desc: 'Cold crisp arctic blue',
  },
  {
    id: 'monokai',   name: 'Monokai',
    primary:   (c) => c.yellowBright,
    secondary: (c) => c.white,
    accent:    (c) => c.greenBright,
    dim:       (c) => c.gray,
    bold:      (c) => c.yellowBright.bold,
    desc: 'Classic code-editor Monokai',
  },
  {
    id: 'crimson',   name: 'Crimson',
    primary:   (c) => c.red,
    secondary: (c) => c.white,
    accent:    (c) => c.redBright,
    dim:       (c) => c.gray,
    bold:      (c) => c.redBright.bold,
    desc: 'Deep red dark theme',
  },
  {
    id: 'nord',      name: 'Nord',
    primary:   (c) => c.blue,
    secondary: (c) => c.white,
    accent:    (c) => c.cyanBright,
    dim:       (c) => c.gray,
    bold:      (c) => c.blueBright.bold,
    desc: 'Nordic dark blue',
  },
];

// ─── 20 TEXT COLORS ───────────────────────────────────────────────────────────
const TEXT_COLORS = [
  { id: 'white',        name: 'White',          apply: (c) => c.white },
  { id: 'cyan',         name: 'Cyan',           apply: (c) => c.cyan },
  { id: 'lime',         name: 'Lime',           apply: (c) => c.greenBright },
  { id: 'magenta',      name: 'Magenta',        apply: (c) => c.magenta },
  { id: 'yellow',       name: 'Yellow',         apply: (c) => c.yellow },
  { id: 'red',          name: 'Red',            apply: (c) => c.red },
  { id: 'orange',       name: 'Orange',         apply: (c) => c.hex('#FF8C00') },
  { id: 'skyblue',      name: 'Sky Blue',       apply: (c) => c.hex('#87CEEB') },
  { id: 'pink',         name: 'Pink',           apply: (c) => c.hex('#FF69B4') },
  { id: 'mint',         name: 'Mint',           apply: (c) => c.hex('#98FF98') },
  { id: 'gold',         name: 'Gold',           apply: (c) => c.hex('#FFD700') },
  { id: 'coral',        name: 'Coral',          apply: (c) => c.hex('#FF6B6B') },
  { id: 'lavender',     name: 'Lavender',       apply: (c) => c.hex('#E6E6FA') },
  { id: 'teal',         name: 'Teal',           apply: (c) => c.hex('#008B8B') },
  { id: 'violet',       name: 'Violet',         apply: (c) => c.hex('#EE82EE') },
  { id: 'peach',        name: 'Peach',          apply: (c) => c.hex('#FFCBA4') },
  { id: 'rose',         name: 'Rose',           apply: (c) => c.hex('#FF007F') },
  { id: 'silver',       name: 'Silver',         apply: (c) => c.hex('#C0C0C0') },
  { id: 'hotpink',      name: 'Hot Pink',       apply: (c) => c.hex('#FF1493') },
  { id: 'electricblue', name: 'Electric Blue',  apply: (c) => c.hex('#0050FF') },
];

// ─── 30 FIGLET FONTS ──────────────────────────────────────────────────────────
const FONTS = [
  { id: 'slant',       name: 'Slant'        },
  { id: 'standard',    name: 'Standard'     },
  { id: 'big',         name: 'Big'          },
  { id: 'block',       name: 'Block'        },
  { id: 'doom',        name: 'Doom'         },
  { id: 'shadow',      name: 'Shadow'       },
  { id: 'small',       name: 'Small'        },
  { id: 'mini',        name: 'Mini'         },
  { id: 'lean',        name: 'Lean'         },
  { id: 'digital',     name: 'Digital'      },
  { id: 'ogre',        name: 'Ogre'         },
  { id: 'thin',        name: 'Thin'         },
  { id: 'speed',       name: 'Speed'        },
  { id: 'bubble',      name: 'Bubble'       },
  { id: 'puffy',       name: 'Puffy'        },
  { id: 'epic',        name: 'Epic'         },
  { id: 'graffiti',    name: 'Graffiti'     },
  { id: 'ghost',       name: 'Ghost'        },
  { id: 'script',      name: 'Script'       },
  { id: 'banner',      name: 'Banner'       },
  { id: 'colossal',    name: 'Colossal'     },
  { id: 'gothic',      name: 'Gothic'       },
  { id: 'isometric1',  name: 'Isometric1'   },
  { id: 'roman',       name: 'Roman'        },
  { id: 'cosmic',      name: 'Cosmic'       },
  { id: 'mirror',      name: 'Mirror'       },
  { id: 'cyberlarge',  name: 'Cyberlarge'   },
  { id: 'larry3d',     name: 'Larry 3D'     },
  { id: 'nscript',     name: 'Nscript'      },
  { id: '3d',          name: '3-D'          },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getTheme(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

function getTextColor(id) {
  return TEXT_COLORS.find((c) => c.id === id) || TEXT_COLORS[0];
}

function getFont(id) {
  return FONTS.find((f) => f.id === id) || FONTS[0];
}

// Apply the current theme's primary color to a string
function applyPrimary(themeId, str) {
  const t = getTheme(themeId);
  return t.primary(chalk)(str);
}

function applySecondary(themeId, str) {
  const t = getTheme(themeId);
  return t.secondary(chalk)(str);
}

function applyAccent(themeId, str) {
  const t = getTheme(themeId);
  return t.accent(chalk)(str);
}

function applyDim(themeId, str) {
  const t = getTheme(themeId);
  return t.dim(chalk)(str);
}

function applyBold(themeId, str) {
  const t = getTheme(themeId);
  return t.bold(chalk)(str);
}

function applyTextColor(colorId, str) {
  const c = getTextColor(colorId);
  return c.apply(chalk)(str);
}

module.exports = {
  THEMES,
  TEXT_COLORS,
  FONTS,
  getTheme,
  getTextColor,
  getFont,
  applyPrimary,
  applySecondary,
  applyAccent,
  applyDim,
  applyBold,
  applyTextColor,
};
