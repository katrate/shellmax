'use strict';
const { onboard } = require('./onboarding');
const { startTerminal } = require('./terminal');

async function main() {
  try {
    const cfg = await onboard();
    await startTerminal(cfg);
  } catch (err) {
    console.error('ShellMax crashed:', err);
    process.exit(1);
  }
}

main();