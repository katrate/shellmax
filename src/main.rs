mod app;
mod ui;
mod config;
mod commands;
mod executor;
mod themes;
mod apps;
mod messaging;

use anyhow::Result;

fn main() -> Result<()> {
    let mut app = app::App::new()?;
    app.run()?;
    Ok(())
}
