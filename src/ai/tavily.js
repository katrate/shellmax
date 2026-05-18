'use strict';
const https = require('https');

const { loadAiConfig } = require('./config');

async function searchTavily(query, options = {}, retries = 2) {
  const cfg = loadAiConfig();
  
  if (!cfg.tavilyApiKey) {
    throw new Error('Tavily API key not configured');
  }

  const data = JSON.stringify({
    query,
    search_depth: options.search_depth || 'basic',
    max_results: options.max_results || 5,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.tavily.com',
      path: '/search',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.tavilyApiKey}`,
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.error) {
            if (retries > 0) {
              setTimeout(() => {
                searchTavily(query, options, retries - 1).then(resolve).catch(reject);
              }, 1000);
            } else {
              reject(new Error(json.error));
            }
          } else {
            const results = json.results || [];
            const formatted = results.map(r => `[${r.title}](${r.url}): ${r.content}`).join('\n\n');
            resolve({
              answer: json.answer || '',
              results: formatted,
              raw: results,
            });
          }
        } catch (e) {
          if (retries > 0) {
            setTimeout(() => {
              searchTavily(query, options, retries - 1).then(resolve).catch(reject);
            }, 1000);
          } else {
            reject(new Error(`Search parse error: ${e.message}`));
          }
        }
      });
    });

    req.on('error', e => {
      if (retries > 0) {
        setTimeout(() => {
          searchTavily(query, options, retries - 1).then(resolve).catch(reject);
        }, 1500);
      } else {
        reject(new Error(`Search error: ${e.message}`));
      }
    });
    req.write(data);
    req.end();
  });
}

module.exports = { searchTavily };