import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webPlatform } from "./platform";

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllEnvs());

describe("web platform", () => {
  it("isolates applications on the same origin and preserves legacy settings", async () => {
    localStorage.setItem("app:settings", JSON.stringify({ theme: "light" }));
    vi.stubEnv("VITE_APP_IDENTIFIER", "com.team.first");
    vi.resetModules();
    const first = (await import("./platform")).webPlatform;
    expect(await first.store.get("settings")).toBeUndefined();
    await first.store.set("settings", { theme: "dark" });
    vi.stubEnv("VITE_APP_IDENTIFIER", "com.team.second");
    vi.resetModules();
    const second = (await import("./platform")).webPlatform;
    expect(await second.store.get("settings")).toBeUndefined();
    await second.store.set("settings", { theme: "system" });
    expect(await first.store.get("settings")).toEqual({ theme: "dark" });
    expect(await second.store.get("settings")).toEqual({ theme: "system" });
    expect(localStorage.getItem("app:settings")).toBe('{"theme":"light"}');
  });

  it("trims names and handles blank names", async () => {
    expect((await webPlatform.greet(" Ada ")).message).toBe("Hello, Ada! (from web)");
    expect((await webPlatform.greet("  ")).message).toBe("Hello, World! (from web)");
  });

  it("persists settings and reports malformed storage without overwriting it", async () => {
    expect(await webPlatform.store.get("settings")).toBeUndefined();
    await webPlatform.store.set("settings", { theme: "dark" });
    expect(await webPlatform.store.get("settings")).toEqual({ theme: "dark" });
    const key = `app:${import.meta.env.VITE_APP_IDENTIFIER}:settings`;
    localStorage.setItem(key, "broken");
    await expect(webPlatform.store.get("settings")).rejects.toThrow();
    expect(localStorage.getItem(key)).toBe("broken");
  });

  it("does not expose desktop capabilities", () => {
    expect(webPlatform.setAutostart).toBeUndefined();
    expect(webPlatform.setCloseToTray).toBeUndefined();
    expect(webPlatform.checkUpdate).toBeUndefined();
  });
});
