import type { ThemeMode } from "./settings";

export interface Greeting {
  message: string;
}

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  reset?<T>(key: string, value: T): Promise<void>;
}

export interface UpdateInfo {
  version: string;
  notes?: string;
  install(): Promise<void>;
  dispose?(): Promise<void>;
}

/** Shared UI depends on capabilities, never on a native runtime. */
export interface Platform {
  name: "desktop" | "web";
  greet(name: string): Promise<Greeting>;
  store: KeyValueStore;
  getAppVersion(): Promise<string>;
  setNativeTheme?(theme: ThemeMode): Promise<void>;
  getAutostart?(): Promise<boolean>;
  setAutostart?(enabled: boolean): Promise<void>;
  setCloseToTray?(enabled: boolean): Promise<void>;
  checkUpdate?(): Promise<UpdateInfo | null>;
}
