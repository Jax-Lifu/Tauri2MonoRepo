import { create } from "zustand";
import { defaultSettings, migrateSettings, resolveLocale, type AppSettings, type Platform } from "@app/shared";
import { initI18n } from "@app/i18n";
import { applyAppearance } from "../theme";

const STORE_KEY = "settings";
export type SettingsPatch = Partial<Omit<AppSettings, "version">>;

interface SettingsState {
  settings: AppSettings;
  ready: boolean;
  saving: boolean;
  readFailed: boolean;
  error: Error | null;
  platform: Platform | null;
  hydrate(platform: Platform, retry?: boolean): Promise<void>;
  update(patch: SettingsPatch): Promise<void>;
  reset(): Promise<void>;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function applyNative(platform: Platform, next: AppSettings, previous?: AppSettings) {
  if (!previous || next.theme !== previous.theme) await platform.setNativeTheme?.(next.theme);
  const nextLocale = resolveLocale(next.locale);
  const previousLocale = previous ? resolveLocale(previous.locale) : undefined;
  if (!previousLocale || nextLocale !== previousLocale) await platform.setNativeLocale?.(nextLocale);
  if (previous && next.launchAtLogin !== previous.launchAtLogin) await platform.setAutostart?.(next.launchAtLogin);
  if (!previous || next.closeToTray !== previous.closeToTray) await platform.setCloseToTray?.(next.closeToTray);
}

async function applyLocal(settings: AppSettings, persistCache = true) {
  applyAppearance(settings, persistCache);
  await initI18n(resolveLocale(settings.locale));
}

export function createSettingsStore() {
  let hydration: Promise<void> | undefined;
  let queue = Promise.resolve();
  let pending = 0;

  return create<SettingsState>((set, get) => {
    const save = (patch: SettingsPatch, reset = false): Promise<void> => {
      pending += 1;
      set({ saving: true });
      const operation = queue.then(async () => {
        const { platform, settings: previous, readFailed } = get();
        try {
          if (!platform || !get().ready) throw new Error("Settings are not ready");
          if (readFailed && !reset) throw new Error("Reload or reset settings before making changes");
          const next = migrateSettings({ ...previous, ...patch });
          try {
            await applyNative(platform, next, readFailed ? undefined : previous);
            if (reset && platform.store.reset) await platform.store.reset(STORE_KEY, next);
            else await platform.store.set(STORE_KEY, next);
          } catch (error) {
            const nextLocale = resolveLocale(next.locale);
            const previousLocale = resolveLocale(previous.locale);
            const rollback = await Promise.allSettled([
              next.theme !== previous.theme ? platform.setNativeTheme?.(previous.theme) : undefined,
              nextLocale !== previousLocale ? platform.setNativeLocale?.(previousLocale) : undefined,
              next.launchAtLogin !== previous.launchAtLogin ? platform.setAutostart?.(previous.launchAtLogin) : undefined,
              (readFailed || next.closeToTray !== previous.closeToTray)
                ? platform.setCloseToTray?.(readFailed ? false : previous.closeToTray)
                : undefined,
            ]);
            const failed = rollback.find((result) => result.status === "rejected");
            if (failed?.status === "rejected") {
              throw new Error(`${asError(error).message}; could not restore native preference: ${asError(failed.reason).message}`);
            }
            throw error;
          }
          set({ settings: next, readFailed: false, error: null });
          await applyLocal(next);
        } catch (error) {
          set({ error: asError(error) });
          throw error;
        }
      }).finally(() => {
        pending -= 1;
        set({ saving: pending > 0 });
      });
      // A failed operation must not poison the queue for the next user action.
      queue = operation.catch(() => {});
      return operation;
    };

    return {
      settings: { ...defaultSettings },
      ready: false,
      saving: false,
      readFailed: false,
      error: null,
      platform: null,
      hydrate(platform, retry = false) {
        if (hydration) return hydration;
        if (!retry && get().ready && get().platform === platform) return Promise.resolve();
        set({ platform, ready: false, error: null, readFailed: false });
        hydration = (async () => {
          let settings = { ...defaultSettings };
          let readFailed = false;
          try {
            settings = migrateSettings(await platform.store.get<unknown>(STORE_KEY));
          } catch (error) {
            readFailed = true;
            set({ error: asError(error), readFailed: true });
          }
          try {
            if (platform.getAutostart) settings.launchAtLogin = await platform.getAutostart();
          } catch (error) {
            if (!get().error) set({ error: asError(error) });
          }
          try {
            await applyLocal(settings, !readFailed);
            await applyNative(platform, readFailed ? { ...settings, closeToTray: false } : settings);
          } catch (error) {
            if (!get().error) set({ error: asError(error) });
          } finally {
            set({ settings, ready: true });
          }
        })().finally(() => { hydration = undefined; });
        return hydration;
      },
      update: (patch) => save(patch),
      reset: () => save({ ...defaultSettings }, true),
    };
  });
}

export const useSettings = createSettingsStore();
