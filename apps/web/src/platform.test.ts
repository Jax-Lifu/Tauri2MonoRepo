import { beforeEach, describe, expect, it } from "vitest";
import { webPlatform } from "./platform";

beforeEach(() => localStorage.clear());

describe("web platform", () => {
  it("trims names and handles blank names", async () => {
    expect((await webPlatform.greet(" Ada ")).message).toBe("Hello, Ada! (from web)");
    expect((await webPlatform.greet("  ")).message).toBe("Hello, World! (from web)");
  });

  it("persists settings and reports malformed storage without overwriting it", async () => {
    expect(await webPlatform.store.get("settings")).toBeUndefined();
    await webPlatform.store.set("settings", { theme: "dark" });
    expect(await webPlatform.store.get("settings")).toEqual({ theme: "dark" });
    localStorage.setItem("app:settings", "broken");
    await expect(webPlatform.store.get("settings")).rejects.toThrow();
    expect(localStorage.getItem("app:settings")).toBe("broken");
  });

  it("does not expose desktop capabilities", () => {
    expect(webPlatform.setAutostart).toBeUndefined();
    expect(webPlatform.setCloseToTray).toBeUndefined();
    expect(webPlatform.checkUpdate).toBeUndefined();
  });
});
