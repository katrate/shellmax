use chrono::Local;
use ratatui::layout::{Alignment, Constraint, Direction, Layout, Rect};
use ratatui::style::{Modifier, Style};
use ratatui::text::{Line, Span, Text};
use ratatui::widgets::{Block, BorderType, Borders, Clear, List, ListItem, Paragraph};
use ratatui::Frame;

use crate::app::{App, MessageType};
use crate::themes::Theme;

pub fn render(frame: &mut Frame, app: &App) {
    let theme = crate::themes::get_theme(app.config.theme_idx);
    let area = frame.size();

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(1),
            Constraint::Min(1),
            Constraint::Length(3),
            Constraint::Length(1),
        ])
        .split(area);

    render_top_bar(frame, chunks[0], app, theme);
    render_messages(frame, chunks[1], app, theme);
    render_input(frame, chunks[2], app, theme);
    render_status_bar(frame, chunks[3], app, theme);

    if app.settings_mode {
        render_settings(frame, area, app, theme);
    }

    if app.name_edit_mode {
        render_name_edit(frame, area, app, theme);
    }
}

fn render_top_bar(frame: &mut Frame, area: Rect, _app: &App, theme: &Theme) {
    let time = Local::now().format("%H:%M:%S").to_string();
    let hostname = whoami::fallible::hostname().unwrap_or_else(|_| "unknown".into());

    let title = format!(" ◆ ShellMax v1.0.0 ");
    let right = format!(" {} | {} ", hostname, time);

    let padding = (area.width as usize).saturating_sub(title.len() + right.len());
    let padding_str = " ".repeat(padding);

    let line = Line::from(vec![
        Span::styled(title, Style::default().fg(theme.accent).add_modifier(Modifier::BOLD)),
        Span::styled(&padding_str, Style::default().fg(theme.dim)),
        Span::styled(right, Style::default().fg(theme.dim)),
    ]);

    let block = Block::default()
        .style(Style::default().bg(theme.surface))
        .borders(Borders::BOTTOM)
        .border_type(BorderType::Plain)
        .border_style(Style::default().fg(theme.border));

    let paragraph = Paragraph::new(line).block(block);
    frame.render_widget(paragraph, area);
}

fn render_messages(frame: &mut Frame, area: Rect, app: &App, theme: &Theme) {
    let inner_height = (area.height as usize).saturating_sub(2);

    if app.messages.is_empty() {
        let block = Block::default()
            .borders(Borders::ALL)
            .border_type(BorderType::Rounded)
            .border_style(Style::default().fg(theme.border));
        let text = Paragraph::new(" Welcome to ShellMax! Type /help to begin.")
            .style(Style::default().fg(theme.dim))
            .block(block)
            .alignment(Alignment::Center);
        frame.render_widget(text, area);
        return;
    }

    let mut all_lines: Vec<Line> = Vec::new();
    for msg in &app.messages {
        let lines = message_to_lines(msg, theme);
        all_lines.extend(lines);
    }

    let total_lines = all_lines.len();
    let max_scroll = total_lines.saturating_sub(inner_height);
    let scroll = app.scroll_offset.min(max_scroll);

    let text = Text::from(all_lines);

    let block = Block::default()
        .borders(Borders::ALL)
        .border_type(BorderType::Rounded)
        .border_style(Style::default().fg(theme.border))
        .style(Style::default().bg(theme.bg));

    let paragraph = Paragraph::new(text)
        .scroll((scroll as u16, 0))
        .block(block)
        .style(Style::default().bg(theme.bg));

    frame.render_widget(paragraph, area);

    if total_lines > inner_height {
        let scrollbar_x = area.right().saturating_sub(2);
        let scrollbar_y = area.y + 1;
        let track_height = area.height.saturating_sub(2) as usize;
        if track_height < 3 { return; }

        let thumb_pos = if max_scroll == 0 {
            0
        } else {
            let pct = scroll as f64 / max_scroll as f64;
            let t = (pct * (track_height.saturating_sub(1) as f64)) as usize;
            t.min(track_height.saturating_sub(1))
        };

        let mut scroll_chars = vec!['░'; track_height];
        let thumb_start = thumb_pos.saturating_sub(1);
        let thumb_end = thumb_pos.saturating_add(1).min(track_height.saturating_sub(1));
        for i in thumb_start..=thumb_end {
            scroll_chars[i] = if i == thumb_pos { '█' } else { '▓' };
        }
        if scroll == 0 {
            scroll_chars[0] = '▄';
        }
        if scroll >= max_scroll {
            scroll_chars[track_height - 1] = '▀';
        }
        let _scroll_text: String = scroll_chars.iter().collect();
        for i in 0..track_height {
            let char_area = Rect::new(scrollbar_x, scrollbar_y + i as u16, 1, 1);
            let style = if scroll_chars[i] == '█' {
                Style::default().fg(theme.accent).bg(theme.bg)
            } else {
                Style::default().fg(theme.dim).bg(theme.bg)
            };
            let c = Paragraph::new(Line::from(Span::styled(
                scroll_chars[i].to_string(),
                style,
            )));
            frame.render_widget(c, char_area);
        }
    }
}

fn message_to_lines<'a>(msg: &'a crate::app::Message, theme: &'a Theme) -> Vec<Line<'a>> {
    let text = &msg.text;
    let msg_type = msg.msg_type;
    let raw_lines: Vec<&str> = text.lines().collect();
    if raw_lines.is_empty() {
        return Vec::new();
    }

    let mut result = Vec::new();
    for (i, line) in raw_lines.iter().enumerate() {
        let (prefix, p_style, t_style) = match msg_type {
            MessageType::User => {
                let p = if i == 0 { " ▸ " } else { "    " };
                (p, Style::default().fg(theme.accent).add_modifier(Modifier::BOLD), Style::default().fg(theme.primary))
            }
            MessageType::ShellMax => {
                let p = if i == 0 { " ◆ " } else { "    " };
                (p, Style::default().fg(theme.accent), Style::default().fg(theme.primary))
            }
            MessageType::Output => {
                let p = if i == 0 { "   " } else { "   " };
                (p, Style::default().fg(theme.dim), Style::default().fg(theme.dim))
            }
            MessageType::System => {
                let p = if i == 0 { " ℹ " } else { "    " };
                (p, Style::default().fg(theme.dim), Style::default().fg(theme.dim))
            }
            MessageType::Error => {
                let p = if i == 0 { " ✖ " } else { "    " };
                (p, Style::default().fg(theme.error).add_modifier(Modifier::BOLD), Style::default().fg(theme.error))
            }
        };

        result.push(Line::from(vec![
            Span::styled(prefix, p_style),
            Span::styled(line.to_string(), t_style),
        ]));
    }
    result
}

fn render_input(frame: &mut Frame, area: Rect, app: &App, theme: &Theme) {
    let prompt = Span::styled(
        " ▸ You > ",
        Style::default().fg(theme.accent).add_modifier(Modifier::BOLD),
    );

    let input_style = Style::default().fg(theme.primary);

    let cursor_style = Style::default()
        .fg(theme.bg)
        .bg(theme.primary);
    let cursor_char = if app.input.len() > app.cursor_pos {
        let c = app.input.chars().nth(app.cursor_pos).unwrap_or(' ');
        Span::styled(c.to_string(), cursor_style)
    } else {
        Span::styled(" ", cursor_style)
    };

    let after_cursor = if app.input.len() > app.cursor_pos {
        Span::styled(
            app.input[app.cursor_pos..].to_string(),
            input_style,
        )
    } else {
        Span::raw("")
    };

    let left_text: String = app.input.chars().take(app.cursor_pos).collect();
    let left_span = Span::styled(left_text, input_style);

    let line = Line::from(vec![prompt, left_span, cursor_char, after_cursor]);

    let block = Block::default()
        .borders(Borders::ALL)
        .border_type(BorderType::Rounded)
        .border_style(Style::default().fg(theme.border))
        .style(Style::default().bg(theme.bg));

    let paragraph = Paragraph::new(line).block(block);
    frame.render_widget(paragraph, area);
}

fn render_status_bar(frame: &mut Frame, area: Rect, app: &App, theme: &Theme) {
    let left = "/help  /st  /exit  PgUp/PgDn:scroll  Ctrl+↑/↓:line";
    let right = format!(
        " msgs:{} | theme:{} ",
        app.messages.len(),
        theme.name
    );

    let padding = (area.width as usize).saturating_sub(
        left.len() + right.len() + 2,
    );
    let padding_str = " ".repeat(padding);

    let line = Line::from(vec![
        Span::styled(" ", Style::default().fg(theme.dim)),
        Span::styled(left, Style::default().fg(theme.dim)),
        Span::styled(&padding_str, Style::default().fg(theme.bg)),
        Span::styled(&right, Style::default().fg(theme.dim)),
        Span::styled(" ", Style::default().fg(theme.dim)),
    ]);

    let block = Block::default()
        .style(Style::default().bg(theme.surface))
        .borders(Borders::TOP)
        .border_type(BorderType::Plain)
        .border_style(Style::default().fg(theme.border));

    let paragraph = Paragraph::new(line).block(block);
    frame.render_widget(paragraph, area);
}

fn render_settings(frame: &mut Frame, area: Rect, app: &App, theme: &Theme) {
    let popup_width = area.width.min(50);
    let popup_height = 12;
    let popup_x = (area.width.saturating_sub(popup_width)) / 2;
    let popup_y = (area.height.saturating_sub(popup_height)) / 2;

    let popup_area = Rect::new(popup_x, popup_y, popup_width, popup_height);

    frame.render_widget(Clear, popup_area);

    let options = [
        format!(" {}  Change Name    [current: {}]", if app.settings_selection == 0 { "▶" } else { " " }, app.config.name),
        format!(" {}  Next Theme     [current: {}]", if app.settings_selection == 1 { "▶" } else { " " }, theme.name),
        format!(" {}  Previous Theme", if app.settings_selection == 2 { "▶" } else { " " }),
        format!(" {}  Back", if app.settings_selection == 3 { "▶" } else { " " }),
    ];

    let items: Vec<ListItem> = options
        .iter()
        .enumerate()
        .map(|(i, opt)| {
            let is_selected = i == app.settings_selection;
            let style = if is_selected {
                Style::default()
                    .fg(theme.bg)
                    .bg(theme.accent)
                    .add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(theme.primary)
            };
            ListItem::new(opt.as_str()).style(style)
        })
        .collect();

    let list = List::new(items).block(
        Block::default()
            .title(" Settings ")
            .title_style(Style::default().fg(theme.accent).add_modifier(Modifier::BOLD))
            .borders(Borders::ALL)
            .border_type(BorderType::Rounded)
            .border_style(Style::default().fg(theme.border))
            .style(Style::default().bg(theme.surface)),
    );

    frame.render_widget(list, popup_area);
}

fn render_name_edit(frame: &mut Frame, area: Rect, app: &App, theme: &Theme) {
    let popup_width = area.width.min(50);
    let popup_height = 5;
    let popup_x = (area.width.saturating_sub(popup_width)) / 2;
    let popup_y = (area.height.saturating_sub(popup_height)) / 2;

    let popup_area = Rect::new(popup_x, popup_y, popup_width, popup_height);

    frame.render_widget(Clear, popup_area);

    let prompt = format!(
        " Enter new name: {}{}",
        app.name_edit_buf,
        if Local::now().timestamp_millis() % 1000 < 500 { "█" } else { " " }
    );

    let text = Paragraph::new(prompt)
        .style(Style::default().fg(theme.primary))
        .block(
            Block::default()
                .title(" Change Name ")
                .title_style(Style::default().fg(theme.accent).add_modifier(Modifier::BOLD))
                .borders(Borders::ALL)
                .border_type(BorderType::Rounded)
                .border_style(Style::default().fg(theme.border))
                .style(Style::default().bg(theme.surface)),
        );

    frame.render_widget(text, popup_area);
}
