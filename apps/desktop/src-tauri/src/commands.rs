use std::sync::atomic::{AtomicBool, Ordering};

use tauri::Manager;

#[derive(Default)]
pub struct AppState {
    pub close_to_tray: AtomicBool,
    pub frontend_ready: AtomicBool,
}

#[tauri::command]
pub fn greet(name: &str) -> app_core::Greeting {
    app_core::greet(name)
}

#[tauri::command]
pub fn read_settings(
    app: tauri::AppHandle,
    key: String,
) -> Result<Option<serde_json::Value>, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    crate::settings::read(&path.join("settings.json"), &key).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn write_settings(
    app: tauri::AppHandle,
    key: String,
    value: serde_json::Value,
    reset: bool,
) -> Result<(), String> {
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
pub fn frontend_ready(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Main window is unavailable")?;
    window.show().map_err(|error| error.to_string())?;
    state.frontend_ready.store(true, Ordering::Relaxed);
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
    use super::updater_configured;
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
}
