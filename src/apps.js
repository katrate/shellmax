'use strict';
const { execSync, exec, spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const { loadConfig, updateConfig } = require('./config');
const platform = process.platform;

// ─── NORMALIZE ────────────────────────────────────────────────────────────────
function normalize(name) {
  return name.toLowerCase().replace(/[\s\-_\.]+/g, '');
}

// ─── WALK FILES ───────────────────────────────────────────────────────────────
function walkFiles(dir, ext, maxDepth = 4, _d = 0) {
  const out = [];
  if (_d > maxDepth) return out;
  try {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory()) out.push(...walkFiles(full, ext, maxDepth, _d + 1));
        else if (entry.toLowerCase().endsWith(ext)) out.push(full);
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

function detectWindows() {
  const apps = {};

  // 0. Get-StartApps — ONLY reliable source for Windows Store / UWP apps
  try {
    const raw = execSync(
      'powershell -NoProfile -Command "Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress"',
      { encoding: 'utf8', timeout: 8000, stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim();
    const list = JSON.parse(raw);
    const arr  = Array.isArray(list) ? list : [list];
    arr.forEach((a) => {
      if (!a || !a.Name) return;
      const key = normalize(a.Name);
      if (key) apps[key] = { display: a.Name, launch: a.AppID, type: 'store' };
    });
  } catch { /* ignore */ }

  // 1. Start Menu .lnk files
  const smDirs = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs',
  ];
  smDirs.forEach((dir) => {
    walkFiles(dir, '.lnk', 5).forEach((lnkPath) => {
      const display = path.basename(lnkPath, '.lnk');
      const key     = normalize(display);
      if (key && !apps[key]) apps[key] = { display, launch: lnkPath, type: 'lnk' };
    });
  });

  // 2. Registry App Paths
  try {
    const out = execSync(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths"',
      { encoding: 'utf8', stdio: ['pipe','pipe','ignore'], timeout: 3000 }
    );
    out.split('\n').forEach((line) => {
      const m = line.match(/App Paths\\([^\\]+?)(?:\.exe)?\s*$/i);
      if (m) {
        const display = m[1].trim();
        const key     = normalize(display);
        if (key && !apps[key]) apps[key] = { display, launch: display, type: 'registry' };
      }
    });
  } catch { /* ignore */ }

  // 3. Program Files dir names (fallback)
  ['C:\\Program Files', 'C:\\Program Files (x86)',
   path.join(os.homedir(), 'AppData', 'Local', 'Programs')].forEach((dir) => {
    if (!fs.existsSync(dir)) return;
    try {
      fs.readdirSync(dir).forEach((entry) => {
        const key = normalize(entry);
        if (key && !apps[key]) apps[key] = { display: entry, launch: entry, type: 'pfolder' };
      });
    } catch { /* skip */ }
  });

  return apps;
}

function detectMac() {
  const apps = {};
  ['/Applications', '/System/Applications', `${os.homedir()}/Applications`].forEach((dir) => {
    if (!fs.existsSync(dir)) return;
    try {
      fs.readdirSync(dir).forEach((e) => {
        if (e.endsWith('.app')) {
          const display = e.replace(/\.app$/, '');
          apps[normalize(display)] = { display, launch: display, type: 'app' };
        }
      });
    } catch { /* skip */ }
  });
  try {
    execSync('ls /usr/local/bin /opt/homebrew/bin 2>/dev/null', { encoding: 'utf8' })
      .split('\n').filter(Boolean)
      .forEach((b) => { apps[normalize(b)] = { display: b, launch: b, type: 'bin' }; });
  } catch { /* ignore */ }
  return apps;
}

function detectLinux() {
  const apps = {};
  ['/usr/share/applications', '/usr/local/share/applications',
   `${os.homedir()}/.local/share/applications`].forEach((dir) => {
    if (!fs.existsSync(dir)) return;
    walkFiles(dir, '.desktop', 1).forEach((f) => {
      try {
        const content  = fs.readFileSync(f, 'utf8');
        const nameLine = content.split('\n').find((l) => l.startsWith('Name='));
        const execLine = content.split('\n').find((l) => l.startsWith('Exec='));
        if (nameLine) {
          const display = nameLine.replace('Name=', '').trim();
          const launch  = execLine ? execLine.replace('Exec=', '').split(' ')[0].trim() : display;
          apps[normalize(display)] = { display, launch, type: 'desktop' };
        }
      } catch { /* skip */ }
    });
  });
  (process.env.PATH || '').split(':').forEach((dir) => {
    if (!fs.existsSync(dir)) return;
    try {
      fs.readdirSync(dir).forEach((b) => {
        if (!apps[normalize(b)]) apps[normalize(b)] = { display: b, launch: b, type: 'bin' };
      });
    } catch { /* skip */ }
  });
  return apps;
}

function detectAndCache() {
  process.stdout.write('\x1B[2m  Scanning installed apps…\x1B[0m\r');
  const raw = platform === 'win32' ? detectWindows()
            : platform === 'darwin' ? detectMac()
            : detectLinux();
  updateConfig({ apps: raw });
  process.stdout.write('                              \r');
  return raw;
}

function getApps() {
  const cfg  = loadConfig();
  const apps = cfg.apps || {};
  return Object.keys(apps).length === 0 ? detectAndCache() : apps;
}

function refreshCache() { return detectAndCache(); }

// ═══════════════════════════════════════════════════════════════════════════════
// APP LAUNCH
// ═══════════════════════════════════════════════════════════════════════════════

function launchApp(appName) {
  const apps  = getApps();
  const key   = normalize(appName);
  const entry = apps[key] || null;
  let launched = false;

  if (platform === 'win32') {
    // Strategy 1: .lnk shortcut (most reliable)
    if (entry && entry.type === 'lnk' && fs.existsSync(entry.launch)) {
      try {
        exec('start "" "' + entry.launch + '"', { shell: true });
        launched = true;
      } catch {}
    }

    // Strategy 2: Store app via shell:AppsFolder
    if (!launched && entry && entry.type === 'store') {
      try {
        exec('explorer.exe "shell:AppsFolder\\' + entry.launch + '"', { shell: true });
        launched = true;
      } catch {}
    }

    // Strategy 3: Registry app paths
    if (!launched && entry && entry.type === 'registry') {
      try {
        exec('start "" "' + entry.launch + '.exe"', { shell: true });
        launched = true;
      } catch {}
    }

    // Strategy 4: Program Files folder
    if (!launched && entry && entry.type === 'pfolder') {
      const exePaths = [
        path.join('C:\\Program Files', entry.display, entry.display + '.exe'),
        path.join('C:\\Program Files (x86)', entry.display, entry.display + '.exe'),
        path.join(os.homedir(), 'AppData', 'Local', 'Programs', entry.display, entry.display + '.exe'),
      ];
      for (const exePath of exePaths) {
        if (fs.existsSync(exePath)) {
          try {
            exec('start "" "' + exePath + '"', { shell: true });
            launched = true;
            break;
          } catch {}
        }
      }
    }

    // Strategy 5: PowerShell search and launch
    if (!launched) {
      const psName = (entry ? entry.display : appName).replace(/"/g, '');
      const ps = `
$n = "${psName}"
$found = $false
# Try Start Menu .lnk search
$lnk = Get-ChildItem "$env:APPDATA\\Microsoft\\Windows\\Start Menu" -Recurse -Filter "*$n*.lnk" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($lnk) { Start-Process $lnk.FullName; $found = $true }
if (-not $found) {
  $lnk2 = Get-ChildItem "C:\\ProgramData\\Microsoft\\Windows\\Start Menu" -Recurse -Filter "*$n*.lnk" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($lnk2) { Start-Process $lnk2.FullName; $found = $true }
}
if (-not $found) {
  $a = Get-StartApps | Where-Object { $_.Name -like "*$n*" } | Select-Object -First 1
  if ($a) { Start-Process "explorer.exe" -ArgumentList "shell:AppsFolder\\$($a.AppID)"; $found = $true }
}
if (-not $found) {
  try { Start-Process $n -ErrorAction Stop; $found = $true } catch {}
}
exit [int]$found
`.trim();
      spawn('powershell.exe',
        ['-WindowStyle', 'Hidden', '-NonInteractive', '-Command', ps],
        { detached: true, stdio: 'ignore' }
      ).on('exit', (code) => { if (code === 0) launched = true; }).unref();
    }
  }

  if (platform === 'darwin') {
    const launch = entry ? entry.launch : appName;
    spawn('open', ['-a', launch], { detached: true, stdio: 'ignore' })
      .on('error', () => spawn('open', [launch], { detached: true, stdio: 'ignore' }).unref())
      .unref();
    launched = true;
  } else if (platform !== 'win32') {
    const launch = entry ? entry.launch : appName;
    spawn(launch, [], { detached: true, stdio: 'ignore' })
      .on('error', () => {
        exec(`gtk-launch ${launch}`, { stdio: 'ignore' });
      });
    launched = true;
  }

  return launched;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILE SEARCH & OPEN
// ═══════════════════════════════════════════════════════════════════════════════

const FILE_EXTENSIONS = new Set([
  'txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'json', 'xml', 'html', 'htm',
  'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'rb', 'php',
  'css', 'scss', 'sass', 'less', 'md', 'markdown', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf',
  'zip', 'rar', '7z', 'tar', 'gz', 'iso', 'exe', 'msi', 'dmg', 'app', 'deb', 'rpm',
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'ico', 'webp', 'psd', 'ai', 'eps',
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'wma', 'm4a',
  'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm',
  'log', 'tmp', 'bak', 'old', 'swp', 'env', 'gitignore', 'dockerfile',
]);

function looksLikeFile(name) {
  const lower = name.toLowerCase();
  const lastDot = lower.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0 || lastDot === lower.length - 1) return false;
  const ext = lower.slice(lastDot + 1);
  return FILE_EXTENSIONS.has(ext) && !name.startsWith('http') && !name.startsWith('www.');
}

// Open a file path with the OS default application
function openWithDefault(filePath) {
  if (platform === 'win32') {
    exec(`start "" "${filePath}"`, { shell: true });
  } else if (platform === 'darwin') {
    spawn('open', [filePath], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [filePath], { detached: true, stdio: 'ignore' }).unref();
  }
}

// Search the file system for a filename, returns the first match path or null
function searchFile(filename) {
  // 1. Check if it's already an absolute/relative path
  if (fs.existsSync(filename)) return path.resolve(filename);
  if (fs.existsSync(path.join(process.cwd(), filename))) {
    return path.join(process.cwd(), filename);
  }

  // 2. Check common directories instantly
  const quickDirs = [
    os.homedir(),
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Downloads'),
    path.join(os.homedir(), 'Documents'),
    path.join(os.homedir(), 'Pictures'),
    path.join(os.homedir(), 'Videos'),
    path.join(os.homedir(), 'Music'),
    process.cwd(),
  ];

  for (const dir of quickDirs) {
    const full = path.join(dir, filename);
    if (fs.existsSync(full)) return full;
  }

  // 3. Deep search (user home, max depth 6)
  try {
    let result = null;
    if (platform === 'win32') {
      // Use PowerShell for fast recursive search in user folder
      const out = execSync(
        `powershell -Command "Get-ChildItem -Path $env:USERPROFILE -Recurse -Filter '${filename}' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName"`,
        { encoding: 'utf8', timeout: 8000, stdio: ['pipe','pipe','ignore'] }
      ).trim();
      if (out && fs.existsSync(out)) result = out;
    } else {
      const out = execSync(
        `find "${os.homedir()}" -maxdepth 6 -iname "${filename}" -type f 2>/dev/null | head -1`,
        { encoding: 'utf8', timeout: 8000 }
      ).trim();
      if (out && fs.existsSync(out)) result = out;
    }
    return result;
  } catch {
    return null;
  }
}

// Full open-file flow: search → open → return result for CLI feedback
function openFile(filename) {
  const found = searchFile(filename);
  if (found) {
    openWithDefault(found);
    return { found: true, path: found };
  }
  return { found: false };
}

module.exports = { getApps, launchApp, refreshCache, normalize, looksLikeFile, openFile, searchFile, openWithDefault };
