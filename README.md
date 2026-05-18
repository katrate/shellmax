# ShellMax

**A premium, fully customizable terminal with built-in AI assistant.**

```
  ____  _          _ _ __  __
 / ___|| |__   ___| | |  \/  | __ ___  __
 \___ \| '_ \ / _ \ | | |\/| |/ _` \ \/ /
  ___) | | | |  __/ | | |  | | (_| |>  <
 |____/|_| |_|\___|_|_|_|  |_|\__,_/_/\_\
```

---

## One-Line Install (Recommended)

```bash
npx shellmax
```

---

Or clone and install manually:

```bash
git clone https://github.com/katrate/shellmax.git
cd shellmax
npm install -g .
shellmax
```

---

## AI Assistant (Default Mode)

**Everything you type goes to AI by default.** No prefix needed for AI chat.

```
You  explain quantum computing
AI   Quantum computing uses quantum bits (qubits) that can exist in multiple states...
```

### AI Commands

| Command | Description |
|---|---|
| `/ai <message>` | Chat with AI |
| `/ai status` | Show AI configuration |
| `/ai clear` | Clear chat history |
| `/ai config openrouter <key>` | Set OpenRouter API key |
| `/ai config tavily <key>` | Set Tavily API key (web search) |

### AI Configuration

**1. Get OpenRouter API Key (free):**
- Visit [openrouter.ai/keys](https://openrouter.ai/keys)
- Free models: GPT-OSS 120B, Gemma 4B, Qwen Coder, DeepSeek
- Default model: `openai/gpt-oss-120b:free`

**2. Get Tavily API Key (optional, for web search):**
- Visit [tavily.io](https://tavily.io)
- Enables real-time web search for news, release dates, prices, etc.

**AI Features:**
- Remembers conversation context (last 40 messages)
- Auto-summarizes old messages to save context
- Web search for current info (news, release dates, prices)
- Short, natural responses

### AI Tips

- Ask anything: explanations, code help, research, writing
- For current info (news, prices, release dates): Make sure Tavily is configured
- Use **up/down arrows** to navigate command history

---

## ShellMax Commands

Prefix commands with `/` (e.g., `/help`, `/st`)

### General

| Command | Description |
|---|---|
| `/help` | Show all commands |
| `/st` | Open settings |
| `/exit` | Exit ShellMax |
| `/adm` | Run as administrator |
| `/refreshcache` | Re-scan installed apps |

### Apps & Files

| Command | Description |
|---|---|
| `/open <app>` | Launch any installed app |
| `/open ` | Open a file in default app |
| `/open <workspace>` | Open saved workspace |
| `/open <website>` | Open saved website |
| `/listapps` | Show all detected apps |
| `/findapp <name>` | Search apps by name |
| `/find ` | Find and open any file |

### Workspaces

| Command | Description |
|---|---|
| `/crt ws <name> <app1> <app2>` | Create workspace |
| `/crt web <name> <url>` | Save website shortcut |
| `/list ws` | List workspaces |
| `/list web` | List websites |
| `/ws add <name> <item>` | Add item to workspace |
| `/ws rm <name> <item>` | Remove from workspace |
| `/rn ws <old> <new>` | Rename workspace |
| `/rn web <old> <new>` | Rename website |
| `/del ws <name>` | Delete workspace |
| `/del web <name>` | Delete website |

### Quick Access

| Command | Description |
|---|---|
| `/ggl <search>` | Search Google |
| `/yt` | Open YouTube |
| `/gh` | Open GitHub |

### System

| Command | Description |
|---|---|
| `/sysinfo` | System info (CPU, RAM, Disk) |
| `/ping <host>` | Ping a host |
| `/ip` | Local IP |
| `/ip public` | Public IP |
| `/netstat` | Network connections |

### Terminal Commands

Prefix with `*` (e.g., `*ls`, `*cd`)

| Command | Description |
|---|---|
| `*ls` | List files |
| `*cd <folder>` | Change directory |
| `*mkdir <folder>` | Create folder |
| `*<any command>` | Run any terminal command |

### Messaging

| Command | Description |
|---|---|
| `/connect <platform>` | Connect messaging platform |
| `/msg <platform> <name> <text>` | Send message |
| `/mail <email> <sub> <body>` | Send email |
| `/view <platform> <name>` | View conversation |

---

## Settings

Type `/st` to customize:

| Setting | Options |
|---|---|
| Name | Your display name |
| Theme | 10 themes (Midnight, Matrix, Dracula, Neon Punk, Ocean, Sunset, Arctic, Monokai, Crimson, Nord) |
| Text Color | 20 colors |
| Font Style | 30 ASCII fonts |
| AI Assistant | Configure API keys |
| Connected Accounts | WhatsApp, Discord, Telegram, Gmail, Slack, Teams |

---

## Examples

```bash
# AI chat (default mode)
what is docker in simple terms

# AI with search
when is gta 6 releasing

# Commands
/open vscode
/crt ws dev vscode chrome slack
/ggl best coffee shops near me

# Workspace
crt ws morning chrome outlook slack
open morning
```

---

## Requirements

- **Node.js 16+**
- **Git**

---

## License

MIT