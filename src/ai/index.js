'use strict';
const readline = require('readline');
const chalk = require('chalk');

const { loadAiConfig, updateAiConfig, hasOpenRouterKey, hasTavilyKey } = require('./config');
const { callOpenRouter, buildSystemPrompt } = require('./openrouter');
const { searchTavily } = require('./tavily');
const { addSessionMessage, getSessionMessages, buildContextPrompt, getSavedMemory, updatePreference, addSavedFact } = require('./memory');

const SEARCH_DECISION_PROMPT = `Given the user query, should I search the web for current/recent information? 

Rules:
- Search if asking about: news, weather, current events, recent updates, prices, sports scores, stock info, anything time-sensitive
- Search if asking about: specific companies, products, people, places that might have changed recently
- Don't search if: general knowledge, math, coding, creative tasks, opinions, explanations of concepts

Query: "{{query}}"

Answer with only YES or NO:`;

const SUMMARIZE_PROMPT = `Analyze this conversation and extract key information about the user:

{{conversation}}

Extract and return:
1. User's name (if mentioned)
2. User's preferences or interests
3. Any important facts about the user
4. Current topic of discussion

Format as a simple list:`;

class ShellMaxAI {
  constructor() {
    this.cfg = loadAiConfig();
    this.ready = false;
  }

  async init() {
    if (!hasOpenRouterKey()) {
      this.error = 'OpenRouter API key not configured. Run: /ai config openrouter <your-key>';
      return { error: this.error };
    }
    this.ready = true;
    return { ready: true };
  }

  async decideSearch(query) {
    if (!this.ready) return false;
    if (!hasTavilyKey()) return false;
    
    const lower = query.toLowerCase();
    
    const searchKeywords = [
      'news', 'weather', 'forecast', 'latest',
      'release date', 'launch date', 'announce',
      'game', 'when', 'coming out', 'reviews',
      'price', 'stock', 'sports score'
    ];
    
    for (const keyword of searchKeywords) {
      if (lower.includes(keyword)) return true;
    }
    
    return false;
  }

  async chat(input) {
    addSessionMessage('user', input);

    const context = buildContextPrompt();
    const sessionHistory = getSessionMessages();
    
    let searchResults = null;
    let shouldSearch = false;

    if (this.cfg.searchEnabled && hasTavilyKey()) {
      shouldSearch = await this.decideSearch(input);
      
      if (shouldSearch) {
        try {
          const search = await searchTavily(input, { max_results: 5 });
          searchResults = search;
          
          const searchContext = `\n\nWeb Search Results for "${input}":\n${search.results}\n\n${search.answer ? `Summary: ${search.answer}` : ''}`;
          
          const messages = [
            { role: 'system', content: buildSystemPrompt(context + searchContext) },
            ...sessionHistory.slice(-20).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: input },
          ];
          
          const response = await this.callModel(messages);
          addSessionMessage('assistant', response);
          return response;
        } catch (e) {
          console.error('Search failed, using normal response:', e.message);
        }
      }
    }

    const messages = [
      { role: 'system', content: buildSystemPrompt(context) },
      ...sessionHistory.slice(-20).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: input },
    ];

    const response = await this.callModel(messages);
    addSessionMessage('assistant', response);
    
    this.extractMemory(input, response);
    
    return response;
  }

  async callModel(messages, attempt = 0) {
    const maxAttempts = 3;
    const delay = 2000;
    
    try {
      const response = await callOpenRouter(
        this.cfg.mainModel || 'openai/gpt-oss-120b:free',
        messages,
        { max_tokens: 200 }
      );
      return response;
    } catch (e) {
      if (attempt < maxAttempts - 1 && (e.message === 'garbled' || e.message.includes('error'))) {
        await new Promise(r => setTimeout(r, delay * (attempt + 1)));
        return this.callModel(messages, attempt + 1);
      }
      return 'Sorry, AI is having trouble right now. Please try again.';
    }
  }

  extractMemory(input, response) {
    const combined = input + ' ' + response;
    
    const nameMatch = input.match(/(?:my name is|i'm|i am|call me)\s+(\w+)/i);
    if (nameMatch) {
      updatePreference('name', nameMatch[1]);
    }
    
    const prefPatterns = [
      { pattern: /i (?:prefer|like|love|enjoy)\s+(.+?)(?:\.|,|$)/gi, key: 'preference' },
      { pattern: /i (?:hate|dislike|don't like)\s+(.+?)(?:\.|,|$)/gi, key: 'dislike' },
    ];
    
    prefPatterns.forEach(({ pattern, key }) => {
      const match = combined.match(pattern);
      if (match) {
        updatePreference(key, match[1].trim());
      }
    });
  }

  async configure(key, value) {
    if (key === 'openrouter') {
      updateAiConfig({ openrouterApiKey: value });
      return 'OpenRouter API key saved!';
    }
    if (key === 'tavily') {
      updateAiConfig({ tavilyApiKey: value });
      return 'Tavily API key saved!';
    }
    if (key === 'model') {
      updateAiConfig({ mainModel: value });
      return `Main model set to: ${value}`;
    }
    if (key === 'search-model') {
      updateAiConfig({ searchModel: value });
      return `Search model set to: ${value}`;
    }
    if (key === 'search') {
      const enabled = value === 'on' || value === 'true';
      updateAiConfig({ searchEnabled: enabled });
      return `Web search ${enabled ? 'enabled' : 'disabled'}`;
    }
    return `Unknown config key: ${key}`;
  }

  status() {
    const cfg = loadAiConfig();
    const saved = getSavedMemory();
    
    return {
      configured: hasOpenRouterKey(),
      searchEnabled: cfg.searchEnabled && hasTavilyKey(),
      mainModel: cfg.mainModel,
      searchModel: cfg.searchModel,
      savedMemory: saved,
    };
  }

  clearChat() {
    const { clearSession } = require('./memory');
    clearSession();
    return 'Chat history cleared!';
  }
}

module.exports = ShellMaxAI;