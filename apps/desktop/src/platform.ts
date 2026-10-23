import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import type { Greeting, Platform } from "@app/shared";

export async function createDesktopPlatform(): Promise<Platform> {
  const updatesConfigured = await invoke<boolean>("get_update_configured");
  let installation: Promise<void> | undefined;
  return {
    name: "desktop",
    greet: (name) => invoke<Greeting>("greet", { name }),
    store: {
      get: async <T>(key: string) => (await invoke<T | null>("read_settings", { key })) ?? undefined,
      set: <T>(key: string, value: T) => invoke("write_settings", { key, value, reset: false }),
      reset: <T>(key: string, value: T) => invoke("write_settings", { key, value, reset: true }),
    },
    getAppVersion: getVersion,
    setNativeTheme: (theme) => getCurrentWindow().setTheme(theme === "system" ? null : theme),
    getAutostart: isEnabled,
    setAutostart: async (enabled) => {
      if (enabled !== (await isEnabled())) await (enabled ? enable() : disable());
    },
    setCloseToTray: (enabled) => invoke("set_close_to_tray", { enabled }),
    checkUpdate: updatesConfigured
      ? async () => {
          const update = await check();
          if (!update) return null;
          return {
            version: update.version,
            notes: update.body,
            dispose: () => update.close(),
            install: () => installation ??= (async () => {
              await update.downloadAndInstall();
              await relaunch();
            })().finally(() => { installation = undefined; }),
          };
        }
      : undefined,
  };
}
