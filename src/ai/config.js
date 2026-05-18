'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.shellmax');
const AI_CONFIG_FILE = path.join(CONFIG_DIR, 'ai-config.json');

const DEFAULT_AI_CONFIG = {
  openrouterApiKey: null,
  tavilyApiKey: null,
  mainModel: 'openai/gpt-oss-120b:free',
  searchModel: 'google/gemma-4-26b-a4b-it:free',
  searchEnabled: true,
};

function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function loadAiConfig() {
  ensureDir();
  if (!fs.existsSync(AI_CONFIG_FILE)) {
    saveAiConfig(DEFAULT_AI_CONFIG);
    return { ...DEFAULT_AI_CONFIG };
  }
  try {
    return { ...DEFAULT_AI_CONFIG, ...JSON.parse(fs.readFileSync(AI_CONFIG_FILE, 'utf8')) };
  } catch {
    return { ...DEFAULT_AI_CONFIG };
  }
}

function saveAiConfig(cfg) {
  ensureDir();
  fs.writeFileSync(AI_CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function updateAiConfig(updates) {
  const cfg = { ...loadAiConfig(), ...updates };
  saveAiConfig(cfg);
  return cfg;
}

function hasOpenRouterKey() {
  const cfg = loadAiConfig();
  return !!(cfg.openrouterApiKey && cfg.openrouterApiKey.length > 0);
}

function hasTavilyKey() {
  const cfg = loadAiConfig();
  return !!(cfg.tavilyApiKey && cfg.tavilyApiKey.length > 0);
}

module.exports = {
  loadAiConfig,
  saveAiConfig,
  updateAiConfig,
  hasOpenRouterKey,
  hasTavilyKey,
  AI_CONFIG_FILE,
};