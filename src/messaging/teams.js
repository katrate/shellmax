'use strict';
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const chalk = require('chalk');

const CREDS_FILE = path.join(os.homedir(), '.shellmax', 'sessions', 'teams.json');

let _client = null;

function loadCreds() {
  try { return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8')); } catch { return null; }
}

function saveCreds(data) {
  fs.mkdirSync(path.dirname(CREDS_FILE), { recursive: true });
  fs.writeFileSync(CREDS_FILE, JSON.stringify(data, null, 2));
}

async function init() {
  if (_client) return _client;

  const creds = loadCreds();
  if (!creds || !creds.accessToken) {
    throw new Error('Teams not connected. Run: connect teams');
  }

  _client = { token: creds.accessToken, creds };
  return _client;
}

async function makeGraphRequest(client, endpoint, method = 'GET', body = null) {
  const https = require('https');

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'graph.microsoft.com',
      path: '/v1.0' + endpoint,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + client.token,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) reject(new Error(json.error.message));
          else resolve(json);
        } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function send(channelOrUser, text, isChannel = true) {
  const client = await init();

  if (isChannel) {
    const chats = await makeGraphRequest(client, '/me/chats');
    const chat = chats.value?.find(c => c.topic?.toLowerCase() === channelOrUser.toLowerCase());
    if (!chat) throw new Error(`Channel "${channelOrUser}" not found. Use "view" to see your chats first.`);
    await makeGraphRequest(client, `/me/chats/${chat.id}/messages`, 'POST', { body: { content: text } });
  } else {
    const users = await makeGraphRequest(client, '/me/contacts');
    const user = users.value?.find(u =>
      u.displayName.toLowerCase() === channelOrUser.toLowerCase() ||
      u.emailAddresses?.[0]?.address?.toLowerCase().includes(channelOrUser.toLowerCase())
    );

    if (!user) throw new Error(`User "${channelOrUser}" not found`);

    const chats = await makeGraphRequest(client, '/me/chats');
    let chat = chats.value?.find(c => c.chatType === 'oneOnOne' && c.members?.some(m => m.email === user.emailAddresses[0].address));

    if (!chat) {
      const newChat = await makeGraphRequest(client, '/me/chats', 'POST', {
        chatType: 'oneOnOne',
        members: [{ '@odata.type': '#microsoft.graph.user', email: user.emailAddresses[0].address }]
      });
      chat = newChat;
    }

    await makeGraphRequest(client, `/me/chats/${chat.id}/messages`, 'POST', { body: { content: text } });
  }
}

async function view(channelOrUser, isChannel = true) {
  const client = await init();
  const msgs = [];

  if (isChannel) {
    const chats = await makeGraphRequest(client, '/me/chats');
    const chat = chats.value?.find(c => c.topic?.toLowerCase() === channelOrUser.toLowerCase());
    if (!chat) throw new Error(`Channel "${channelOrUser}" not found`);

    const messages = await makeGraphRequest(client, `/me/chats/${chat.id}/messages?$top=10`);
    for (const m of messages.value || []) {
      msgs.push({
        from: m.from?.user?.displayName || 'Unknown',
        body: m.body?.content || '[message]',
        time: m.createdDateTime ? new Date(m.createdDateTime).toLocaleTimeString() : ''
      });
    }
  } else {
    const users = await makeGraphRequest(client, '/me/contacts');
    const user = users.value?.find(u =>
      u.displayName.toLowerCase() === channelOrUser.toLowerCase() ||
      u.emailAddresses?.[0]?.address?.toLowerCase().includes(channelOrUser.toLowerCase())
    );
    if (!user) throw new Error(`User "${channelOrUser}" not found`);

    const chats = await makeGraphRequest(client, '/me/chats');
    let chat = chats.value?.find(c => c.chatType === 'oneOnOne' && c.members?.some(m => m.email === user.emailAddresses[0].address));
    if (!chat) return [];

    const messages = await makeGraphRequest(client, `/me/chats/${chat.id}/messages?$top=10`);
    for (const m of messages.value || []) {
      msgs.push({
        from: m.from?.user?.displayName || 'Unknown',
        body: m.body?.content || '[message]',
        time: m.createdDateTime ? new Date(m.createdDateTime).toLocaleTimeString() : ''
      });
    }
  }

  return msgs.reverse();
}

async function connect() {
  const https = require('https');
  const { ask } = require('../prompt');

  process.stdout.write(chalk.cyan('\n  Microsoft Teams uses Microsoft Graph API (Device Code Flow).\n'));
  process.stdout.write(chalk.gray(
    '  This works for both work/school and personal Microsoft accounts.\n\n'
  ));

  const clientId = await ask(chalk.gray('  Client ID (enter any string, e.g. "shellmax") → ')) || 'shellmax';
  const tenantId = 'common';

  const deviceFlow = () => new Promise((resolve, reject) => {
    const data = JSON.stringify({
      client_id: clientId.trim(),
      scope: 'Chat.ReadWrite User.Read Contacts.Read'
    });

    const options = {
      hostname: 'login.microsoftonline.com',
      path: `/${tenantId}/oauth2/v2.0/devicecode`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.device_code) {
            process.stdout.write(chalk.cyan('\n  ' + json.message + '\n'));
            resolve(json);
          } else {
            reject(new Error(json.error_description || 'Failed to start device flow'));
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });

  const pollToken = (deviceCode, interval, expires) => {
    return new Promise((resolve, reject) => {
      const check = async () => {
        if (Date.now() > expires) {
          reject(new Error('Authentication timed out'));
          return;
        }
        
        const data = JSON.stringify({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          client_id: clientId.trim(),
          device_code: deviceCode
        });

        const options = {
          hostname: 'login.microsoftonline.com',
          path: `/${tenantId}/oauth2/v2.0/token`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
        };

        const req = https.request(options, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            try {
              const json = JSON.parse(body);
              if (json.access_token) {
                resolve(json.access_token);
              } else if (json.error === 'authorization_pending') {
                setTimeout(check, interval * 1000);
              } else {
                reject(new Error(json.error_description || json.error));
              }
            } catch (e) { reject(e); }
          });
        });
        req.on('error', reject);
        req.write(data);
      };
      check();
    });
  };

  try {
    const flow = await deviceFlow();
    const token = await pollToken(flow.device_code, flow.interval, flow.expires_in * 1000 + Date.now());
    
    const test = await makeGraphRequest({ token }, '/me');
    process.stdout.write(chalk.green(`  ✔  Connected as ${test.displayName}\n`));
    saveCreds({ accessToken: token, clientId: clientId.trim() });
    _client = { token, creds: { clientId: clientId.trim() } };
    return true;
  } catch (e) {
    throw new Error('Authentication failed: ' + e.message);
  }
}

module.exports = { init, send, view, connect };