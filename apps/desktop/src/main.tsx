import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { ask } from "@tauri-apps/plugin-dialog";
import { error as logError } from "@tauri-apps/plugin-log";
import { resolveLocale } from "@app/shared";
import { i18n, initI18n } from "@app/i18n";
import { AppShell, useSettings } from "@app/ui";
import { createDesktopPlatform } from "./platform";

const root = createRoot(document.getElementById("root")!);
const reportError = (error: unknown) => {
  console.error(error);
  void logError(error instanceof Error ? error.stack ?? error.message : String(error)).catch(console.error);
};

window.addEventListener("error", (event) => reportError(event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => reportError(event.reason));
if (import.meta.env.PROD) window.addEventListener("contextmenu", (event) => event.preventDefault());

async function start() {
  await initI18n(resolveLocale("system"));
  const platform = await createDesktopPlatform();

  async function onReady() {
    await invoke("frontend_ready");
    if (!useSettings.getState().settings.autoCheckUpdate || !platform.checkUpdate) return;
    try {
      const update = await platform.checkUpdate();
      if (!update) return;
      try {
        if (await ask(i18n.t("settings.newVersion", { version: update.version }), { kind: "info" })) {
          await update.install();
        }
      } finally {
        await update.dispose?.();
      }
    } catch (error) {
      reportError(error);
    }
  }

  root.render(
    <StrictMode>
      <AppShell platform={platform} onReady={onReady} onError={reportError} />
    </StrictMode>,
  );
}

void start().catch((error: unknown) => {
  reportError(error);
  root.render(
    <main role="alert" style={{ padding: 32 }}>
      <h1>{i18n.t("error.title", { defaultValue: "启动失败 / Unable to start" })}</h1>
      <p>{error instanceof Error ? error.message : String(error)}</p>
      <button onClick={() => location.reload()}>{i18n.t("error.reload", { defaultValue: "重新加载 / Reload" })}</button>
    </main>,
  );
  void invoke("frontend_ready").catch(reportError);
});
