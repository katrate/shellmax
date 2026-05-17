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

## Quick Install (One-Line)

```bash
npx shellmax
```

Or install globally:

```bash
npm install -g shellmax
shellmax
```

---

## Manual Install

Requires **Node.js 16+** and **Git**.

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/shellmax.git

# 2. Enter directory
cd shellmax

# 3. Install dependencies
npm install

# 4. Install globally
npm install -g .

# 5. Launch
shellmax
```

> On first launch ShellMax runs through a quick setup: your name and file access permission.

---

## Commands

| Command | Description |
|---|---|
| `open <appname>` | Launch any installed app by name |
| `open <workspace>` | Open a saved workspace (all apps/sites at once) |
| `open <website>` | Open a saved website shortcut |
| `crt ws <name> <app1> <app2>…` | Create a workspace |
| `crt web <name> <url>` | Save a website shortcut |
| `ggl [query]` | Open Google (with optional search) |
| `yt` | Open YouTube |
| `gh` | Open GitHub |
| `st` | Open settings (arrow key navigation) |
| `adm` | Elevate to admin / enable sudo for session |
| `ps: <command>` | Run a PowerShell command (Windows) |
| `name <newname>` | Change your display name |
| `help` | Show ShellMax command list |
| `exit` / `quit` | Exit ShellMax |

All normal terminal commands (`ls`, `cd`, `mkdir`, `git`, `npm`, etc.) work as usual.

---

## Settings

Type `st` to open the settings panel. Navigate with `↑ ↓`, select with `Enter`, go back with `Esc`.

| Setting | Options |
|---|---|
| Theme | 10 themes (Midnight, Matrix, Dracula, Neon Punk, Ocean, Sunset, Arctic, Monokai, Crimson, Nord) |
| Text Color | 20 colors |
| Font Style | 30 figlet ASCII fonts |
| Change Name | Change your display name |

---

## Themes

| Theme | Style |
|---|---|
| Midnight | Deep dark + electric cyan |
| Matrix | Classic hacker green on black |
| Dracula | Purple/pink dark fantasy |
| Neon Punk | Cyberpunk neon on black |
| Ocean | Deep ocean electric blue |
| Sunset | Warm orange and red |
| Arctic | Cold crisp blue/white |
| Monokai | Classic code-editor yellow/green |
| Crimson | Deep red dark |
| Nord | Nordic dark blue |

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

## Stack

- **Node.js** — runtime
- **blessed** — settings TUI
- **figlet** — ASCII art
- **chalk** — terminal colors
- **open** — browser launcher

---

## License

MIT
