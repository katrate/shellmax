# ShellMax

**A premium, fully customizable terminal experience.**

```
  ____  _          _ _ __  __
 / ___|| |__   ___| | |  \/  | __ ___  __
 \___ \| '_ \ / _ \ | | |\/| |/ _` \ \/ /
  ___) | | | |  __/ | | |  | | (_| |>  <
 |____/|_| |_|\___|_|_|_|  |_|\__,_/_/\_\
```

---

## One-Line Install

```bash
npx shellmax
```

This automatically downloads, installs dependencies, and sets up the global command.

Or install globally after cloning:

```bash
git clone https://github.com/katrate/shellmax.git
cd shellmax
npm install -g .
shellmax
```

---

## Commands

### Apps & Files

| Command | Description |
|---|---|
| `open <appname>` | Launch any installed app by name |
| `open <file.ext>` | Find file on system & open it |
| `open <workspace>` | Open a saved workspace (all apps/sites at once) |
| `open <website>` | Open a saved website shortcut |
| `crt ws <name> <app1> <app2>…` | Create a workspace |
| `crt web <name> <url>` | Save a website shortcut |
| `list ws` | List all workspaces |
| `list web` | List all websites |
| `rn ws <old> <new>` | Rename a workspace |
| `rn web <old> <new>` | Rename a website |
| `del ws <name>` | Delete a workspace |
| `del web <name>` | Delete a website |
| `ws add <name> <item>` | Add item to workspace |
| `ws rm <name> <item>` | Remove item from workspace |
| `listapps` | Show all detected apps |
| `findapp <name>` | Search detected apps by name |
| `find <filename>` | Search & open any file on system |
| `refreshcache` | Rescan installed apps |

### Browser

| Command | Description |
|---|---|
| `ggl [query]` | Open Google (with optional search) |
| `yt` | Open YouTube |
| `gh` | Open GitHub |

### Messaging

| Command | Description |
|---|---|
| `connect wa\|dc\|tg\|mail\|slack\|teams` | Connect a messaging platform |
| `msg wa <name/+number> <text>` | Send WhatsApp message |
| `msg dc <username> <text>` | Send Discord DM |
| `msg dc <server> <#channel> <text>` | Send Discord channel message |
| `msg tg <@username/+number> <text>` | Send Telegram message |
| `msg slack <#channel\|user> <text>` | Send Slack message |
| `msg teams <#channel\|user> <text>` | Send Teams message |
| `mail <email> <subject> <body> [file]` | Send email (Gmail) |
| `view wa\|dc\|tg\|slack\|teams <name>` | View last 10 messages |
| `view <email>` | View last 5 emails |

### System

| Command | Description |
|---|---|
| `st` | Open settings |
| `adm` | Enable admin / sudo mode |
| `ps: <command>` | Run a PowerShell command |
| `name <name>` | Change display name |
| `sysinfo` | Show system info (CPU, RAM, Disk) |
| `ip` | Show local IP address |
| `ip public` | Show public IP address |
| `ping <host> [count]` | Ping a host |
| `netstat [flags]` | Show network connections |
| `exit / quit` | Exit ShellMax |

All normal terminal commands (`ls`, `cd`, `mkdir`, `git`, `npm`, etc.) work as usual.

---

## Settings

Type `st` to open the settings panel.

| Setting | Options |
|---|---|
| Change Name | Your display name |
| Theme | 10 themes (Midnight, Matrix, Dracula, Neon Punk, Ocean, Sunset, Arctic, Monokai, Crimson, Nord) |
| Text Color | 20 colors |
| Font Style | 30 figlet ASCII fonts |
| Connected Accounts | WhatsApp, Discord, Telegram, Gmail, Slack, Teams |

---

## Workspace Example

```bash
# Create a workspace called "dev" with VS Code, Chrome, and Slack
crt ws dev vscode chrome slack

# Save a website
crt web myapp https://myapp.com

# Open the whole workspace in one command
open dev

# Open just the website
open myapp
```

---

## Requirements

- **Node.js 16+**
- **Git**

---

## License

MIT