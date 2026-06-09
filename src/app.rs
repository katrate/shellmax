use std::time::Duration;
use anyhow::Result;
use crossterm::event::{self, Event, KeyCode, KeyEventKind, KeyModifiers, MouseButton, MouseEventKind};

const PAGE_SCROLL: usize = 10;
use ratatui::backend::CrosstermBackend;
use ratatui::Terminal;

use crate::commands::handle_command;
use crate::config::{load_config, save_config, Config};
use crate::executor;
use crate::themes::THEMES;
use crate::ui;

pub struct Message {
    pub text: String,
    pub msg_type: MessageType,
}

#[derive(Clone, Copy, Debug)]
pub enum MessageType {
    User,
    ShellMax,
    Output,
    System,
    Error,
}

pub struct App {
    pub messages: Vec<Message>,
    pub input: String,
    pub cursor_pos: usize,
    pub history: Vec<String>,
    pub history_idx: Option<usize>,
    pub scroll_offset: usize,
    pub auto_scroll: bool,
    pub config: Config,
    pub should_quit: bool,
    pub settings_mode: bool,
    pub settings_selection: usize,
    pub name_edit_mode: bool,
    pub name_edit_buf: String,
}

impl App {
    pub fn new() -> Result<Self> {
        let cfg = load_config();
        let mut app = App {
            messages: Vec::new(),
            input: String::new(),
            cursor_pos: 0,
            history: Vec::new(),
            history_idx: None,
            scroll_offset: 0,
            auto_scroll: true,
            config: cfg,
            should_quit: false,
            settings_mode: false,
            settings_selection: 0,
            name_edit_mode: false,
            name_edit_buf: String::new(),
        };
        app.add_system_message(&format!(
            "Welcome to ShellMax, {}! Type /help for commands.",
            app.config.name
        ));
        app.add_system_message("/st to customize | * for terminal commands");
        Ok(app)
    }

    pub fn add_message(&mut self, text: &str, msg_type: MessageType) {
        self.messages.push(Message {
            text: text.to_string(),
            msg_type,
        });
        if self.messages.len() > 500 {
            self.messages.remove(0);
        }
        if self.auto_scroll {
            self.scroll_offset = usize::MAX;
        }
    }

    pub fn add_user_message(&mut self, text: &str) {
        self.add_message(text, MessageType::User);
    }

    pub fn add_shellmax_message(&mut self, text: &str) {
        self.add_message(text, MessageType::ShellMax);
    }

    pub fn add_output_message(&mut self, text: &str) {
        self.add_message(text, MessageType::Output);
    }

    pub fn add_system_message(&mut self, text: &str) {
        self.add_message(text, MessageType::System);
    }

    pub fn add_error_message(&mut self, text: &str) {
        self.add_message(text, MessageType::Error);
    }

    pub fn run(&mut self) -> Result<()> {
        let mut terminal = Self::setup_terminal()?;

        while !self.should_quit {
            terminal.draw(|f| ui::render(f, self))?;

            if !event::poll(Duration::from_millis(50))? {
                continue;
            }

            match event::read()? {
                Event::Key(key) => {
                    if key.kind == KeyEventKind::Press {
                        self.handle_key(key);
                    }
                }
                Event::Mouse(mouse) => {
                    self.handle_mouse(mouse);
                }
                _ => {}
            }
        }

        Self::restore_terminal()?;
        Ok(())
    }

    fn setup_terminal() -> Result<Terminal<CrosstermBackend<std::io::Stdout>>> {
        crossterm::terminal::enable_raw_mode()?;
        let mut stdout = std::io::stdout();
        crossterm::execute!(
            stdout,
            crossterm::terminal::EnterAlternateScreen,
            crossterm::event::EnableMouseCapture
        )?;
        let backend = CrosstermBackend::new(stdout);
        let terminal = Terminal::new(backend)?;
        Ok(terminal)
    }

    fn restore_terminal() -> Result<()> {
        crossterm::execute!(
            std::io::stdout(),
            crossterm::terminal::LeaveAlternateScreen,
            crossterm::event::DisableMouseCapture
        )?;
        crossterm::terminal::disable_raw_mode()?;
        Ok(())
    }

    fn handle_mouse(&mut self, mouse: crossterm::event::MouseEvent) {
        if self.name_edit_mode || self.settings_mode {
            return;
        }
        match mouse.kind {
            MouseEventKind::ScrollUp => {
                self.auto_scroll = false;
                self.scroll_offset = self.scroll_offset.saturating_sub(3);
            }
            MouseEventKind::ScrollDown => {
                self.auto_scroll = false;
                self.scroll_offset = self.scroll_offset.saturating_add(3);
            }
            MouseEventKind::Down(MouseButton::Left) => {
                self.auto_scroll = false;
                let row = mouse.row as usize;
                let total = self.messages.len().max(1);
                let pct = row as f32 / 50.0;
                self.scroll_offset = (total as f32 * pct * 10.0) as usize;
            }
            _ => {}
        }
    }

    fn handle_key(&mut self, key: crossterm::event::KeyEvent) {
        if self.name_edit_mode {
            self.handle_name_edit(key);
            return;
        }

        if self.settings_mode {
            self.handle_settings_key(key);
            return;
        }

        match key.code {
            KeyCode::Char(c) => {
                if c == 'c' && key.modifiers.contains(KeyModifiers::CONTROL) {
                    self.should_quit = true;
                    return;
                }
                if c == 'd' && key.modifiers.contains(KeyModifiers::CONTROL) {
                    self.should_quit = true;
                    return;
                }
                self.input.insert(self.cursor_pos, c);
                self.cursor_pos += 1;
                self.history_idx = None;
            }
            KeyCode::Backspace => {
                if self.cursor_pos > 0 && !self.input.is_empty() {
                    self.cursor_pos -= 1;
                    self.input.remove(self.cursor_pos);
                }
            }
            KeyCode::Delete => {
                if self.cursor_pos < self.input.len() {
                    self.input.remove(self.cursor_pos);
                }
            }
            KeyCode::Enter => {
                let trimmed = self.input.trim().to_string();
                if !trimmed.is_empty() {
                    self.execute_input(&trimmed);
                    self.history.insert(0, trimmed);
                    if self.history.len() > 50 {
                        self.history.pop();
                    }
                }
                self.input.clear();
                self.cursor_pos = 0;
                self.history_idx = None;
            }
            KeyCode::Up if key.modifiers.contains(KeyModifiers::CONTROL) => {
                self.auto_scroll = false;
                self.scroll_offset = self.scroll_offset.saturating_sub(1);
            }
            KeyCode::Down if key.modifiers.contains(KeyModifiers::CONTROL) => {
                self.scroll_offset = self.scroll_offset.saturating_add(1);
            }
            KeyCode::Home if key.modifiers.contains(KeyModifiers::CONTROL) => {
                self.scroll_offset = 0;
                self.auto_scroll = false;
            }
            KeyCode::End if key.modifiers.contains(KeyModifiers::CONTROL) => {
                self.scroll_offset = usize::MAX;
                self.auto_scroll = true;
            }
            KeyCode::Up => {
                if !self.history.is_empty() {
                    let idx = match self.history_idx {
                        Some(i) if i < self.history.len() - 1 => i + 1,
                        _ => 0,
                    };
                    self.history_idx = Some(idx);
                    self.input = self.history[idx].clone();
                    self.cursor_pos = self.input.len();
                }
            }
            KeyCode::Down => {
                if let Some(idx) = self.history_idx {
                    if idx > 0 {
                        let new_idx = idx - 1;
                        self.history_idx = Some(new_idx);
                        self.input = self.history[new_idx].clone();
                    } else {
                        self.history_idx = None;
                        self.input.clear();
                    }
                    self.cursor_pos = self.input.len();
                }
            }
            KeyCode::Left => {
                if self.cursor_pos > 0 {
                    self.cursor_pos -= 1;
                }
            }
            KeyCode::Right => {
                if self.cursor_pos < self.input.len() {
                    self.cursor_pos += 1;
                }
            }
            KeyCode::PageUp => {
                self.auto_scroll = false;
                self.scroll_offset = self.scroll_offset.saturating_sub(PAGE_SCROLL);
            }
            KeyCode::PageDown => {
                self.scroll_offset = self.scroll_offset.saturating_add(PAGE_SCROLL);
            }
            KeyCode::Esc => {
                if !self.input.is_empty() {
                    self.input.clear();
                    self.cursor_pos = 0;
                }
            }
            KeyCode::Tab => {
                self.complete_input();
            }
            _ => {}
        }
    }

    fn handle_settings_key(&mut self, key: crossterm::event::KeyEvent) {
        let settings_options = 4; // Change Name, Theme, Font, Back

        match key.code {
            KeyCode::Up => {
                if self.settings_selection > 0 {
                    self.settings_selection -= 1;
                }
            }
            KeyCode::Down => {
                if self.settings_selection < settings_options - 1 {
                    self.settings_selection += 1;
                }
            }
            KeyCode::Enter => {
                match self.settings_selection {
                    0 => {
                        self.name_edit_mode = true;
                        self.name_edit_buf = self.config.name.clone();
                        self.settings_mode = false;
                    }
                    1 => {
                        self.config.theme_idx = (self.config.theme_idx + 1) % THEMES.len();
                        let _ = save_config(&self.config);
                        self.add_shellmax_message(&format!(
                            "Theme changed to \"{}\"",
                            THEMES[self.config.theme_idx].name
                        ));
                    }
                    2 => {
                        if self.config.theme_idx > 0 {
                            self.config.theme_idx -= 1;
                        } else {
                            self.config.theme_idx = THEMES.len() - 1;
                        }
                        let _ = save_config(&self.config);
                        self.add_shellmax_message(&format!(
                            "Theme changed to \"{}\"",
                            THEMES[self.config.theme_idx].name
                        ));
                    }
                    3 => {
                        self.settings_mode = false;
                    }
                    _ => {}
                }
            }
            KeyCode::Esc | KeyCode::Char('q') => {
                self.settings_mode = false;
            }
            _ => {}
        }
    }

    fn handle_name_edit(&mut self, key: crossterm::event::KeyEvent) {
        match key.code {
            KeyCode::Char(c) => {
                self.name_edit_buf.push(c);
            }
            KeyCode::Backspace => {
                self.name_edit_buf.pop();
            }
            KeyCode::Enter => {
                let new_name = self.name_edit_buf.trim().to_string();
                if !new_name.is_empty() {
                    self.config.name = new_name;
                    let _ = save_config(&self.config);
                    self.add_shellmax_message(&format!("Name changed to \"{}\"", self.config.name));
                }
                self.name_edit_mode = false;
                self.name_edit_buf.clear();
            }
            KeyCode::Esc => {
                self.name_edit_mode = false;
                self.name_edit_buf.clear();
            }
            _ => {}
        }
    }

    fn execute_input(&mut self, input: &str) {
        self.scroll_offset = usize::MAX;
        self.auto_scroll = true;
        self.add_user_message(input);

        if input.starts_with('/') {
            let cmd = input[1..].trim();
            let result = handle_command(cmd, &mut self.config);

            if result.output == "<!-- SETTINGS_MODE -->" {
                self.settings_mode = true;
                self.settings_selection = 0;
                return;
            }

            if result.exit {
                self.add_shellmax_message(&result.output);
                self.should_quit = true;
                return;
            }

            if !result.output.is_empty() {
                self.add_shellmax_message(&result.output);
            } else {
                self.add_shellmax_message("Unknown command. Type /help for available commands.");
            }
        } else if input.starts_with('*') {
            let shell_cmd = input[1..].trim();
            self.add_system_message(&format!("$ {}", shell_cmd));
            match executor::run_shell(shell_cmd) {
                Ok(output) if !output.is_empty() => {
                    self.add_output_message(&output);
                }
                Ok(_) => {
                    self.add_output_message("(no output)");
                }
                Err(e) => {
                    self.add_error_message(&format!("Error: {}", e));
                }
            }
        } else {
            self.add_shellmax_message("Use / for commands or * for terminal commands.");
        }
    }

    fn complete_input(&mut self) {
        let known_commands = [
            "help", "st", "settings", "exit", "quit", "sysinfo",
            "ggl", "yt", "gh", "theme", "listapps", "refreshcache",
            "open", "connect", "ping", "ip", "adm",
            "crt ws", "crt web", "list ws", "list web",
            "del ws", "del web",
        ];

        if self.input.starts_with('/') {
            let partial = self.input[1..].to_lowercase();
            if !partial.is_empty() {
                if let Some(matched) = known_commands.iter().find(|c| c.starts_with(&partial)) {
                    self.input = format!("/{}", matched);
                    self.cursor_pos = self.input.len();
                }
            }
        } else if self.input.starts_with('*') {
            let partial = self.input[1..].to_lowercase();
            if !partial.is_empty() {
                let shell_commands = ["cd", "ls", "dir", "mkdir", "rmdir", "ping", "ipconfig",
                    "echo", "type", "cat", "pwd", "whoami", "systeminfo", "netstat"];
                if let Some(matched) = shell_commands.iter().find(|c| c.starts_with(&partial)) {
                    self.input = format!("*{}", matched);
                    self.cursor_pos = self.input.len();
                }
            }
        }
    }
}
