use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};

use tauri::Manager;

#[derive(Default)]
pub struct AppState {
    pub close_to_tray: AtomicBool,
    pub frontend_ready: AtomicBool,
    pub settings_lock: Mutex<()>,
}

pub fn should_show_on_ready<I, S>(args: I, close_to_tray: bool) -> bool
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    !(close_to_tray && args.into_iter().any(|arg| arg.as_ref() == "--minimized"))
}

#[tauri::command]
pub fn greet(name: &str) -> app_core::Greeting {
    app_core::greet(name)
}

#[tauri::command]
pub fn read_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    key: String,
) -> Result<Option<serde_json::Value>, String> {
    let _guard = state
        .settings_lock
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    crate::settings::read(&path.join("settings.json"), &key).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn write_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    key: String,
    value: serde_json::Value,
    reset: bool,
) -> Result<(), String> {
    let _guard = state
        .settings_lock
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    crate::settings::write(&path.join("settings.json"), key, value, reset)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_close_to_tray(state: tauri::State<'_, AppState>, enabled: bool) {
    state.close_to_tray.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
pub fn set_tray_locale(app: tauri::AppHandle, locale: String) -> Result<(), String> {
    #[cfg(desktop)]
    {
        crate::tray::set_locale(&app, &locale).map_err(|error| error.to_string())
    }
    #[cfg(mobile)]
    {
        let _ = (app, locale);
        Ok(())
    }
}

#[tauri::command]
pub fn frontend_ready(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Main window is unavailable")?;
    let first_ready = !state.frontend_ready.swap(true, Ordering::Relaxed);
    if !first_ready
        || should_show_on_ready(
            std::env::args(),
            state.close_to_tray.load(Ordering::Relaxed),
        )
    {
        window.show().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg(desktop)]
pub fn updater_configured(config: Option<&serde_json::Value>) -> bool {
    config
        .and_then(|config| {
            serde_json::from_value::<tauri_plugin_updater::Config>(config.clone()).ok()
        })
        .is_some_and(|config| !config.pubkey.trim().is_empty() && !config.endpoints.is_empty())
}

#[tauri::command]
pub fn get_update_configured(app: tauri::AppHandle) -> bool {
    #[cfg(desktop)]
    {
        updater_configured(app.config().plugins.0.get("updater"))
    }
    #[cfg(mobile)]
    {
        let _ = app;
        false
    }
}

#[cfg(all(test, desktop))]
mod tests {
    use super::{should_show_on_ready, updater_configured};
    use serde_json::json;

    #[test]
    fn updater_requires_public_key_and_endpoints() {
        assert!(!updater_configured(None));
        for config in [
            json!({}),
            json!({ "pubkey": "", "endpoints": ["https://example.com/latest.json"] }),
            json!({ "pubkey": "key", "endpoints": [] }),
            json!({ "pubkey": "key", "endpoints": ["not a URL"] }),
        ] {
            assert!(!updater_configured(Some(&config)));
        }
        assert!(updater_configured(Some(&json!({
            "pubkey": "public-key-content",
            "endpoints": ["https://example.com/latest.json"]
        }))));
    }

    #[test]
    fn minimized_autostart_stays_hidden_only_when_close_to_tray_is_enabled() {
        assert!(should_show_on_ready(["app"], true));
        assert!(should_show_on_ready(["app", "--minimized"], false));
        assert!(!should_show_on_ready(["app", "--minimized"], true));
    }
}
