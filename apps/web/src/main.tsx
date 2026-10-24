import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { resolveLocale } from "@app/shared";
import { i18n, initI18n } from "@app/i18n";
import { AppShell } from "@app/ui";
import { webPlatform } from "./platform";

const root = createRoot(document.getElementById("root")!);
const reportError = (error: unknown) => {
  console.error(error);
};

window.addEventListener("error", (event) => reportError(event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => reportError(event.reason));

async function start() {
  await initI18n(resolveLocale("system"));
  root.render(
    <StrictMode>
      <AppShell platform={webPlatform} onError={reportError} />
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
});
