import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  setTheme: vi.fn(),
  isEnabled: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  check: vi.fn(),
  relaunch: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: async () => "0.1.0" }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ setTheme: mocks.setTheme }) }));
vi.mock("@tauri-apps/plugin-autostart", () => ({ isEnabled: mocks.isEnabled, enable: mocks.enable, disable: mocks.disable }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: mocks.check }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: mocks.relaunch }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.invoke.mockResolvedValue(false);
});

describe("desktop platform", () => {
  it("only exposes updates when configured and forwards business commands", async () => {
    const { createDesktopPlatform } = await import("./platform");
    const platform = await createDesktopPlatform();
    expect(platform.checkUpdate).toBeUndefined();
    await platform.greet("Ada");
    expect(mocks.invoke).toHaveBeenCalledWith("greet", { name: "Ada" });
    await platform.setCloseToTray?.(true);
    expect(mocks.invoke).toHaveBeenCalledWith("set_close_to_tray", { enabled: true });
  });

  it("waits for durable saving and propagates disk errors", async () => {
    const { createDesktopPlatform } = await import("./platform");
    const platform = await createDesktopPlatform();
    mocks.invoke.mockRejectedValueOnce(new Error("disk full"));
    await expect(platform.store.set("settings", { theme: "dark" })).rejects.toThrow("disk full");
    expect(mocks.invoke).toHaveBeenCalledWith("write_settings", { key: "settings", value: { theme: "dark" }, reset: false });
    await platform.store.reset?.("settings", { theme: "system" });
    expect(mocks.invoke).toHaveBeenCalledWith("write_settings", { key: "settings", value: { theme: "system" }, reset: true });
  });

  it("does not change autostart when the native state already matches", async () => {
    const { createDesktopPlatform } = await import("./platform");
    const platform = await createDesktopPlatform();
    mocks.isEnabled.mockResolvedValue(true);
    await platform.setAutostart?.(true);
    expect(mocks.enable).not.toHaveBeenCalled();
    await platform.setAutostart?.(false);
    expect(mocks.disable).toHaveBeenCalledOnce();
    await platform.setNativeTheme?.("system");
    expect(mocks.setTheme).toHaveBeenCalledWith(null);
  });

  it("does not restart if downloading or verifying an update fails", async () => {
    const { createDesktopPlatform } = await import("./platform");
    mocks.invoke.mockResolvedValue(true);
    const close = vi.fn();
    mocks.check.mockResolvedValue({ version: "0.2.0", downloadAndInstall: vi.fn().mockRejectedValue(new Error("signature invalid")), close });
    const platform = await createDesktopPlatform();
    const update = await platform.checkUpdate?.();
    await expect(update!.install()).rejects.toThrow("signature invalid");
    expect(mocks.relaunch).not.toHaveBeenCalled();
    await update?.dispose?.();
    expect(close).toHaveBeenCalledOnce();
  });
});
