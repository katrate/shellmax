'use strict';
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const CONFIG_DIR  = path.join(os.homedir(), '.shellmax');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG = {
  name:        null,
  theme:       'midnight',
  textColor:   'cyan',
  font:        'Doom',
  fileAccess:  false,
  workspaces:  {},   // { wsName: ['appOrSite', ...] }
  websites:    {},   // { siteName: 'https://...' }
};

// Session-only (not persisted)
const session = { adminMode: false };

function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function loadConfig() {
  ensureDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    saveConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(cfg) {
  ensureDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function updateConfig(updates) {
  const cfg = { ...loadConfig(), ...updates };
  saveConfig(cfg);
  return cfg;
}

module.exports = { loadConfig, saveConfig, updateConfig, session, CONFIG_DIR };
