use crate::apps;
use crate::themes::THEMES;

pub struct CommandResult {
    pub output: String,
    pub exit: bool,
}

pub fn handle_command(input: &str, config: &mut crate::config::Config) -> CommandResult {
    let parts: Vec<&str> = input.trim().split_whitespace().collect();
    if parts.is_empty() {
        return CommandResult { output: String::new(), exit: false };
    }
    let cmd = parts[0].to_lowercase();
    let _theme = &THEMES[config.theme_idx];

    match cmd.as_str() {
        "help" => CommandResult { output: get_help_text(config.theme_idx), exit: false },

        "st" | "settings" => {
            CommandResult { output: "<!-- SETTINGS_MODE -->".into(), exit: false }
        }

        "exit" | "quit" => CommandResult { output: "Goodbye! Thanks for using ShellMax".into(), exit: true },

        "sysinfo" => {
            let info = get_sysinfo();
            CommandResult { output: info, exit: false }
        }

        "ggl" => {
            let query = parts[1..].join(" ");
            let url = if query.is_empty() {
                "https://www.google.com".to_string()
            } else {
                format!("https://www.google.com/search?q={}", urlencoding(&query))
            };
            let _ = open::that(&url);
            CommandResult { output: format!("Opening Google{}...", if query.is_empty() { String::new() } else { format!(" for \"{}\"", query) }), exit: false }
        }

        "yt" => {
            let _ = open::that("https://www.youtube.com");
            CommandResult { output: "Opening YouTube...".into(), exit: false }
        }

        "gh" => {
            let _ = open::that("https://github.com");
            CommandResult { output: "Opening GitHub...".into(), exit: false }
        }

        "theme" if parts.len() >= 2 => {
            let name = parts[1..].join(" ");
            if let Some(idx) = THEMES.iter().position(|t| t.name.to_lowercase() == name.to_lowercase()) {
                config.theme_idx = idx;
                let _ = crate::config::save_config(config);
                CommandResult { output: format!("Theme set to \"{}\"", THEMES[idx].name), exit: false }
            } else {
                let names: Vec<&str> = THEMES.iter().map(|t| t.name).collect();
                CommandResult { output: format!("Unknown theme. Available: {}", names.join(", ")), exit: false }
            }
        }

        "theme" => {
            let names: Vec<String> = THEMES.iter().enumerate()
                .map(|(i, t)| format!("{}. {} - {}", i + 1, t.name, t.desc))
                .collect();
            CommandResult { output: format!("Available themes:\n  {}", names.join("\n  ")), exit: false }
        }

        "refreshcache" | "rescan" => {
            let count = apps::refresh_cache();
            CommandResult { output: format!("Found {} apps. Cache updated.", count), exit: false }
        }

        "listapps" => {
            let app_list = apps::get_apps();
            if app_list.is_empty() {
                CommandResult { output: "No apps found. Try /refreshcache".into(), exit: false }
            } else {
                let mut out = String::new();
                for (i, (_k, val)) in app_list.iter().enumerate() {
                    let display = val.split(':').last().unwrap_or(val);
                    out.push_str(&format!("  {:3}. {}\n", i + 1, display));
                }
                out.push_str(&format!("\n  Total: {} apps", app_list.len()));
                CommandResult { output: out, exit: false }
            }
        }

        "open" if parts.len() >= 2 => {
            let target = parts[1..].join(" ");
            let app_list = apps::get_apps();
            let norm = |s: &str| s.to_lowercase().replace([' ', '-', '_', '.'], "");
            let key = norm(&target);

            let entry = app_list.iter().find(|(k, _)| norm(k) == key).map(|(_, v)| v);

            if let Some(launch_str) = entry {
                match launch_str.split_once(':') {
                    Some(("store", appid)) => {
                        let _ = std::process::Command::new("explorer")
                            .arg(format!("shell:AppsFolder\\{}", appid))
                            .spawn();
                        CommandResult { output: format!("Launched Store app: {}", target), exit: false }
                    }
                    Some(("lnk", path)) => {
                        let _ = std::process::Command::new("cmd")
                            .args(["/c", "start", "", path])
                            .spawn();
                        CommandResult { output: format!("Launched: {}", target), exit: false }
                    }
                    Some(("reg", name)) | Some(("pf", name)) => {
                        let _ = std::process::Command::new("cmd")
                            .args(["/c", "start", "", name])
                            .spawn();
                        CommandResult { output: format!("Launched: {}", target), exit: false }
                    }
                    _ => {
                        let _ = open::that(launch_str);
                        CommandResult { output: format!("Launched: {}", target), exit: false }
                    }
                }
            } else if config.websites.contains_key(&target.to_lowercase()) {
                let url = &config.websites[&target.to_lowercase()];
                let _ = open::that(url);
                CommandResult { output: format!("Opened: {}", url), exit: false }
            } else if let Some(ws) = config.workspaces.get(&target.to_lowercase()) {
                for item in ws {
                    let _ = open::that(item);
                }
                CommandResult { output: format!("Opened workspace \"{}\" with {} items", target, ws.len()), exit: false }
            } else {
                CommandResult { output: format!("Could not find \"{}\". Try /listapps or /refreshcache", target), exit: false }
            }
        }

        "ping" if parts.len() >= 2 => {
            let host = parts[1];
            let output = crate::executor::run_shell(&format!("ping -n 4 {}", host)).unwrap_or_default();
            CommandResult { output: if output.is_empty() { format!("Pinging {}... (no output)", host) } else { output }, exit: false }
        }

        "ip" => {
            let cmd = if cfg!(target_os = "windows") { "ipconfig" } else { "ifconfig" };
            let output = crate::executor::run_shell(cmd).unwrap_or_default();
            CommandResult { output: if output.is_empty() { "Could not get IP info".into() } else { output }, exit: false }
        }

        "adm" => {
            CommandResult { output: "Admin mode not available in this version.".into(), exit: false }
        }

        "crt" if parts.len() >= 4 && parts[1] == "ws" => {
            let ws_name = parts[2].to_lowercase();
            let items: Vec<String> = parts[3..].iter().map(|s| s.to_string()).collect();
            config.workspaces.insert(ws_name.clone(), items.clone());
            let _ = crate::config::save_config(config);
            CommandResult { output: format!("Workspace \"{}\" created with: {}", parts[2], items.join(", ")), exit: false }
        }

        "crt" if parts.len() >= 4 && parts[1] == "web" => {
            let mut url = parts[3].to_string();
            if !url.starts_with("http") {
                url = format!("https://{}", url);
            }
            config.websites.insert(parts[2].to_lowercase(), url.clone());
            let _ = crate::config::save_config(config);
            CommandResult { output: format!("Website saved: \"{}\" -> {}", parts[2], url), exit: false }
        }

        "list" if parts.len() >= 2 && parts[1] == "ws" => {
            if config.workspaces.is_empty() {
                CommandResult { output: "No workspaces saved.".into(), exit: false }
            } else {
                let mut out = String::new();
                for (name, items) in &config.workspaces {
                    out.push_str(&format!("  {}:\n", name));
                    for item in items {
                        out.push_str(&format!("    - {}\n", item));
                    }
                }
                CommandResult { output: out.trim_end().to_string(), exit: false }
            }
        }

        "list" if parts.len() >= 2 && parts[1] == "web" => {
            if config.websites.is_empty() {
                CommandResult { output: "No websites saved.".into(), exit: false }
            } else {
                let mut out = String::new();
                for (name, url) in &config.websites {
                    out.push_str(&format!("  {} -> {}\n", name, url));
                }
                CommandResult { output: out.trim_end().to_string(), exit: false }
            }
        }

        "del" if parts.len() >= 3 && parts[1] == "ws" => {
            let name = parts[2].to_lowercase();
            if config.workspaces.remove(&name).is_some() {
                let _ = crate::config::save_config(config);
                CommandResult { output: format!("Workspace \"{}\" deleted.", parts[2]), exit: false }
            } else {
                CommandResult { output: format!("Workspace \"{}\" not found.", parts[2]), exit: false }
            }
        }

        "del" if parts.len() >= 3 && parts[1] == "web" => {
            let name = parts[2].to_lowercase();
            if config.websites.remove(&name).is_some() {
                let _ = crate::config::save_config(config);
                CommandResult { output: format!("Website \"{}\" deleted.", parts[2]), exit: false }
            } else {
                CommandResult { output: format!("Website \"{}\" not found.", parts[2]), exit: false }
            }
        }

        "connect" if parts.len() >= 2 => {
            let platform = parts[1].to_lowercase();
            match crate::messaging::connect(&platform, config) {
                Ok(msg) => CommandResult { output: msg, exit: false },
                Err(e) => CommandResult { output: format!("Error: {}", e), exit: false },
            }
        }

        _ => {
            CommandResult { output: String::new(), exit: false }
        }
    }
}

fn get_sysinfo() -> String {
    let os_info = format!("{} {}", std::env::consts::OS, std::env::consts::ARCH);
    let hostname = whoami::fallible::hostname().unwrap_or_else(|_| "unknown".into());
    let username = whoami::username();
    let cwd = crate::executor::get_cwd();
    format!(
        "Hostname: {}\nUser: {}\nOS: {}\nCWD: {}",
        hostname, username, os_info, cwd
    )
}

fn urlencoding(s: &str) -> String {
    s.chars().map(|c| match c {
        'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
        ' ' => "+".to_string(),
        _ => format!("%{:02X}", c as u8),
    }).collect()
}

pub fn get_help_text(theme_idx: usize) -> String {
    let names: Vec<String> = (0..THEMES.len()).map(|i| {
        if i == theme_idx {
            format!("*{}*", THEMES[i].name)
        } else {
            THEMES[i].name.to_string()
        }
    }).collect();

    format!(
        r#"╭── ShellMax Commands ──╮

General:
  /help          Show this help
  /st /settings  Open settings panel
  /exit /quit    Exit ShellMax

Themes:
  /theme                List available themes
  /theme <name>         Change theme ({})
  /theme <number>       Select by number

Apps & Files:
  /open <name>    Launch an app or file
  /listapps       Show installed apps
  /refreshcache   Re-scan installed apps

Workspaces:
  /crt ws <name> <items...>   Create workspace
  /crt web <name> <url>       Save website
  /list ws                    List workspaces
  /list web                   List websites
  /del ws <name>              Delete workspace
  /del web <name>             Delete website

Quick Access:
  /ggl <query>   Search Google
  /yt            Open YouTube
  /gh            Open GitHub

System:
  /sysinfo       System information
  /ping <host>   Ping a host
  /ip            Show IP config

Terminal (*):
  *<command>     Run any terminal command
  *cd <dir>      Change directory

Messaging:
  /connect <platform>  Connect messaging (wa, dc, tg, mail, slack, teams)

---
  / for commands  |  * for terminal"#,
        names.join(", ")
    )
}
