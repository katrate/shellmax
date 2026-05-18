#!/usr/bin/env node

/**
 * ShellMax - One-line installer
 * Usage: npx shellmax
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const REPO = 'https://github.com/katrate/shellmax.git';
const NAME = 'shellmax';
const HOME = os.homedir();
const INSTALL_DIR = path.join(HOME, NAME);
const PKG = path.join(INSTALL_DIR, 'package.json');

function info(msg) { console.log(`  ${msg}`); }
function ok(msg) { console.log(`  ✓ ${msg}`); }
function err(msg) { console.error(`  ✗ ${msg}`); }

function exec(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit', cwd: INSTALL_DIR, shell: true });
    return true;
  } catch { return false; }
}

function execSilent(cmd) {
  try {
    execSync(cmd, { stdio: 'ignore', shell: true });
    return true;
  } catch { return false; }
}

console.log('\n  ════════════════════════════════');
console.log('       ShellMax Installer');
console.log('  ════════════════════════════════\n');

if (fs.existsSync(PKG)) {
  info('ShellMax found. Updating...\n');
  process.chdir(INSTALL_DIR);
  execSilent('git pull --quiet');
  info('Installing dependencies...');
  exec('npm install --silent');
  exec('npm install -g --silent .');
  console.log('\n  ════════════════════════════════');
  ok('ShellMax updated!');
  console.log('  Run: shellmax\n');
} else {
  info('Downloading ShellMax...\n');
  if (execSilent(`git clone --quiet ${REPO} "${INSTALL_DIR}"`)) {
    process.chdir(INSTALL_DIR);
    info('Installing dependencies...');
    exec('npm install --silent');
    info('Setting up global command...');
    exec('npm install -g --silent .');
    console.log('\n  ════════════════════════════════');
    ok('ShellMax installed successfully!');
    console.log('  Run: shellmax\n');
  } else {
    console.log('\n  ════════════════════════════════');
    err('Installation failed.');
    err('Make sure Git is installed.');
    console.log('\n  Manual install:');
    console.log(`  git clone ${REPO}`);
    console.log('  cd shellmax && npm install -g .\n');
    process.exit(1);
  }
}