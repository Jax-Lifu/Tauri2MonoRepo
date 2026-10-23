import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  delete document.documentElement.dataset.storagePrefix;
  localStorage.clear();
});

it("writes each Web application's theme cache separately and keeps the desktop key", async () => {
  document.documentElement.dataset.storagePrefix = "app:com.team.first";
  vi.resetModules();
  const first = await import("./theme");
  first.applyAppearance({ theme: "dark", accent: "rose", fontSize: "lg", reduceMotion: true });
  document.documentElement.dataset.storagePrefix = "app:com.team.second";
  vi.resetModules();
  const second = await import("./theme");
  second.applyAppearance({ theme: "light", accent: "blue", fontSize: "md", reduceMotion: false });
  expect(JSON.parse(localStorage.getItem("app:com.team.first:theme-cache")!)).toMatchObject({ theme: "dark" });
  expect(JSON.parse(localStorage.getItem("app:com.team.second:theme-cache")!)).toMatchObject({ theme: "light" });
  delete document.documentElement.dataset.storagePrefix;
  vi.resetModules();
  expect((await import("./theme")).THEME_CACHE_KEY).toBe("app:theme-cache");
});
