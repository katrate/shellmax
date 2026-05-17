'use strict';
const chalk = require('chalk');
const inquirer = require('inquirer');
const { loadConfig, updateConfig } = require('./config');

const ui = require('./ui');
const { COLORS, accent, dim } = ui;

const MAIN = [
  'Change Name',
  'Connected Accounts',
  'Exit Settings'
];

async function showAccounts() {
  const { PLATFORMS, isConnected, connectPlatform } = require('./messaging/index');

  while (true) {
    const choices = PLATFORMS.map((p) => {
      const status = isConnected(p.id) ? COLORS.success('connected') : COLORS.dim('not connected');
      const check = isConnected(p.id) ? COLORS.success('✔') : ' ';
      return {
        name: ` ${check}  ${p.emoji}  ${p.label} - ${status}`,
        value: p.id
      };
    });

    choices.push(new inquirer.Separator());
    choices.push({ name: ' ← Back', value: 'back' });

    console.log();
    const { platformId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'platformId',
        message: accent(' C O N N E C T E D   A C C O U N T S '),
        choices: choices,
        pageSize: 10,
        prefix: COLORS.accent('◆')
      }
    ]);

    if (platformId === 'back') return;

    if (isConnected(platformId)) {
      const p = PLATFORMS.find(x => x.id === platformId);
      console.log(`\n  ${COLORS.success('✔')} ${p.label} is already connected.\n`);
    } else {
      const p = PLATFORMS.find(x => x.id === platformId);
      console.log();

      const { connectNow } = await inquirer.prompt([
        {
          type: 'list',
          name: 'connectNow',
          message: accent(`Connect ${p.emoji} ${p.label}?`),
          choices: [
            { name: accent('Yes, connect now'), value: 'connect' },
            { name: dim('Cancel / Go back'), value: 'cancel' }
          ],
          prefix: COLORS.accent('◆')
        }
      ]);

      if (connectNow === 'cancel') {
        continue;
      }

      await connectPlatform(platformId);
      console.log();
    }
  }
}

async function openSettings() {
  while (true) {
    console.log();
    const { choice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: accent(' S E T T I N G S '),
        choices: MAIN,
        prefix: COLORS.accent('◆')
      }
    ]);

    if (choice === 'Exit Settings') {
      return;
    }

    if (choice === 'Change Name') {
      let cfg = loadConfig();
      console.log(`\n  ${dim('Current:')} ${accent(cfg.name)}\n`);
      const { newName } = await inquirer.prompt([
        {
          type: 'input',
          name: 'newName',
          message: 'New name:',
          prefix: COLORS.accent('◆')
        }
      ]);
      if (newName && newName.trim()) {
        updateConfig({ name: newName.trim() });
        console.log(`\n  ${COLORS.success('✔')} Name changed to ${newName.trim()}\n`);
      } else {
        console.log(dim('\n  (no change)\n'));
      }
    }

    if (choice === 'Connected Accounts') {
      await showAccounts();
    }
  }
}

module.exports = { openSettings };