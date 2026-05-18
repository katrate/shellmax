'use strict';
const https = require('https');

const { loadAiConfig } = require('./config');

function isGarbled(text) {
  if (!text || typeof text !== 'string') return true;
  if (text.length < 10) return true;
  
  const hasMultipleScripts = /[\u4e00-\u9fff]/.test(text) && /[a-zA-Z]{4,}/.test(text);
  if (hasMultipleScripts && text.length > 50) return true;
  
  const weirdChars = /[§¶©®™©]/.test(text);
  if (weirdChars && text.length > 30) return true;
  
  const hashNoise = (text.match(/#\w+/g) || []).length > 3;
  if (hashNoise && text.includes('###')) return true;
  
  return false;
}

function cleanResponse(text) {
  if (!text || typeof text !== 'string') return '';
  
  let cleaned = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
  
  if (cleaned.length < 5) return '';
  
  return cleaned;
}

function callOpenRouter(model, messages, options = {}) {
  return new Promise((resolve, reject) => {
    const cfg = loadAiConfig();
    
    if (!cfg.openrouterApiKey) {
      reject(new Error('OpenRouter API key not configured. Run: /ai config openrouter <your-key>'));
      return;
    }

    const req = https.request({
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.openrouterApiKey}`,
        'HTTP-Referer': 'https://shellmax.app',
        'X-Title': 'ShellMax Terminal',
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.error) {
            reject(new Error(json.error.message || 'API Error'));
          } else {
            const raw = json.choices[0].message.content || '';
            const cleaned = cleanResponse(raw);
            
            if (isGarbled(cleaned)) {
              reject(new Error('garbled'));
            } else {
              resolve(cleaned || 'Sorry, something went wrong with the response.');
            }
          }
        } catch (e) {
          reject(new Error(`Parse error`));
        }
      });
    });

    req.on('error', e => reject(new Error(`Network error: ${e.message}`)));
    req.write(JSON.stringify({ model, messages, temperature: 0.5, max_tokens: options.max_tokens || 200 }));
    req.end();
  });
}

function buildSystemPrompt(context = '') {
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  return `You are a friendly terminal assistant. Keep responses short and natural.

RULES:
- Plain text only, no markdown formatting
- Keep it to 1-2 sentences max
- Be helpful and direct
- If unsure, say you don't know

TODAY: ${today}

${context ? `Context: ${context}` : ''}`;
}

module.exports = { callOpenRouter, buildSystemPrompt };