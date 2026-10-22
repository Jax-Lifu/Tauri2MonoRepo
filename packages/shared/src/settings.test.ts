import { describe, expect, it } from "vitest";
import { defaultSettings, migrateSettings, resolveLocale } from "./settings";

describe("settings migration", () => {
  it("adds new defaults while preserving older preferences", () => {
    expect(migrateSettings({ theme: "dark", locale: "zh-CN" })).toEqual({ ...defaultSettings, theme: "dark", locale: "zh-CN" });
    expect(migrateSettings(undefined)).toEqual(defaultSettings);
  });

  it.each([
    null, [], "settings", { version: "1" }, { version: 2 }, { theme: "purple" },
    { launchAtLogin: "false" }, { fontSize: "huge" }, { locale: "fr-FR" }, { reduceMotion: 1 },
  ])("rejects invalid or future settings without treating them as new data: %j", (raw) => {
    expect(() => migrateSettings(raw)).toThrow();
  });

  it("drops obsolete keys and never mutates its source", () => {
    const previous = { version: 0, theme: "dark", obsolete: "value" };
    const next = migrateSettings(previous);
    expect(next).not.toHaveProperty("obsolete");
    expect(next.version).toBe(1);
    expect(previous.version).toBe(0);
  });
});

describe("locale resolution", () => {
  it("follows Chinese system locales and falls back to English", () => {
    expect(resolveLocale("system", "zh-TW")).toBe("zh-CN");
    expect(resolveLocale("system", "de-DE")).toBe("en-US");
    expect(resolveLocale("en-US", "zh-CN")).toBe("en-US");
  });
});
