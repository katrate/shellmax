'use strict';
const openBrowser = require('open');
const chalk       = require('chalk');
const os           = require('os');
const { loadConfig, updateConfig, session } = require('./config');
const { launchApp, normalize, looksLikeFile, openFile, refreshCache } = require('./apps');
const { elevate }                           = require('./executor');
const { applyPrimary, applyAccent, applyDim } = require('./themes');

const platform = process.platform;

let outputBuffer = [];
let aiInstance = null;

async function getAI() {
  if (!aiInstance) {
    const ShellMaxAI = require('./ai/index');
    aiInstance = new ShellMaxAI();
    await aiInstance.init();
  }
  return aiInstance;
}

function clearBuffer() { outputBuffer = []; }
function getOutput() { return outputBuffer.join('\n'); }

function write(msg) { outputBuffer.push(msg); }
function info(msg, theme) { write(msg); }
function ok(msg, theme)   { write(msg); }
function err(msg, theme)  { write(msg); }

// ─── BROWSER ─────────────────────────────────────────────────────────────────
async function openUrl(url, chrome) {
  try {
    if (chrome) await openBrowser(url, { app: { name: openBrowser.apps.chrome } }).catch(() => openBrowser(url));
    else         await openBrowser(url);
  } catch { await openBrowser(url); }
}

// ─── COMMAND ROUTER ───────────────────────────────────────────────────────────
async function handle(input, openSettings, rl) {
  clearBuffer();
  
  const raw   = input.trim();
  const parts = raw.split(/\s+/);
  const cmd   = parts[0].toLowerCase();
  const cfg   = loadConfig();
  const theme = cfg.theme;

  // ── exit ─────────────────────────────────────────────────────────────────
  if (cmd === 'exit' || cmd === 'quit') return { exit: true, output: getOutput() };

  // ── open ─────────────────────────────────────────────────────────────────
  if (cmd === 'open' && parts.length >= 2) {
    const target    = parts.slice(1).join(' ');
    const targetKey = normalize(target);

    const ws = cfg.workspaces[targetKey] || cfg.workspaces[target];
    if (ws) {
      info(`Opening workspace "${target}" (${ws.length} item${ws.length !== 1 ? 's' : ''})…`, theme);
      for (const item of ws) {
        const siteUrl = cfg.websites[normalize(item)] || cfg.websites[item];
        if (siteUrl) { await openUrl(siteUrl, true); ok(`Opened website: ${item}`, theme); }
        else          { const launched = launchApp(item); if (launched) ok(`Launched: ${item}`, theme); else err(`Failed: ${item}`, theme); }
      }
      return { handled: true, output: getOutput() };
    }

    const siteUrl = cfg.websites[targetKey] || cfg.websites[target];
    if (siteUrl) {
      info(`Opening ${target}…`, theme);
      await openUrl(siteUrl, true);
      ok(`Opened: ${siteUrl}`, theme);
      return { handled: true, output: getOutput() };
    }

    if (looksLikeFile(target)) {
      info(`Searching for "${target}"…`, theme);
      const result = openFile(target);
      if (result.found) ok(`Found & opened: ${result.path}`, theme);
      else               err(`File "${target}" not found on the system.`, theme);
      return { handled: true, output: getOutput() };
    }

    info(`Launching ${target}…`, theme);
    const launched = launchApp(target);
    if (launched) ok(`Launched: ${target}`, theme);
    else err(`Could not launch "${target}". Try using "listapps" to see available apps.`, theme);
    return { handled: true, output: getOutput() };
  }

  // ── crt ws <name> <items…> ────────────────────────────────────────────────
  if (cmd === 'crt' && parts[1]?.toLowerCase() === 'ws' && parts.length >= 4) {
    const wsName = normalize(parts[2]);
    const items  = parts.slice(3);
    updateConfig({ workspaces: { ...cfg.workspaces, [wsName]: items } });
    ok(`Workspace "${parts[2]}" created with: ${items.join(', ')}`, theme);
    return { handled: true, output: getOutput() };
  }

  // ── crt web <name> <url> ──────────────────────────────────────────────────
  if (cmd === 'crt' && parts[1]?.toLowerCase() === 'web' && parts.length >= 4) {
    let url = parts[3];
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    updateConfig({ websites: { ...cfg.websites, [parts[2].toLowerCase()]: url } });
    ok(`Website saved: "${parts[2]}" → ${url}`, theme);
    return { handled: true, output: getOutput() };
  }

  // ── del ws <name> ──────────────────────────────────────────────────────────
  if (cmd === 'del' && parts[1]?.toLowerCase() === 'ws' && parts.length >= 3) {
    const wsName = normalize(parts[2]);
    if (cfg.workspaces[wsName]) {
      const { [wsName]: _, ...rest } = cfg.workspaces;
      updateConfig({ workspaces: rest });
      ok(`Workspace "${parts[2]}" deleted`, theme);
    } else {
      err(`Workspace "${parts[2]}" not found`, theme);
    }
    return { handled: true, output: getOutput() };
  }

  // ── del web <name> ─────────────────────────────────────────────────────────
  if (cmd === 'del' && parts[1]?.toLowerCase() === 'web' && parts.length >= 3) {
    const webName = parts[2].toLowerCase();
    if (cfg.websites[webName]) {
      const { [webName]: _, ...rest } = cfg.websites;
      updateConfig({ websites: rest });
      ok(`Website "${parts[2]}" deleted`, theme);
    } else {
      err(`Website "${parts[2]}" not found`, theme);
    }
    return { handled: true, output: getOutput() };
  }

  // ── list ws ────────────────────────────────────────────────────────────────
  if (cmd === 'list' && parts[1]?.toLowerCase() === 'ws') {
    const ws = cfg.workspaces;
    if (Object.keys(ws).length === 0) {
      info('No workspaces saved', theme);
    } else {
      write('');
      for (const [name, items] of Object.entries(ws)) {
        write(`${applyAccent(theme, '▸')} ${applyDim(theme, 'Workspace:')} ${applyAccent(theme, name)}`);
        items.forEach(item => write(`    ${applyDim(theme, '•')} ${applyDim(theme, item)}`));
        write('');
      }
    }
    return { handled: true, output: getOutput() };
  }

  // ── list web ────────────────────────────────────────────────────────────────
  if (cmd === 'list' && parts[1]?.toLowerCase() === 'web') {
    const web = cfg.websites;
    if (Object.keys(web).length === 0) {
      info('No websites saved', theme);
    } else {
      write('');
      for (const [name, url] of Object.entries(web)) {
        write(`${applyAccent(theme, '▸')} ${applyDim(theme, 'Website:')} ${applyAccent(theme, name)} ${applyDim(theme, '→')} ${applyDim(theme, url)}`);
      }
      write('');
    }
    return { handled: true, output: getOutput() };
  }

  // ── rn ws <oldname> <newname> ─────────────────────────────────────────────
  if (cmd === 'rn' && parts[1]?.toLowerCase() === 'ws' && parts.length >= 4) {
    const oldName = normalize(parts[2]);
    const newName = normalize(parts[3]);
    if (cfg.workspaces[oldName]) {
      const items = cfg.workspaces[oldName];
      const { [oldName]: _, ...rest } = cfg.workspaces;
      updateConfig({ workspaces: { ...rest, [newName]: items } });
      ok(`Workspace "${parts[2]}" renamed to "${parts[3]}"`, theme);
    } else {
      err(`Workspace "${parts[2]}" not found`, theme);
    }
    return { handled: true, output: getOutput() };
  }

  // ── rn web <oldname> <newname> ────────────────────────────────────────────
  if (cmd === 'rn' && parts[1]?.toLowerCase() === 'web' && parts.length >= 4) {
    const oldName = parts[2].toLowerCase();
    const newName = parts[3].toLowerCase();
    if (cfg.websites[oldName]) {
      const url = cfg.websites[oldName];
      const { [oldName]: _, ...rest } = cfg.websites;
      updateConfig({ websites: { ...rest, [newName]: url } });
      ok(`Website "${parts[2]}" renamed to "${parts[3]}"`, theme);
    } else {
      err(`Website "${parts[2]}" not found`, theme);
    }
    return { handled: true, output: getOutput() };
  }

  // ── ws add <name> <item> ───────────────────────────────────────────────────
  if (cmd === 'ws' && parts[1]?.toLowerCase() === 'add' && parts.length >= 4) {
    const wsName = normalize(parts[2]);
    const item = parts.slice(3).join(' ');
    if (cfg.workspaces[wsName]) {
      const current = cfg.workspaces[wsName];
      updateConfig({ workspaces: { ...cfg.workspaces, [wsName]: [...current, item] } });
      ok(`Added "${item}" to workspace "${parts[2]}"`, theme);
    } else {
      err(`Workspace "${parts[2]}" not found`, theme);
    }
    return { handled: true, output: getOutput() };
  }

  // ── ws rm <name> <item> ────────────────────────────────────────────────────
  if (cmd === 'ws' && parts[1]?.toLowerCase() === 'rm' && parts.length >= 4) {
    const wsName = normalize(parts[2]);
    const item = parts.slice(3).join(' ');
    if (cfg.workspaces[wsName]) {
      const current = cfg.workspaces[wsName];
      const filtered = current.filter(i => i.toLowerCase() !== item.toLowerCase());
      if (filtered.length === current.length) {
        err(`Item "${item}" not found in workspace "${parts[2]}"`, theme);
      } else {
        updateConfig({ workspaces: { ...cfg.workspaces, [wsName]: filtered } });
        ok(`Removed "${item}" from workspace "${parts[2]}"`, theme);
      }
    } else {
      err(`Workspace "${parts[2]}" not found`, theme);
    }
    return { handled: true, output: getOutput() };
  }

  // ── st (settings) ─────────────────────────────────────────────────────────
  if (cmd === 'st') {
    await openSettings();
    return { handled: true, reload: true, output: getOutput() };
  }

  // ── adm ───────────────────────────────────────────────────────────────────
  if (cmd === 'adm') {
    if (process.platform === 'win32') {
      const { isWindowsAdmin } = require('./executor');
      if (isWindowsAdmin()) { ok('Already running as Administrator.', theme); return { handled: true, output: getOutput() }; }
      info('Requesting elevation… A UAC prompt will appear.', theme);
      if (elevate()) return { relaunch: true, output: getOutput() };
    } else {
      if (session.adminMode) { ok('Admin mode already active.', theme); }
      else { session.adminMode = true; ok('Admin mode ON — commands will run with sudo.', theme); }
    }
    return { handled: true, output: getOutput() };
  }

  // ── ggl ───────────────────────────────────────────────────────────────────
  if (cmd === 'ggl') {
    const q   = parts.slice(1).join(' ');
    const url = q ? `https://www.google.com/search?q=${encodeURIComponent(q)}` : 'https://www.google.com';
    info(q ? `Searching Google for "${q}"…` : 'Opening Google…', theme);
    await openUrl(url, true);
    return { handled: true, output: getOutput() };
  }

  // ── yt ────────────────────────────────────────────────────────────────────
  if (cmd === 'yt') {
    info('Opening YouTube…', theme);
    await openUrl('https://www.youtube.com', true);
    return { handled: true, output: getOutput() };
  }

  // ── gh ────────────────────────────────────────────────────────────────────
  if (cmd === 'gh') {
    info('Opening GitHub…', theme);
    await openUrl('https://github.com', true);
    return { handled: true, output: getOutput() };
  }

  // ── refreshcache ──────────────────────────────────────────────────────────
  if (cmd === 'refreshcache') {
    info('Re-scanning installed apps…', theme);
    const apps = refreshCache();
    ok(`Found ${Object.keys(apps).length} apps. Cache updated.`, theme);
    return { handled: true, output: getOutput() };
  }

  // ── listapps ──────────────────────────────────────────────────────────────
  if (cmd === 'listapps') {
    const apps    = require('./apps').getApps();
    const entries = Object.values(apps);
    write('');
    entries.forEach((e, i) => {
      const num  = applyDim(theme, `${String(i + 1).padStart(3)}.`);
      const name = applyAccent(theme, e.display.padEnd(36));
      const type = applyDim(theme, e.type || '');
      write(`  ${num} ${name} ${type}`);
    });
    write('');
    write(applyDim(theme, `  Total: ${entries.length} apps`));
    write('');
    return { handled: true, output: getOutput() };
  }

  // ── findapp <name> ────────────────────────────────────────────────────────
  if (cmd === 'findapp' && parts.length >= 2) {
    const query   = parts.slice(1).join(' ').toLowerCase();
    const apps    = require('./apps').getApps();
    const matches = Object.values(apps).filter((e) =>
      e.display.toLowerCase().includes(query)
    );
    write('');
    if (matches.length === 0) err(`No apps found matching "${query}"`, theme);
    else matches.forEach((e) => {
      write(`  ▶  ${applyAccent(theme, e.display.padEnd(30))}  ${applyDim(theme, e.launch)}`);
    });
    write('');
    return { handled: true, output: getOutput() };
  }

  // ── find <filename/partial> ──────────────────────────────────────────────
  if (cmd === 'find' && parts.length >= 2) {
    const query = parts.slice(1).join(' ');
    info(`Searching for "${query}"…`, theme);
    const { searchFile } = require('./apps');
    const found = searchFile(query);
    if (found) {
      const { openWithDefault } = require('./apps');
      openWithDefault(found);
      ok(`Found & opened: ${found}`, theme);
    } else {
      err(`File "${query}" not found. Try specifying the extension (e.g., report.pdf)`, theme);
    }
    return { handled: true, output: getOutput() };
  }

  // ── sysinfo ─────────────────────────────────────────────────────────────────
  if (cmd === 'sysinfo') {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpuModel = cpus[0]?.model || 'Unknown';
    const cpuCores = cpus.length;
    const load = os.loadavg();
    
    const disk = (() => {
      if (platform === 'win32') {
        try {
          const { execSync } = require('child_process');
          const out = execSync('wmic logicaldisk get size,freespace,caption', { encoding: 'utf8' });
          const lines = out.trim().split('\n').slice(1).filter(l => l.trim());
          return lines.map(l => {
            const parts = l.trim().split(/\s+/);
            const cap = parts[0];
            const free = parts[1] ? Math.round(parts[1] / 1024 / 1024 / 1024) + ' GB' : 'N/A';
            return `${cap}: ${free} free`;
          }).join('\n   ');
        } catch { return 'Unable to get disk info'; }
      }
      return 'Use df command';
    })();

    write('');
    write(header('System Information', theme));
    write('');
    write(`  ${applyDim(theme, 'Hostname:')} ${applyPrimary(theme, os.hostname())}`);
    write(`  ${applyDim(theme, 'OS:')} ${applyPrimary(theme, os.platform() + ' ' + os.release())}`);
    write(`  ${applyDim(theme, 'Uptime:')} ${applyPrimary(theme, Math.floor(os.uptime() / 86400) + ' days')}`);
    write('');
    write(`  ${applyDim(theme, 'CPU:')} ${applyPrimary(theme, cpuModel)}`);
    write(`  ${applyDim(theme, 'Cores:')} ${applyPrimary(theme, String(cpuCores))}`);
    write(`  ${applyDim(theme, 'Load:')} ${applyPrimary(theme, load[0].toFixed(2) + ' ' + load[1].toFixed(2) + ' ' + load[2].toFixed(2))}`);
    write('');
    write(`  ${applyDim(theme, 'Memory:')} ${applyPrimary(theme, (usedMem / 1024 / 1024 / 1024).toFixed(1) + ' GB / ' + (totalMem / 1024 / 1024 / 1024).toFixed(1) + ' GB')}`);
    write(`  ${applyDim(theme, 'Free:')} ${applyPrimary(theme, (freeMem / 1024 / 1024 / 1024).toFixed(1) + ' GB')}`);
    write('');
    write(`  ${applyDim(theme, 'Disk:')}`);
    write(`   ${applyPrimary(theme, disk.replace(/\n/g, '\n   '))}`);
    write('');
    return { handled: true, output: getOutput() };
  }

  // ── ping <host> ────────────────────────────────────────────────────────────
  if (cmd === 'ping' && parts.length >= 2) {
    const host = parts[1];
    const count = parts[2] || '4';
    info(`Pinging ${host}...`, theme);
    const { run } = require('./executor');
    const output = await run(`ping -n ${count} ${host}`, null);
    write(output || 'Ping failed');
    return { handled: true, output: getOutput() };
  }

  // ── ip ──────────────────────────────────────────────────────────────────────
  if (cmd === 'ip') {
    const { run } = require('./executor');
    if (parts[1] === 'public') {
      info('Fetching public IP...', theme);
      try {
        const { execSync } = require('child_process');
        const publicIp = execSync('curl -s ifconfig.me', { encoding: 'utf8', timeout: 5000 }).trim();
        ok(`Public IP: ${publicIp}`, theme);
      } catch { err('Could not fetch public IP', theme); }
    } else {
      const output = await run(platform === 'win32' ? 'ipconfig' : 'ifconfig', null);
      write(output || 'Could not get IP info');
    }
    return { handled: true, output: getOutput() };
  }

  // ── netstat ────────────────────────────────────────────────────────────────
  if (cmd === 'netstat') {
    const { run } = require('./executor');
    const flags = parts[1] || '-an';
    info(`Running netstat ${flags}...`, theme);
    const output = await run(platform === 'win32' ? `netstat ${flags}` : `netstat ${flags}`, null);
    write(output || 'netstat failed');
    return { handled: true, output: getOutput() };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MESSAGING COMMANDS
  // ══════════════════════════════════════════════════════════════════════════

  // ── connect <platform> ────────────────────────────────────────────────────
  if (cmd === 'connect' && parts.length >= 2) {
    const platformId = parts[1].toLowerCase();
    const { connectPlatform } = require('./messaging/index');
    try {
      await connectPlatform(platformId);
    } catch (e) {
      err(e.message, theme);
    }
    return { handled: true, output: getOutput() };
  }

  // ── msg <platform> <name/number> <text…> ─────────────────────────────────
  if (cmd === 'msg') {
    const { handleMsg } = require('./messaging/index');
    await handleMsg(parts);
    return { handled: true, output: getOutput() };
  }

  // ── mail <email> <subject> <body> [file] ──────────────────────────────────
  if (cmd === 'mail') {
    const { handleMail } = require('./messaging/index');
    await handleMail(parts);
    return { handled: true, output: getOutput() };
  }

  // ── view <platform> <name> ────────────────────────────────────────────────
  if (cmd === 'view') {
    const { handleView } = require('./messaging/index');
    await handleView(parts);
    return { handled: true, output: getOutput() };
  }

  // ── AI COMMANDS ─────────────────────────────────────────────────────────
  
  // ai config <key> <value>
  if (cmd === 'ai' && parts[1] === 'config' && parts.length >= 4) {
    const key = parts[2].toLowerCase();
    const value = parts.slice(3).join(' ');
    try {
      const ai = await getAI();
      const result = await ai.configure(key, value);
      ok(result, theme);
    } catch (e) {
      err(e.message, theme);
    }
    return { handled: true, output: getOutput() };
  }

  // ai status
  if (cmd === 'ai' && parts[1] === 'status') {
    const ai = await getAI();
    const status = ai.status();
    write('');
    write(applyPrimary(theme, '  AI Status'));
    write(applyDim(theme, '  ──────────────────'));
    write(`  ${applyDim(theme, 'OpenRouter:')} ${status.configured ? applyPrimary(theme, '✓ Configured') : applyAccent(theme, '✗ Not Set')}`);
    write(`  ${applyDim(theme, 'Web Search:')} ${status.searchEnabled ? applyPrimary(theme, '✓ Enabled') : applyAccent(theme, '✗ Disabled')}`);
    write(`  ${applyDim(theme, 'Main Model:')} ${applyPrimary(theme, status.mainModel)}`);
    write(`  ${applyDim(theme, 'Search Model:')} ${applyPrimary(theme, status.searchModel)}`);
    if (status.savedMemory && status.savedMemory.facts && status.savedMemory.facts.length > 0) {
      write('');
      write(applyDim(theme, '  Saved Memory:'));
      status.savedMemory.facts.forEach(f => write(`    ${applyPrimary(theme, '•')} ${applyDim(theme, f)}`));
    }
    write('');
    return { handled: true, output: getOutput() };
  }

  // ai clear
  if (cmd === 'ai' && parts[1] === 'clear') {
    const ai = await getAI();
    const result = ai.clearChat();
    ok(result, theme);
    return { handled: true, output: getOutput() };
  }

  // ai <message> - chat with AI
  if (cmd === 'ai' && parts.length >= 2) {
    const message = parts.slice(1).join(' ');
    try {
      const ai = await getAI();
      info('Thinking...', theme);
      const response = await ai.chat(message);
      write('');
      const lines = response.split('\n');
      lines.forEach(line => write(applyPrimary(theme, '  ' + line)));
      write('');
    } catch (e) {
      err(e.message, theme);
    }
    return { handled: true, output: getOutput() };
  }

  // ── help ──────────────────────────────────────────────────────────────────
  if (cmd === 'help' || cmd === 'shellmax') {
    write(getHelpOutput(theme));
    return { handled: true, output: getOutput() };
  }

  return { handled: false, output: '' };
}

function getHelpOutput(theme) {
  let out = '';
  out += `${applyAccent(theme, '╭──')} ShellMax Commands ${applyAccent(theme, '──╮')}\n\n`;
  
  out += helpCategory('General Commands', [
    ['/help', 'Show this help'],
    ['/st', 'Open settings'],
    ['/exit, /quit', 'Exit ShellMax'],
    ['/adm', 'Run as administrator'],
    ['/refreshcache', 'Re-scan installed apps'],
  ], theme);

  out += helpCategory('App & File Commands', [
    ['/open <app>', 'Launch an app'],
    ['/open <file>', 'Open a file'],
    ['/open <workspace>', 'Open a saved workspace'],
    ['/listapps', 'Show all installed apps'],
    ['/findapp <name>', 'Search for an app'],
    ['/find ', 'Find and open a file'],
  ], theme);

  out += helpCategory('Workspace Commands', [
    ['/crt ws <name> <apps...>', 'Create workspace'],
    ['/crt web <name> <url>', 'Save a website'],
    ['/list ws', 'List workspaces'],
    ['/list web', 'List saved websites'],
    ['/ws add <name> <item>', 'Add item to workspace'],
    ['/ws rm <name> <item>', 'Remove item from workspace'],
    ['/rn ws <old> <new>', 'Rename workspace'],
    ['/rn web <old> <new>', 'Rename website'],
    ['/del ws <name>', 'Delete workspace'],
    ['/del web <name>', 'Delete website'],
  ], theme);

  out += helpCategory('Quick Access', [
    ['/ggl <search>', 'Search Google'],
    ['/yt', 'Open YouTube'],
    ['/gh', 'Open GitHub'],
  ], theme);

  out += helpCategory('System Info', [
    ['/sysinfo', 'Show system information'],
    ['/ping <host>', 'Ping a host'],
    ['/ip', 'Show local IP'],
    ['/ip public', 'Show public IP'],
    ['/netstat', 'Show network connections'],
  ], theme);

  out += helpCategory('Messaging', [
    ['/connect <platform>', 'Connect messaging (whatsapp, telegram, discord)'],
    ['/msg <platform> <name> <text>', 'Send a message'],
    ['/mail <email> <sub> <body>', 'Send an email'],
    ['/view <platform> <name>', 'View conversation'],
  ], theme);

  out += helpCategory('AI Commands (/ai ...)', [
    ['/ai <message>', 'Chat with AI'],
    ['/ai config openrouter <key>', 'Set OpenRouter API key'],
    ['/ai config tavily <key>', 'Set Tavily API key'],
    ['/ai status', 'Show AI configuration'],
    ['/ai clear', 'Clear chat history'],
  ], theme);

  out += helpCategory('Terminal Commands (*...)', [
    ['*ls', 'List files'],
    ['*cd <folder>', 'Change directory'],
    ['*mkdir <folder>', 'Create folder'],
    ['*ping <host>', 'Ping a host'],
    ['*<any command>', 'Run any terminal command'],
  ], theme);

  out += '\n' + applyDim(theme, 'Default: Everything goes to AI  |  / for commands  * for terminal') + '\n';
  return out;
}

function helpCategory(title, commands, theme = 'midnight') {
  let result = `${applyAccent(theme, '▸')} ${applyAccent(theme, title)}\n`;
  commands.forEach((cmdDesc) => {
    const cmd = cmdDesc[0] || cmdDesc;
    const desc = cmdDesc[1] || '';
    result += `  ${applyAccent(theme, String(cmd).padEnd(30))}${applyDim(theme, desc)}\n`;
  });
  return result;
}

module.exports = { handle };