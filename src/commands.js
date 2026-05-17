'use strict';
const openBrowser = require('open');
const chalk       = require('chalk');
const os           = require('os');
const { loadConfig, updateConfig, session } = require('./config');
const { launchApp, normalize, looksLikeFile, openFile, refreshCache } = require('./apps');
const { elevate }                           = require('./executor');
const { applyPrimary, applyAccent, applyDim } = require('./themes');

const platform = process.platform;
const ui = require('./ui');
const { box, header, separator, section, status, cmd, dim, accent, errorMsg, successMsg, helpCategory } = ui;

let outputBuffer = [];

function clearBuffer() { outputBuffer = []; }
function getOutput() { return outputBuffer.join('\n'); }

function write(msg) { outputBuffer.push(msg); }
function info(msg) { write(status(msg, 'info')); }
function ok(msg)   { write(successMsg(msg)); }
function err(msg)  { write(errorMsg(msg)); }

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
      info(`Opening workspace "${target}" (${ws.length} item${ws.length !== 1 ? 's' : ''})…`);
      for (const item of ws) {
        const siteUrl = cfg.websites[normalize(item)] || cfg.websites[item];
        if (siteUrl) { await openUrl(siteUrl, true); ok(`Opened website: ${item}`); }
        else          { const launched = launchApp(item); if (launched) ok(`Launched: ${item}`); else err(`Failed: ${item}`); }
      }
      return { handled: true, output: getOutput() };
    }

    const siteUrl = cfg.websites[targetKey] || cfg.websites[target];
    if (siteUrl) {
      info(`Opening ${target}…`);
      await openUrl(siteUrl, true);
      ok(`Opened: ${siteUrl}`);
      return { handled: true, output: getOutput() };
    }

    if (looksLikeFile(target)) {
      info(`Searching for "${target}"…`);
      const result = openFile(target);
      if (result.found) ok(`Found & opened: ${result.path}`);
      else               err(`File "${target}" not found on the system.`);
      return { handled: true, output: getOutput() };
    }

    info(`Launching ${target}…`);
    const launched = launchApp(target);
    if (launched) ok(`Launched: ${target}`);
    else err(`Could not launch "${target}". Try using "listapps" to see available apps.`);
    return { handled: true, output: getOutput() };
  }

  // ── crt ws <name> <items…> ────────────────────────────────────────────────
  if (cmd === 'crt' && parts[1]?.toLowerCase() === 'ws' && parts.length >= 4) {
    const wsName = normalize(parts[2]);
    const items  = parts.slice(3);
    updateConfig({ workspaces: { ...cfg.workspaces, [wsName]: items } });
    ok(`Workspace "${parts[2]}" created with: ${items.join(', ')}`);
    return { handled: true, output: getOutput() };
  }

  // ── crt web <name> <url> ──────────────────────────────────────────────────
  if (cmd === 'crt' && parts[1]?.toLowerCase() === 'web' && parts.length >= 4) {
    let url = parts[3];
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    updateConfig({ websites: { ...cfg.websites, [parts[2].toLowerCase()]: url } });
    ok(`Website saved: "${parts[2]}" → ${url}`);
    return { handled: true, output: getOutput() };
  }

  // ── del ws <name> ──────────────────────────────────────────────────────────
  if (cmd === 'del' && parts[1]?.toLowerCase() === 'ws' && parts.length >= 3) {
    const wsName = normalize(parts[2]);
    if (cfg.workspaces[wsName]) {
      const { [wsName]: _, ...rest } = cfg.workspaces;
      updateConfig({ workspaces: rest });
      ok(`Workspace "${parts[2]}" deleted`);
    } else {
      err(`Workspace "${parts[2]}" not found`);
    }
    return { handled: true, output: getOutput() };
  }

  // ── del web <name> ─────────────────────────────────────────────────────────
  if (cmd === 'del' && parts[1]?.toLowerCase() === 'web' && parts.length >= 3) {
    const webName = parts[2].toLowerCase();
    if (cfg.websites[webName]) {
      const { [webName]: _, ...rest } = cfg.websites;
      updateConfig({ websites: rest });
      ok(`Website "${parts[2]}" deleted`);
    } else {
      err(`Website "${parts[2]}" not found`);
    }
    return { handled: true, output: getOutput() };
  }

  // ── list ws ────────────────────────────────────────────────────────────────
  if (cmd === 'list' && parts[1]?.toLowerCase() === 'ws') {
    const ws = cfg.workspaces;
    if (Object.keys(ws).length === 0) {
      info('No workspaces saved');
    } else {
      write('');
      for (const [name, items] of Object.entries(ws)) {
        write(`${accent('▸')} ${dim('Workspace:')} ${accent(name)}`);
        items.forEach(item => write(`    ${dim('•')} ${item}`));
        write('');
      }
    }
    return { handled: true, output: getOutput() };
  }

  // ── list web ────────────────────────────────────────────────────────────────
  if (cmd === 'list' && parts[1]?.toLowerCase() === 'web') {
    const web = cfg.websites;
    if (Object.keys(web).length === 0) {
      info('No websites saved');
    } else {
      write('');
      for (const [name, url] of Object.entries(web)) {
        write(`${accent('▸')} ${dim('Website:')} ${accent(name)} ${dim('→')} ${url}`);
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
      ok(`Workspace "${parts[2]}" renamed to "${parts[3]}"`);
    } else {
      err(`Workspace "${parts[2]}" not found`);
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
      ok(`Website "${parts[2]}" renamed to "${parts[3]}"`);
    } else {
      err(`Website "${parts[2]}" not found`);
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
      ok(`Added "${item}" to workspace "${parts[2]}"`);
    } else {
      err(`Workspace "${parts[2]}" not found`);
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
        err(`Item "${item}" not found in workspace "${parts[2]}"`);
      } else {
        updateConfig({ workspaces: { ...cfg.workspaces, [wsName]: filtered } });
        ok(`Removed "${item}" from workspace "${parts[2]}"`);
      }
    } else {
      err(`Workspace "${parts[2]}" not found`);
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
      if (isWindowsAdmin()) { ok('Already running as Administrator.'); return { handled: true, output: getOutput() }; }
      info('Requesting elevation… A UAC prompt will appear.');
      if (elevate()) return { relaunch: true, output: getOutput() };
    } else {
      if (session.adminMode) { ok('Admin mode already active.'); }
      else { session.adminMode = true; ok('Admin mode ON — commands will run with sudo.'); }
    }
    return { handled: true, output: getOutput() };
  }

  // ── ggl ───────────────────────────────────────────────────────────────────
  if (cmd === 'ggl') {
    const q   = parts.slice(1).join(' ');
    const url = q ? `https://www.google.com/search?q=${encodeURIComponent(q)}` : 'https://www.google.com';
    info(q ? `Searching Google for "${q}"…` : 'Opening Google…');
    await openUrl(url, true);
    return { handled: true, output: getOutput() };
  }

  // ── yt ────────────────────────────────────────────────────────────────────
  if (cmd === 'yt') {
    info('Opening YouTube…');
    await openUrl('https://www.youtube.com', true);
    return { handled: true, output: getOutput() };
  }

  // ── gh ────────────────────────────────────────────────────────────────────
  if (cmd === 'gh') {
    info('Opening GitHub…');
    await openUrl('https://github.com', true);
    return { handled: true, output: getOutput() };
  }

  // ── refreshcache ──────────────────────────────────────────────────────────
  if (cmd === 'refreshcache') {
    info('Re-scanning installed apps…');
    const apps = refreshCache();
    ok(`Found ${Object.keys(apps).length} apps. Cache updated.`);
    return { handled: true, output: getOutput() };
  }

  // ── listapps ──────────────────────────────────────────────────────────────
  if (cmd === 'listapps') {
    const apps    = require('./apps').getApps();
    const entries = Object.values(apps);
    write('');
    entries.forEach((e, i) => {
      const num  = chalk.gray(`${String(i + 1).padStart(3)}.`);
      const name = applyAccent(theme, e.display.padEnd(36));
      const type = chalk.gray(e.type || '');
      write(`  ${num} ${name} ${type}`);
    });
    write('');
    write(chalk.gray(`  Total: ${entries.length} apps`));
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
    if (matches.length === 0) err(`No apps found matching "${query}"`);
    else matches.forEach((e) => {
      write(`  ▶  ${applyAccent(theme, e.display.padEnd(30))}  ${chalk.gray(e.launch)}`);
    });
    write('');
    return { handled: true, output: getOutput() };
  }

  // ── find <filename/partial> ──────────────────────────────────────────────
  if (cmd === 'find' && parts.length >= 2) {
    const query = parts.slice(1).join(' ');
    info(`Searching for "${query}"…`);
    const { searchFile } = require('./apps');
    const found = searchFile(query);
    if (found) {
      const { openWithDefault } = require('./apps');
      openWithDefault(found);
      ok(`Found & opened: ${found}`);
    } else {
      err(`File "${query}" not found. Try specifying the extension (e.g., report.pdf)`);
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
    write(header('System Information'));
    write('');
    write(`  ${dim('Hostname:')} ${accent(os.hostname())}`);
    write(`  ${dim('OS:')} ${accent(os.platform() + ' ' + os.release())}`);
    write(`  ${dim('Uptime:')} ${accent(Math.floor(os.uptime() / 86400) + ' days')}`);
    write('');
    write(`  ${dim('CPU:')} ${accent(cpuModel)}`);
    write(`  ${dim('Cores:')} ${accent(cpuCores)}`);
    write(`  ${dim('Load:')} ${accent(load[0].toFixed(2) + ' ' + load[1].toFixed(2) + ' ' + load[2].toFixed(2))}`);
    write('');
    write(`  ${dim('Memory:')} ${accent((usedMem / 1024 / 1024 / 1024).toFixed(1) + ' GB / ' + (totalMem / 1024 / 1024 / 1024).toFixed(1) + ' GB')}`);
    write(`  ${dim('Free:')} ${accent((freeMem / 1024 / 1024 / 1024).toFixed(1) + ' GB')}`);
    write('');
    write(`  ${dim('Disk:')}`);
    write(`   ${accent(disk.replace(/\n/g, '\n   '))}`);
    write('');
    return { handled: true, output: getOutput() };
  }

  // ── ping <host> ────────────────────────────────────────────────────────────
  if (cmd === 'ping' && parts.length >= 2) {
    const host = parts[1];
    const count = parts[2] || '4';
    info(`Pinging ${host}...`);
    const { run } = require('./executor');
    const output = await run(`ping -n ${count} ${host}`, null);
    write(output || 'Ping failed');
    return { handled: true, output: getOutput() };
  }

  // ── ip ──────────────────────────────────────────────────────────────────────
  if (cmd === 'ip') {
    const { run } = require('./executor');
    if (parts[1] === 'public') {
      info('Fetching public IP...');
      try {
        const { execSync } = require('child_process');
        const publicIp = execSync('curl -s ifconfig.me', { encoding: 'utf8', timeout: 5000 }).trim();
        ok(`Public IP: ${publicIp}`);
      } catch { err('Could not fetch public IP'); }
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
    info(`Running netstat ${flags}...`);
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
      err(e.message);
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

  // ── help ──────────────────────────────────────────────────────────────────
  if (cmd === 'help' || cmd === 'shellmax') {
    write(getHelpOutput(theme));
    return { handled: true, output: getOutput() };
  }

  return { handled: false, output: '' };
}

function getHelpOutput(theme) {
  let out = '';
  out += '\n' + header('ShellMax Help') + '\n\n';
  
  out += helpCategory('Apps & Files', [
    ['open <appname>',                 'Launch any installed app'],
    ['open <file.ext>',                'Find file on system & open it'],
    ['open <workspace>',               'Open a saved workspace'],
    ['open <website>',                 'Open a saved website shortcut'],
    ['crt ws <name> <app1> <app2>…',  'Create a workspace'],
    ['crt web <name> <url>',          'Save a website shortcut'],
    ['list ws',                        'List all workspaces'],
    ['list web',                       'List all websites'],
    ['rn ws <old> <new>',              'Rename a workspace'],
    ['rn web <old> <new>',             'Rename a website'],
    ['list ws',                        'List all workspaces'],
    ['list web',                       'List all saved websites'],
    ['del ws <name>',                  'Delete a workspace'],
    ['del web <name>',                 'Delete a website'],
    ['ws add <name> <item>',           'Add item to workspace'],
    ['ws rm <name> <item>',            'Remove item from workspace'],
    ['listapps',                       'Show all detected apps'],
    ['findapp <name>',                 'Search detected apps by name'],
    ['find <filename>',                'Search & open any file on system'],
    ['refreshcache',                   'Rescan installed apps'],
  ]);

  out += helpCategory('Browser', [
    ['ggl [query]',  'Open Google (with optional search)'],
    ['yt',           'Open YouTube'],
    ['gh',           'Open GitHub'],
  ]);

  out += helpCategory('Messaging', [
    ['connect wa|dc|tg|mail|slack|teams','Connect a messaging platform'],
    ['msg wa <name/+number> <text>',        'Send WhatsApp message'],
    ['msg dc <username> <text>',            'Send Discord DM'],
    ['msg dc <server> <#channel> <text>',   'Send Discord channel message'],
    ['msg tg <@username/+number> <text>',   'Send Telegram message'],
    ['msg slack <#channel|user> <text>',   'Send Slack message'],
    ['msg teams <#channel|user> <text>',   'Send Teams message'],
    ['mail <email> <subject> <body> [file]','Send email (Gmail)'],
    ['view wa|dc|tg|slack|teams <name>','View last 10 messages'],
    ['view <email>',                        'View last 5 emails'],
  ]);

  out += helpCategory('System', [
    ['st',           'Open settings'],
    ['adm',          'Enable admin / sudo mode'],
    ['ps: <command>','Run a PowerShell command'],
    ['name <name>',  'Change display name'],
    ['sysinfo',      'Show system info (CPU, RAM, Disk)'],
    ['ip',           'Show local IP address'],
    ['ip public',    'Show public IP address'],
    ['ping <host> [count]', 'Ping a host'],
    ['netstat [flags]', 'Show network connections'],
    ['exit / quit',  'Exit ShellMax'],
  ]);

  out += '\n';
  return out;
}

module.exports = { handle };