'use strict';
const chalk = require('chalk');
const inquirer = require('inquirer');
const readline = require('readline');
const { loadConfig, updateConfig } = require('./config');
const { THEMES, TEXT_COLORS, FONTS, applyAccent, applyDim } = require('./themes');
const { loadAiConfig, updateAiConfig, hasOpenRouterKey, hasTavilyKey } = require('./ai/config');

const ui = require('./ui');
const { COLORS, accent: uiAccent, dim: uiDim } = ui;

const MAIN = [
  'Change Name',
  'Theme',
  'Text Color',
  'Font Style',
  'AI Assistant',
  'Connected Accounts',
  'Exit Settings'
];

function accent(str) {
  return uiAccent(str);
}

function dim(str) {
  return uiDim(str);
}

async function showAccounts() {
  const { PLATFORMS, isConnected, connectPlatform } = require('./messaging/index');
  let changed = false;

  while (!changed) {
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
        prefix: accent('◆')
      }
    ]);

    if (platformId === 'back') return false;

    const p = PLATFORMS.find(x => x.id === platformId);
    
    if (isConnected(platformId)) {
      console.log(`\n  ${COLORS.success('✔')} ${p.label} is already connected.\n`);
    } else {
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
          prefix: accent('◆')
        }
      ]);

      if (connectNow === 'cancel') continue;

      await connectPlatform(platformId);
      console.log();
      return true;
    }
  }
  return changed;
}

async function showThemePicker() {
  const cfg = loadConfig();
  console.log();
  console.log(`  ${dim('Current:')} ${accent(cfg.theme || 'midnight')}`);
  console.log();

  const choices = THEMES.map((t) => ({
    name: ` ${t.name.padEnd(12)} ${dim(t.desc)}`,
    value: t.id
  }));

  choices.push(new inquirer.Separator());
  choices.push({ name: ' ← Back', value: 'back' });

  const { themeId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'themeId',
      message: accent(' S E L E C T   T H E M E '),
      choices: choices,
      pageSize: 12,
      prefix: accent('◆')
    }
  ]);

  if (themeId === 'back') return false;

  updateConfig({ theme: themeId });
  console.log(`\n  ${COLORS.success('✔')} Theme set to "${themeId}"\n`);
  return true;
}

async function showTextColorPicker() {
  const cfg = loadConfig();
  console.log();
  console.log(`  ${dim('Current:')} ${accent(cfg.textColor || 'cyan')}`);
  console.log();

  const choices = TEXT_COLORS.map((c) => ({
    name: ` ${c.name}`,
    value: c.id
  }));

  choices.push(new inquirer.Separator());
  choices.push({ name: ' ← Back', value: 'back' });

  const { colorId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'colorId',
      message: accent(' S E L E C T   T E X T   C O L O R '),
      choices: choices,
      pageSize: 12,
      prefix: accent('◆')
    }
  ]);

  if (colorId === 'back') return false;

  updateConfig({ textColor: colorId });
  console.log(`\n  ${COLORS.success('✔')} Text color set to "${colorId}"\n`);
  return true;
}

async function showFontPicker() {
  const cfg = loadConfig();
  console.log();
  console.log(`  ${dim('Current:')} ${accent(cfg.font || 'Doom')}`);
  console.log();

  const choices = FONTS.map((f) => ({
    name: ` ${f.name}`,
    value: f.id
  }));

  choices.push(new inquirer.Separator());
  choices.push({ name: ' ← Back', value: 'back' });

  const { fontId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'fontId',
      message: accent(' S E L E C T   F O N T '),
      choices: choices,
      pageSize: 15,
      prefix: accent('◆')
    }
  ]);

  if (fontId === 'back') return false;

  updateConfig({ font: fontId });
  console.log(`\n  ${COLORS.success('✔')} Font set to "${fontId}"\n`);
  return true;
}

async function showAIPanel() {
  while (true) {
    const aiCfg = loadAiConfig();
    const hasOpenRouter = hasOpenRouterKey();
    const hasTavily = hasTavilyKey();

    console.log();
    console.log(accent(' A I   A S S I S T A N T '));
    console.log();
    console.log(`  ${dim('OpenRouter:')} ${hasOpenRouter ? COLORS.success('✓ Configured') : COLORS.dim('✗ Not Set')}`);
    console.log(`  ${dim('Tavily (Web Search):')} ${hasTavily ? COLORS.success('✓ Enabled') : COLORS.dim('✗ Disabled')}`);
    console.log(`  ${dim('Search:')} ${aiCfg.searchEnabled ? COLORS.success('✓ On') : COLORS.dim('✗ Off')}`);
    console.log();

    const choices = [
      { name: '  Configure OpenRouter API Key', value: 'openrouter' },
      { name: '  Configure Tavily API Key', value: 'tavily' },
      { name: `  ${aiCfg.searchEnabled ? 'Disable' : 'Enable'} Web Search`, value: 'toggle-search' },
    ];

    choices.push(new inquirer.Separator());
    choices.push({ name: ' ← Back', value: 'back' });

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '',
        choices: choices,
        prefix: accent('◆')
      }
    ]);

    if (action === 'back') return false;

    if (action === 'openrouter') {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
      console.log();
      console.log(dim('  Get free key at: openrouter.ai/keys'));
      console.log(dim('  Current key: ') + (hasOpenRouter ? COLORS.success('(set)') : COLORS.dim('not set')));
      console.log();

      const key = await new Promise((res) => {
        rl.question(dim('  Enter new key (or press Enter to cancel) > '), (answer) => {
          rl.close();
          res(answer);
        });
      });

      if (key && key.trim()) {
        updateAiConfig({ openrouterApiKey: key.trim() });
        console.log(COLORS.success('\n  ✓ OpenRouter API key saved!\n'));
        return true;
      }
      continue;
    }

    if (action === 'tavily') {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
      console.log();
      console.log(dim('  Get free key at: tavily.io'));
      console.log(dim('  Current key: ') + (hasTavily ? COLORS.success('(set)') : COLORS.dim('not set')));
      console.log();

      const key = await new Promise((res) => {
        rl.question(dim('  Enter new key (or press Enter to cancel) > '), (answer) => {
          rl.close();
          res(answer);
        });
      });

      if (key && key.trim()) {
        updateAiConfig({ tavilyApiKey: key.trim(), searchEnabled: true });
        console.log(COLORS.success('\n  ✓ Tavily API key saved! Web search enabled.\n'));
        return true;
      }
      continue;
    }

    if (action === 'toggle-search') {
      updateAiConfig({ searchEnabled: !aiCfg.searchEnabled });
      console.log(COLORS.success(`\n  ✓ Web search ${!aiCfg.searchEnabled ? 'enabled' : 'disabled'}\n`));
      return true;
    }
  }
}

async function openSettings() {
  let settingsChanged = false;
  
  while (true) {
    console.log();
    const { choice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: accent(' S E T T I N G S '),
        choices: MAIN,
        prefix: accent('◆')
      }
    ]);

    if (choice === 'Exit Settings') {
      return { reloaded: settingsChanged };
    }

    if (choice === 'Change Name') {
      let cfg = loadConfig();
      console.log(`\n  ${dim('Current:')} ${accent(cfg.name)}\n`);
      const { newName } = await inquirer.prompt([
        {
          type: 'input',
          name: 'newName',
          message: 'New name:',
          prefix: accent('◆')
        }
      ]);
      if (newName && newName.trim()) {
        updateConfig({ name: newName.trim() });
        console.log(`\n  ${COLORS.success('✔')} Name changed to ${newName.trim()}\n`);
        settingsChanged = true;
      } else {
        console.log(dim('\n  (no change)\n'));
      }
    }

    if (choice === 'Theme') {
      const changed = await showThemePicker();
      if (changed) settingsChanged = true;
    }

    if (choice === 'Text Color') {
      const changed = await showTextColorPicker();
      if (changed) settingsChanged = true;
    }

    if (choice === 'Font Style') {
      const changed = await showFontPicker();
      if (changed) settingsChanged = true;
    }

    if (choice === 'AI Assistant') {
      const changed = await showAIPanel();
      if (changed) settingsChanged = true;
    }

    if (choice === 'Connected Accounts') {
      const changed = await showAccounts();
      if (changed) settingsChanged = true;
    }
  }
  
  return { reloaded: settingsChanged };
}

module.exports = { openSettings };