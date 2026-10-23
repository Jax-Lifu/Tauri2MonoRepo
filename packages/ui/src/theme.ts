import type { AppSettings, ThemeMode } from "@app/shared";

export const THEME_CACHE_KEY = `${document.documentElement.dataset.storagePrefix ?? "app"}:theme-cache`;

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  return mode === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    : mode;
}

export function applyAppearance(settings: Pick<AppSettings, "theme" | "accent" | "fontSize" | "reduceMotion">) {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(settings.theme);
  root.dataset.accent = settings.accent;
  root.dataset.fontSize = settings.fontSize;
  root.dataset.reduceMotion = String(settings.reduceMotion);
  try {
    // Cache the preference, so "system" still follows the OS on the next launch.
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(settings));
  } catch {
    // A blocked optional cache must not prevent application startup.
  }
}

export function watchSystemTheme(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
