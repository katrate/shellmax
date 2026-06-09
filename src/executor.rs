use anyhow::Result;
use std::env;
use std::process::Command;
use std::sync::Mutex;

static CWD: Mutex<Option<String>> = Mutex::new(None);

fn get_cwd_inner() -> String {
    let mut cwd = CWD.lock().unwrap();
    cwd.clone().unwrap_or_else(|| {
        let current = env::current_dir()
            .ok()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| ".".into());
        *cwd = Some(current.clone());
        current
    })
}

pub fn get_cwd() -> String {
    get_cwd_inner()
}

pub fn run_shell(input: &str) -> Result<String> {
    let trimmed = input.trim().to_string();
    if trimmed.is_empty() {
        return Ok(String::new());
    }

    if trimmed.starts_with("cd ") || trimmed == "cd" {
        let target = trimmed[2..].trim();
        let target = if target.is_empty() {
            dirs::home_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| ".".into())
        } else {
            target.replace(
                '~',
                &dirs::home_dir()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default(),
            )
        };
        match env::set_current_dir(&target) {
            Ok(_) => {
                let mut cwd = CWD.lock().unwrap();
                *cwd = Some(env::current_dir().unwrap().to_string_lossy().to_string());
                Ok(String::new())
            }
            Err(e) => Ok(format!("shellmax: cd: {}", e)),
        }
    } else {
        let (shell, flag) = if cfg!(target_os = "windows") {
            ("cmd.exe", "/C")
        } else {
            ("/bin/bash", "-c")
        };
        let output = Command::new(shell)
            .arg(flag)
            .arg(&trimmed)
            .current_dir(get_cwd_inner())
            .output()?;
        let mut result = String::from_utf8_lossy(&output.stdout).to_string();
        if !output.stderr.is_empty() {
            if !result.is_empty() {
                result.push('\n');
            }
            result.push_str(&String::from_utf8_lossy(&output.stderr));
        }
        Ok(result.trim().to_string())
    }
}
