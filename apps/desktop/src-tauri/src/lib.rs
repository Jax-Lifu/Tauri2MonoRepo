mod commands;
mod settings;
#[cfg(desktop)]
mod tray;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            tray::show_main_window(app);
        }));
    }

    builder = builder
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: None,
                    }),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                ])
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init());

    #[cfg(desktop)]
    {
        use tauri_plugin_window_state::StateFlags;
        builder = builder
            .plugin(
                tauri_plugin_window_state::Builder::default()
                    // Visibility belongs to frontend_ready, not the last window state.
                    .with_state_flags(
                        StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED,
                    )
                    .build(),
            )
            .plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                Some(vec!["--minimized"]),
            ))
            .on_window_event(tray::on_window_event);
    }

    builder
        .manage(commands::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::read_settings,
            commands::write_settings,
            commands::set_close_to_tray,
            commands::set_tray_locale,
            commands::frontend_ready,
            commands::get_update_configured
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                tray::init(app.handle())?;
                if commands::get_update_configured(app.handle().clone()) {
                    app.handle()
                        .plugin(tauri_plugin_updater::Builder::new().build())?;
                }
                let handle = app.handle().clone();
                // A broken frontend must not leave the application permanently hidden.
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(8));
                    if !handle
                        .state::<commands::AppState>()
                        .frontend_ready
                        .load(std::sync::atomic::Ordering::Relaxed)
                    {
                        log::warn!("Frontend readiness timed out; showing main window");
                        tray::show_main_window(&handle);
                    }
                });
            }
            log::info!("App started, version {}", app.package_info().version);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen {
                has_visible_windows: false,
                ..
            } = _event
            {
                tray::show_main_window(_app);
            }
        });
}
