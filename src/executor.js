'use strict';
const { spawn, execSync } = require('child_process');
const os   = require('os');
const { session } = require('./config');

const platform = process.platform;

// Track cwd ourselves because child `cd` doesn't affect parent
let _cwd = process.cwd();

function getCwd() { return _cwd; }

// ─── CHECK WINDOWS ADMIN ─────────────────────────────────────────────────────
function isWindowsAdmin() {
  try {
    execSync('net session', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ─── ELEVATE ─────────────────────────────────────────────────────────────────
// Windows: relaunch ShellMax in a new elevated cmd window
// Mac/Linux: set adminMode flag (sudo prefixed on each command)
function elevate() {
  if (platform === 'win32') {
    if (isWindowsAdmin()) {
      return false; // already elevated
    }
    // Relaunch elevated – user will see UAC prompt
    const node  = process.execPath;
    const entry = require.resolve('../bin/shellmax.js');
    const ps    = `Start-Process -FilePath "${node}" -ArgumentList "${entry}" -Verb RunAs`;
    spawn('powershell.exe', ['-Command', ps], { detached: true, stdio: 'ignore' }).unref();
    return true; // caller should exit
  } else {
    // Mac / Linux: just flip the flag; sudo will prompt on first command
    session.adminMode = true;
    return false;
  }
}

// ─── BUILD SHELL INVOCATION ───────────────────────────────────────────────────
function buildShellArgs(input) {
  const trimmed = input.trim();

  if (trimmed.startsWith('ps:')) {
    // PowerShell command
    const psCmd = trimmed.slice(3).trim();
    if (platform === 'win32') {
      return { shell: 'powershell.exe', flag: '-Command', cmd: psCmd };
    } else {
      // Try pwsh (PowerShell Core on Mac/Linux)
      return { shell: 'pwsh', flag: '-Command', cmd: psCmd };
    }
  }

  // Normal command – apply sudo on Mac/Linux if adminMode
  let cmd = trimmed;
  if (session.adminMode && platform !== 'win32' && !cmd.startsWith('sudo ')) {
    cmd = `sudo ${cmd}`;
  }

  if (platform === 'win32') {
    return { shell: 'cmd.exe', flag: '/c', cmd };
  } else {
    return { shell: '/bin/bash', flag: '-c', cmd };
  }
}

// ─── RUN ──────────────────────────────────────────────────────────────────────
// Returns a Promise that resolves with output when command exits.
function run(input, rl) {
  const trimmed = input.trim();
  if (!trimmed) return Promise.resolve('');

  // Handle `cd` ourselves
  if (/^cd(\s|$)/.test(trimmed)) {
    const parts  = trimmed.split(/\s+/);
    const target = parts[1] ? parts[1].replace(/^["']|["']$/g, '') : os.homedir();
    try {
      const resolved = target.replace('~', os.homedir());
      process.chdir(resolved);
      _cwd = process.cwd();
    } catch (err) {
      return Promise.resolve(`shellmax: cd: ${err.message}`);
    }
    return Promise.resolve('');
  }

  const { shell, flag, cmd } = buildShellArgs(trimmed);

  return new Promise((resolve) => {
    if (rl) rl.pause();

    let stdout = '';
    let stderr = '';

    const child = spawn(shell, [flag, cmd], {
      cwd:   _cwd,
      env:   process.env,
    });

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('error', (err) => {
      if (rl) rl.resume();
      resolve(`shellmax: ${err.message}`);
    });

    child.on('close', () => {
      _cwd = process.cwd();
      if (rl) rl.resume();
      resolve(stdout + (stderr ? '\n' + stderr : ''));
    });
  });
}

module.exports = { run, elevate, isWindowsAdmin, getCwd };
