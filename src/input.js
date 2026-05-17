'use strict';
const readline = require('readline');
const os = require('os');

const { getApps } = require('./apps');
const { getCwd } = require('./executor');

const SHELLMAX_COMMANDS = [
  'open', 'crt', 'del', 'list', 'rn', 'ws', 'st', 'adm', 'ggl', 'yt', 'gh',
  'refreshcache', 'listapps', 'findapp', 'find', 'connect', 'msg', 'mail', 'view',
  'name', 'help', 'exit', 'quit', 'sysinfo', 'ping', 'ip', 'netstat', 'ps', 'kill'
];

let rl = null;
let commandHistory = [];
let historyIndex = -1;

function getCompletions(line) {
  const parts = line.split(/\s+/);
  const last = parts[parts.length - 1].toLowerCase();
  const firstWord = parts[0].toLowerCase();

  if (parts.length === 1) {
    const cmds = SHELLMAX_COMMANDS.filter(c => c.startsWith(last));
    if (cmds.length > 0) return cmds;
  }

  if (firstWord === 'open' || firstWord === 'findapp') {
    const apps = getApps();
    const names = Object.values(apps).map(a => a.display).filter(n => 
      n.toLowerCase().startsWith(last)
    );
    return names.slice(0, 20);
  }

  if (firstWord === 'crt' && parts[1]?.toLowerCase() === 'ws') {
    return ['<name> <app1> <app2>...'];
  }

  if (firstWord === 'crt' && parts[1]?.toLowerCase() === 'web') {
    return ['<name> <url>'];
  }

  if (firstWord === 'del' || firstWord === 'rn') {
    return ['ws <name>', 'web <name>'];
  }

  if (firstWord === 'ws') {
    return ['add <name> <item>', 'rm <name> <item>'];
  }

  if (firstWord === 'connect') {
    return ['wa', 'dc', 'tg', 'mail', 'ig', 'slack', 'teams'];
  }

  if (firstWord === 'msg') {
    return ['wa <name/+number> <text>', 'dc <username> <text>', 'tg <@username> <text>'];
  }

  return [];
}

function getShellCompletions(line, cwd) {
  const parts = line.split(/\s+/);
  const last = parts[parts.length - 1];
  const dir = parts.length > 1 ? parts.slice(0, -1).join(' ') : cwd;

  try {
    const fs = require('fs');
    const path = require('path');
    const searchDir = fs.existsSync(dir) ? dir : cwd;
    const entries = fs.readdirSync(searchDir);
    return entries
      .filter(e => e.toLowerCase().startsWith(last.toLowerCase()))
      .map(e => {
        const full = path.join(searchDir, e);
        const isDir = fs.statSync(full).isDirectory();
        return isDir ? e + '/' : e;
      })
      .slice(0, 15);
  } catch {
    return [];
  }
}

function createInterface() {
  if (rl) rl.close();

  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    history: commandHistory,
    completer: (line) => {
      const parts = line.split(/\s+/);
      const cwd = getCwd();

      let completions = getCompletions(line);
      if (completions.length === 0) {
        completions = getShellCompletions(line, cwd);
      }

      if (completions.length === 0) {
        return [null, line];
      }

      const last = parts[parts.length - 1];
      const lastLower = last.toLowerCase();
      const matches = completions.filter(c => c.toLowerCase().startsWith(lastLower));
      
      if (matches.length === 1) {
        const prefix = parts.slice(0, -1).join(' ');
        const newLine = prefix ? prefix + ' ' + matches[0] : matches[0];
        return [matches, newLine];
      }

      if (matches.length > 1) {
        return [matches, line];
      }

      return [completions, line];
    }
  });

  return rl;
}

async function readLine(prompt) {
  return new Promise((resolve) => {
    const readlineInterface = createInterface();
    
    readlineInterface.on('history', (history) => {
      commandHistory = history;
    });

    readlineInterface.question(prompt, (answer) => {
      if (answer.trim()) {
        commandHistory.push(answer.trim());
        historyIndex = commandHistory.length;
      }
      resolve(answer);
    });

    const prevHandler = process.on('SIGINT', () => {
      readlineInterface.close();
      process.exit(0);
    });
  });
}

function closeInput() {
  if (rl) {
    rl.close();
    rl = null;
  }
}

module.exports = { readLine, closeInput, commandHistory };