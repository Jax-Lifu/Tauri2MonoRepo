use std::sync::atomic::Ordering;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime, Window, WindowEvent,
};

use crate::commands::AppState;

pub struct TrayMenu<R: Runtime> {
    show: MenuItem<R>,
    quit: MenuItem<R>,
}

pub fn resolve_tooltip(product_name: Option<&str>, package_name: &str) -> String {
    product_name
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .unwrap_or(package_name)
        .to_owned()
}

pub fn tray_labels(locale: &str) -> (&'static str, &'static str) {
    if locale.to_ascii_lowercase().starts_with("zh") {
        ("显示主窗口", "退出")
    } else {
        ("Show Window", "Quit")
    }
}

pub fn set_locale<R: Runtime>(app: &AppHandle<R>, locale: &str) -> tauri::Result<()> {
    if let Some(menu) = app.try_state::<TrayMenu<R>>() {
        let (show, quit) = tray_labels(locale);
        menu.show.set_text(show)?;
        menu.quit.set_text(quit)?;
    }
    Ok(())
}

pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(state) = app.try_state::<AppState>() {
        state.frontend_ready.store(true, Ordering::Relaxed);
    }
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
    app.manage(TrayMenu {
        show: show.clone(),
        quit: quit.clone(),
    });

    let tooltip = resolve_tooltip(
        app.config().product_name.as_deref(),
        &app.package_info().name,
    );
    let mut tray = TrayIconBuilder::with_id("main-tray")
        .tooltip(tooltip)
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

#[cfg(test)]
mod tests {
    use super::{resolve_tooltip, tray_labels};

    #[test]
    fn tooltip_prefers_product_name_and_falls_back_to_package_name() {
        assert_eq!(
            resolve_tooltip(Some("My Custom App"), "desktop"),
            "My Custom App"
        );
        assert_eq!(resolve_tooltip(Some("  "), "desktop"), "desktop");
        assert_eq!(resolve_tooltip(None, "desktop"), "desktop");
    }

    #[test]
    fn tray_labels_match_locale() {
        assert_eq!(tray_labels("zh-CN"), ("显示主窗口", "退出"));
        assert_eq!(tray_labels("en-US"), ("Show Window", "Quit"));
    }
}
