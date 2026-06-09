use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::Mutex;

static APP_CACHE: Mutex<Option<Vec<(String, String)>>> = Mutex::new(None);

fn normalize(name: &str) -> String {
    name.to_lowercase().replace([' ', '-', '_', '.'], "")
}

pub fn get_apps() -> Vec<(String, String)> {
    let cache = APP_CACHE.lock().unwrap();
    if let Some(ref cached) = *cache {
        return cached.clone();
    }
    drop(cache);
    refresh_cache();
    APP_CACHE.lock().unwrap().clone().unwrap_or_default()
}

pub fn refresh_cache() -> usize {
    let apps = detect();
    let count = apps.len();
    let mut cache = APP_CACHE.lock().unwrap();
    *cache = Some(apps);
    count
}

fn detect() -> Vec<(String, String)> {
    if cfg!(target_os = "windows") {
        detect_windows()
    } else if cfg!(target_os = "macos") {
        detect_macos()
    } else {
        detect_linux()
    }
}

fn detect_windows() -> Vec<(String, String)> {
    let mut map: HashMap<String, String> = HashMap::new();

    // 1. Get-StartApps — Store/UWP apps
    if let Ok(out) = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress",
        ])
        .output()
    {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !stdout.is_empty() {
                let items: Vec<serde_json::Value> =
                    serde_json::from_str(&stdout).unwrap_or_else(|_| {
                        if let Ok(single) = serde_json::from_str::<serde_json::Value>(&stdout) {
                            vec![single]
                        } else {
                            vec![]
                        }
                    });
                for item in &items {
                    if let (Some(name), Some(appid)) = (
                        item.get("Name").and_then(|n| n.as_str()),
                        item.get("AppID").and_then(|a| a.as_str()),
                    ) {
                        let key = normalize(name);
                        map.entry(key)
                            .or_insert_with(|| format!("store:{}", appid));
                    }
                }
            }
        }
    }

    // 2. Start Menu .lnk files
    let sm_dirs = vec![
        format!(
            "{}\\Microsoft\\Windows\\Start Menu\\Programs",
            std::env::var("APPDATA").unwrap_or_default()
        ),
        "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs".into(),
    ];
    for dir in &sm_dirs {
        if !Path::new(dir).exists() {
            continue;
        }
        for entry in walk_files(dir, 5) {
            if let Some(name) = entry.1.file_stem() {
                let display = name.to_string_lossy().to_string();
                let key = normalize(&display);
                map.entry(key)
                    .or_insert_with(|| format!("lnk:{}", entry.1.to_string_lossy()));
            }
        }
    }

    // 3. Registry App Paths
    if let Ok(out) = Command::new("reg")
        .args(["query", "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths", "/s"])
        .output()
    {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            for line in stdout.lines() {
                if let Some(cap) = line.trim().strip_suffix(".exe") {
                    let name = cap.split('\\').last().unwrap_or(cap).trim();
                    if !name.is_empty() && name != "App Paths" && !name.contains(" ") {
                        let key = normalize(name);
                        map.entry(key)
                            .or_insert_with(|| format!("reg:{}", name));
                    }
                }
            }
        }
    }

    // 4. Program Files directories
    let localappdata = std::env::var("LOCALAPPDATA").unwrap_or_default();
    for pf_dir in &[
        "C:\\Program Files",
        "C:\\Program Files (x86)",
        &format!("{}\\Local\\Programs", localappdata),
    ] {
        if !Path::new(pf_dir).exists() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(pf_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                let key = normalize(&name);
                map.entry(key)
                    .or_insert_with(|| format!("pf:{}", name));
            }
        }
    }

    let mut result: Vec<_> = map.into_iter().collect();
    result.sort_by(|a, b| a.0.cmp(&b.0));
    result
}

fn walk_files(dir: &str, max_depth: u32) -> Vec<(String, std::path::PathBuf)> {
    let mut result = Vec::new();
    walk_inner(dir, 0, max_depth, &mut result);
    result
}

fn walk_inner(
    dir: &str,
    depth: u32,
    max_depth: u32,
    out: &mut Vec<(String, std::path::PathBuf)>,
) {
    if depth > max_depth {
        return;
    }
    let dir_path = Path::new(dir);
    if !dir_path.is_dir() {
        return;
    }
    if let Ok(entries) = fs::read_dir(dir_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                walk_inner(&path.to_string_lossy(), depth + 1, max_depth, out);
            } else if path.extension().map(|e| e == "lnk").unwrap_or(false) {
                if let Some(stem) = path.file_stem() {
                    out.push((stem.to_string_lossy().to_string(), path));
                }
            }
        }
    }
}

fn detect_macos() -> Vec<(String, String)> {
    let mut map = HashMap::new();
    let home = dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    for dir in &[
        "/Applications",
        "/System/Applications",
        &format!("{}/Applications", home),
    ] {
        if !Path::new(dir).exists() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if let Some(display) = name.strip_suffix(".app") {
                    let key = normalize(display);
                    map.entry(key).or_insert_with(|| format!("mac:{}", display));
                }
            }
        }
    }
    let mut result: Vec<_> = map.into_iter().collect();
    result.sort_by(|a, b| a.0.cmp(&b.0));
    result
}

fn detect_linux() -> Vec<(String, String)> {
    let mut map = HashMap::new();
    let home = dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    for dir in &[
        "/usr/share/applications",
        "/usr/local/share/applications",
        &format!("{}/.local/share/applications", home),
    ] {
        if !Path::new(dir).exists() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map(|e| e == "desktop").unwrap_or(false) {
                    if let Ok(content) = fs::read_to_string(&path) {
                        for line in content.lines() {
                            if let Some(name) = line.strip_prefix("Name=") {
                                let key = normalize(name);
                                map.entry(key).or_insert_with(|| format!("linux:{}", name));
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
    let mut result: Vec<_> = map.into_iter().collect();
    result.sort_by(|a, b| a.0.cmp(&b.0));
    result
}
