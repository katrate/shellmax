'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.shellmax');
const SESSION_FILE = path.join(CONFIG_DIR, 'session-memory.json');
const SAVED_FILE = path.join(CONFIG_DIR, 'saved-memory.json');

const MAX_SESSION_MESSAGES = 40;
const MAX_SUMMARY_MESSAGES = 10;

function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function loadJson(file) {
  ensureDir();
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function saveJson(file, data) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ─── SESSION MEMORY ───────────────────────────────────────────────────────────
// Lives during terminal session, stores conversation history

function initSession(name) {
  const session = {
    userName: name,
    messages: [],
    createdAt: new Date().toISOString(),
  };
  saveJson(SESSION_FILE, session);
  return session;
}

function loadSession() {
  const data = loadJson(SESSION_FILE);
  if (!data) return null;
  return data;
}

function addSessionMessage(role, content) {
  let session = loadSession();
  if (!session) {
    const { loadConfig } = require('../config');
    const cfg = loadConfig();
    session = initSession(cfg.name || 'User');
  }
  
  session.messages.push({
    role,
    content,
    timestamp: new Date().toISOString(),
  });
  
  if (session.messages.length > MAX_SESSION_MESSAGES) {
    const summarized = summarizeSession(session.messages);
    session.messages = summarized;
  }
  
  saveJson(SESSION_FILE, session);
  return session;
}

function summarizeSession(messages) {
  // Keep last MAX_SUMMARY_MESSAGES as is, summarize older ones
  const recent = messages.slice(-MAX_SUMMARY_MESSAGES);
  const older = messages.slice(0, -MAX_SUMMARY_MESSAGES);
  
  if (older.length === 0) return messages;
  
  const summary = older.filter(m => m && m.content).map(m => `${m.role}: ${m.content.substring(0, 100)}...`).join('\n');
  
  return [
    { role: 'system', content: `[Earlier conversation summarized: ${older.length} messages about: ${summary.substring(0, 200)}]`, timestamp: older[0].timestamp },
    ...recent,
  ];
}

function getSessionMessages() {
  const session = loadSession();
  if (!session) return [];
  return session.messages;
}

function clearSession() {
  if (fs.existsSync(SESSION_FILE)) {
    fs.unlinkSync(SESSION_FILE);
  }
}

// ─── SAVED MEMORY ────────────────────────────────────────────────────────────
// Persistent memory - preferences, facts, habits

function loadSavedMemory() {
  const data = loadJson(SAVED_FILE);
  if (!data) {
    return {
      preferences: {},
      facts: [],
      habits: [],
      lastUpdated: new Date().toISOString(),
    };
  }
  return data;
}

function saveSavedMemory(memory) {
  memory.lastUpdated = new Date().toISOString();
  saveJson(SAVED_FILE, memory);
}

function addSavedFact(fact) {
  const memory = loadSavedMemory();
  if (!memory.facts.includes(fact)) {
    memory.facts.push(fact);
    saveSavedMemory(memory);
  }
  return memory;
}

function updatePreference(key, value) {
  const memory = loadSavedMemory();
  memory.preferences[key] = value;
  saveSavedMemory(memory);
  return memory;
}

function getSavedMemory() {
  return loadSavedMemory();
}

function buildContextPrompt() {
  const saved = loadSavedMemory();
  const session = loadSession();
  
  let context = '';
  
  if (saved.preferences && Object.keys(saved.preferences).length > 0) {
    context += `\nUser Preferences:\n`;
    for (const [key, val] of Object.entries(saved.preferences)) {
      context += `- ${key}: ${val}\n`;
    }
  }
  
  if (saved.facts && saved.facts.length > 0) {
    context += `\nKnown Facts about User:\n`;
    saved.facts.forEach(f => context += `- ${f}\n`);
  }
  
  if (session && session.userName) {
    context += `\nUser's Name: ${session.userName}\n`;
  }
  
  return context.trim();
}

function extractAndSaveFacts(conversation) {
  // This would be called after conversation to extract key facts
  // For now, simple extraction
  const memory = loadSavedMemory();
  const nameMatch = conversation.match(/my name is (\w+)/i);
  if (nameMatch && !memory.facts.includes(`Name: ${nameMatch[1]}`)) {
    addSavedFact(`Name: ${nameMatch[1]}`);
  }
}

module.exports = {
  initSession,
  loadSession,
  addSessionMessage,
  getSessionMessages,
  clearSession,
  loadSavedMemory,
  saveSavedMemory,
  addSavedFact,
  updatePreference,
  getSavedMemory,
  buildContextPrompt,
  extractAndSaveFacts,
};