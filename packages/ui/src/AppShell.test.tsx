import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defaultSettings, type Platform } from "@app/shared";
import { initI18n } from "@app/i18n";
import { AppShell } from "./AppShell";
import { useSettings } from "./store/settings";

function createPlatform(): Platform {
  const platform: Platform = {
    name: "web",
    greet: vi.fn(async (name) => ({ message: `Hello, ${name}!` })),
    getAppVersion: async () => "0.1.0",
    store: { get: async <T,>() => ({ locale: "en-US" }) as T, set: vi.fn(async () => {}) },
  };
  vi.spyOn(platform.store, "get");
  return platform;
}

beforeEach(async () => {
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  useSettings.setState({ settings: { ...defaultSettings }, ready: false, saving: false, readFailed: false, error: null, platform: null });
  await initI18n("en-US");
});

afterEach(cleanup);

describe("shared application flow", () => {
  it("restores the hash route and follows browser history", async () => {
    window.history.replaceState(null, "", "/#/settings");
    const platform = createPlatform();
    const first = render(<AppShell platform={platform} />);
    await screen.findByLabelText("Theme");
    first.unmount();
    render(<AppShell platform={platform} />);
    await screen.findByLabelText("Theme");
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    await screen.findByLabelText("Your name");
    expect(window.location.hash).toBe("#/");
    window.history.back();
    await screen.findByLabelText("Theme");
    window.history.forward();
    await screen.findByLabelText("Your name");
    fireEvent.keyDown(window, { key: ",", ctrlKey: true });
    await screen.findByLabelText("Theme");
    expect(window.location.hash).toBe("#/settings");
  });

  it("initializes once in StrictMode, greets, and opens settings with a shortcut", async () => {
    const platform = createPlatform();
    const onReady = vi.fn();
    render(<StrictMode><AppShell platform={platform} onReady={onReady} /></StrictMode>);
    await screen.findByLabelText("Your name");
    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(platform.store.get).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Tauri" } });
    fireEvent.click(screen.getByRole("button", { name: "Greet" }));
    expect(await screen.findByText("Hello, Tauri!")).toBeTruthy();
    fireEvent.keyDown(window, { key: ",", ctrlKey: true });
    expect(await screen.findByLabelText("Theme")).toBeTruthy();
    expect(screen.queryByLabelText("Launch at login")).toBeNull();
    expect(screen.queryByRole("button", { name: "Check for updates" })).toBeNull();
  });

  it("persists appearance and language from accessible settings controls", async () => {
    const platform = createPlatform();
    render(<AppShell platform={platform} />);
    await screen.findByLabelText("Your name");
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    fireEvent.change(screen.getByLabelText("Theme"), { target: { value: "dark" } });
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    fireEvent.click(screen.getByRole("button", { name: "Rose" }));
    await waitFor(() => expect(document.documentElement.dataset.accent).toBe("rose"));
    fireEvent.change(screen.getByLabelText("Font size"), { target: { value: "lg" } });
    await waitFor(() => expect(document.documentElement.dataset.fontSize).toBe("lg"));
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "zh-CN" } });
    await screen.findByRole("heading", { name: "设置" });
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(platform.store.set).toHaveBeenLastCalledWith("settings", expect.objectContaining({ theme: "dark", accent: "rose", fontSize: "lg", locale: "zh-CN" }));
  });

  it("toggles and persists a switch using Space and Enter", async () => {
    const user = userEvent.setup();
    const platform = createPlatform();
    render(<AppShell platform={platform} />);
    await screen.findByLabelText("Your name");
    await user.click(screen.getByRole("button", { name: "Open settings" }));
    const motion = screen.getByRole("switch", { name: "Reduce motion" });
    motion.focus();
    await user.keyboard("[Space]");
    await waitFor(() => expect(document.documentElement.dataset.reduceMotion).toBe("true"));
    expect(motion.getAttribute("aria-checked")).toBe("true");
    await waitFor(() => expect((motion as HTMLButtonElement).disabled).toBe(false));
    await user.keyboard("[Enter]");
    await waitFor(() => expect(document.documentElement.dataset.reduceMotion).toBe("false"));
    expect(motion.getAttribute("aria-checked")).toBe("false");
    expect(platform.store.set).toHaveBeenLastCalledWith("settings", expect.objectContaining({ reduceMotion: false }));
  });

  it("keeps preferences on dialog cancellation and resets only after confirmation", async () => {
    const user = userEvent.setup();
    const platform = createPlatform();
    const saved = { ...defaultSettings, locale: "en-US", theme: "dark", accent: "rose", fontSize: "lg", reduceMotion: true };
    vi.mocked(platform.store.get).mockResolvedValue(saved);
    platform.store.reset = vi.fn(async () => {});
    render(<AppShell platform={platform} />);
    await screen.findByLabelText("Your name");
    await user.click(screen.getByRole("button", { name: "Open settings" }));
    const trigger = screen.getByRole("button", { name: "Reset to defaults" });
    await user.click(trigger);
    let dialog = await screen.findByRole("alertdialog", { name: "Reset to defaults" });
    expect(within(dialog).getByText("Reset all settings? This will replace your saved preferences.")).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancel" }));
    await user.keyboard("[Escape]");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
    await user.click(trigger);
    dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(platform.store.reset).not.toHaveBeenCalled();
    expect(platform.store.set).not.toHaveBeenCalled();
    expect(useSettings.getState().settings).toEqual(saved);
    await user.click(trigger);
    dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Reset to defaults" }));
    await waitFor(() => expect(platform.store.reset).toHaveBeenCalledWith("settings", defaultSettings));
    expect(useSettings.getState().settings).toEqual(defaultSettings);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.accent).toBe(defaultSettings.accent);
    expect(document.documentElement.dataset.fontSize).toBe(defaultSettings.fontSize);
    expect(document.documentElement.dataset.reduceMotion).toBe("false");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("shows startup failures and still calls the window-ready callback", async () => {
    const platform = createPlatform();
    vi.mocked(platform.store.get).mockRejectedValue(new Error("Corrupt JSON"));
    const onReady = vi.fn();
    render(<StrictMode><AppShell platform={platform} onReady={onReady} /></StrictMode>);
    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Corrupt JSON")).toBeTruthy();
    expect(platform.store.set).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Retry loading settings" })).toBeTruthy();
  });

  it("makes callback and greeting rejections visible", async () => {
    const platform = createPlatform();
    vi.mocked(platform.greet).mockRejectedValue(new Error("Native command failed"));
    const report = vi.fn();
    render(<AppShell platform={platform} onReady={async () => { throw new Error("Update check failed"); }} onError={report} />);
    await screen.findByText("Update check failed");
    fireEvent.click(screen.getByRole("button", { name: "Greet" }));
    expect(await screen.findByText(/Native command failed/)).toBeTruthy();
    expect(report).toHaveBeenCalledTimes(2);
  });

  it("keeps failed update checks actionable and shows native settings only when available", async () => {
    const platform: Platform = { ...createPlatform(), name: "desktop", setAutostart: async () => {}, checkUpdate: vi.fn(async () => { throw new Error("Offline"); }) };
    render(<AppShell platform={platform} />);
    await screen.findByLabelText("Your name");
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    expect(screen.getByRole("switch", { name: "Launch at login" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Check for updates" }));
    expect(await screen.findByText(/Offline/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Check for updates" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
