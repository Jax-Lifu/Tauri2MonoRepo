use std::sync::atomic::Ordering;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime, Window, WindowEvent,
};

use crate::commands::AppState;

pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        for result in [window.unminimize(), window.show(), window.set_focus()] {
            if let Err(error) = result {
                log::warn!("Could not restore main window: {error}");
            }
        }
    }
}

pub fn init<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "显示主窗口 / Show", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "退出 / Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &separator, &quit])?;

    let mut tray = TrayIconBuilder::with_id("main-tray")
        .tooltip(app.package_info().name.clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

pub fn on_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        if window.label() == "main"
            && window
                .state::<AppState>()
                .close_to_tray
                .load(Ordering::Relaxed)
        {
            api.prevent_close();
            if let Err(error) = window.hide() {
                log::error!("Could not hide main window: {error}");
            }
        }
    }
}
