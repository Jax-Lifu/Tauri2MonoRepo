import type { Platform } from "@app/shared";

const storagePrefix = `app:${import.meta.env.VITE_APP_IDENTIFIER}`;

export const webPlatform: Platform = {
  name: "web",
  greet: async (name) => ({ message: `Hello, ${name.trim() || "World"}! (from web)` }),
  store: {
    get: async <T>(key: string) => {
      const raw = localStorage.getItem(`${storagePrefix}:${key}`);
      if (raw === null) return undefined;
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null) throw new Error("Stored settings value must not be null");
      return parsed as T;
    },
    set: async <T>(key: string, value: T) => {
      localStorage.setItem(`${storagePrefix}:${key}`, JSON.stringify(value));
    },
    reset: async <T>(key: string, value: T) => {
      const fullKey = `${storagePrefix}:${key}`;
      const previous = localStorage.getItem(fullKey);
      if (previous !== null) {
        try {
          localStorage.setItem(`${fullKey}:backup-${Date.now()}`, previous);
        } catch {
          // Quota limits on backup must not block resetting preferences.
        }
      }
      localStorage.setItem(fullKey, JSON.stringify(value));
    },
  },
  getAppVersion: async () => import.meta.env.VITE_APP_VERSION,
};
