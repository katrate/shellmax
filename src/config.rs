use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Config {
    pub name: String,
    pub theme_idx: usize,
    pub font: String,
    pub workspaces: HashMap<String, Vec<String>>,
    pub websites: HashMap<String, String>,
    pub connected: HashMap<String, bool>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            name: {
                let name = whoami::realname();
                if name.is_empty() { "User".into() } else { name }
            },
            theme_idx: 0,
            font: "Doom".into(),
            workspaces: HashMap::new(),
            websites: HashMap::new(),
            connected: HashMap::new(),
        }
    }
}

fn config_path() -> PathBuf {
    let mut path = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push(".shellmax");
    path.push("config.json");
    path
}

fn ensure_dir() -> Result<()> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    Ok(())
}

pub fn load_config() -> Config {
    let path = config_path();
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => Config::default(),
        }
    } else {
        let cfg = Config::default();
        let _ = save_config(&cfg);
        cfg
    }
}

pub fn save_config(config: &Config) -> Result<()> {
    ensure_dir()?;
    let content = serde_json::to_string_pretty(config)?;
    fs::write(config_path(), content)?;
    Ok(())
}
