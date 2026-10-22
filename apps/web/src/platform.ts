import type { Platform } from "@app/shared";

export const webPlatform: Platform = {
  name: "web",
  greet: async (name) => ({ message: `Hello, ${name.trim() || "World"}! (from web)` }),
  store: {
    get: async <T>(key: string) => {
      const raw = localStorage.getItem(`app:${key}`);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    },
    set: async <T>(key: string, value: T) => {
      localStorage.setItem(`app:${key}`, JSON.stringify(value));
    },
  },
  getAppVersion: async () => import.meta.env.VITE_APP_VERSION,
};
