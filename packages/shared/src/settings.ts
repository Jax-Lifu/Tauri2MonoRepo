export type ThemeMode = "light" | "dark" | "system";
export type Accent = "blue" | "green" | "violet" | "orange" | "rose";
export type Locale = "zh-CN" | "en-US";
export type FontSize = "sm" | "md" | "lg";

export const SUPPORTED_LOCALES: readonly Locale[] = ["zh-CN", "en-US"];
export const SETTINGS_VERSION = 1;

export interface AppSettings {
  version: number;
  locale: Locale | "system";
  launchAtLogin: boolean;
  closeToTray: boolean;
  theme: ThemeMode;
  accent: Accent;
  fontSize: FontSize;
  reduceMotion: boolean;
  autoCheckUpdate: boolean;
}

export const defaultSettings: Readonly<AppSettings> = Object.freeze({
  version: SETTINGS_VERSION,
  locale: "system",
  launchAtLogin: false,
  closeToTray: true,
  theme: "system",
  accent: "blue",
  fontSize: "md",
  reduceMotion: false,
  autoCheckUpdate: true,
});

export function resolveLocale(
  preference: AppSettings["locale"],
  systemLanguage = typeof navigator === "undefined" ? "en-US" : navigator.language,
): Locale {
  return preference === "system"
    ? systemLanguage.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US"
    : preference;
}

/** Missing fields in older settings inherit defaults; invalid data stays on disk for recovery. */
export function migrateSettings(raw: unknown): AppSettings {
  if (raw === undefined) return { ...defaultSettings };
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid settings data");
  }
  const data = raw as Record<string, unknown>;
  if (data.version !== undefined && (!Number.isInteger(data.version) || Number(data.version) < 0 || Number(data.version) > SETTINGS_VERSION)) {
    throw new Error("Unsupported settings version");
  }
  const next: AppSettings = { ...defaultSettings };
  const enums = {
    locale: ["system", "zh-CN", "en-US"],
    theme: ["system", "light", "dark"],
    accent: ["blue", "green", "violet", "orange", "rose"],
    fontSize: ["sm", "md", "lg"],
  } as const;
  for (const key of Object.keys(enums) as (keyof typeof enums)[]) {
    if (data[key] === undefined) continue;
    if (typeof data[key] !== "string" || !(enums[key] as readonly string[]).includes(data[key])) {
      throw new Error(`Invalid setting: ${key}`);
    }
    Object.assign(next, { [key]: data[key] });
  }
  for (const key of ["launchAtLogin", "closeToTray", "reduceMotion", "autoCheckUpdate"] as const) {
    if (data[key] === undefined) continue;
    if (typeof data[key] !== "boolean") throw new Error(`Invalid setting: ${key}`);
    next[key] = data[key];
  }
  return next;
}
