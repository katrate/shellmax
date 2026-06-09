use anyhow::{bail, Result};
use crate::config::Config;

pub struct Platform {
    pub id: &'static str,
    pub label: &'static str,
    pub emoji: &'static str,
}

pub const PLATFORMS: &[Platform] = &[
    Platform { id: "wa", label: "WhatsApp", emoji: "\u{1F4F1}" },
    Platform { id: "dc", label: "Discord", emoji: "\u{1F3AE}" },
    Platform { id: "tg", label: "Telegram", emoji: "\u{2708}\u{FE0F}" },
    Platform { id: "mail", label: "Gmail", emoji: "\u{1F4E7}" },
    Platform { id: "slack", label: "Slack", emoji: "\u{1F4AC}" },
    Platform { id: "teams", label: "Teams", emoji: "\u{1F465}" },
];

pub fn is_connected(platform_id: &str, config: &Config) -> bool {
    config.connected.get(platform_id).copied().unwrap_or(false)
}

pub fn connect(platform_id: &str, config: &mut Config) -> Result<String> {
    let p = PLATFORMS.iter().find(|p| p.id == platform_id);
    match p {
        Some(platform) => {
            config.connected.insert(platform_id.to_string(), true);
            crate::config::save_config(config)?;
            Ok(format!("{} {} connected! Use credentials from settings in future versions.", platform.emoji, platform.label))
        }
        None => {
            let ids: Vec<&str> = PLATFORMS.iter().map(|p| p.id).collect();
            bail!("Unknown platform: {}. Available: {}", platform_id, ids.join(", "))
        }
    }
}
