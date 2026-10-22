import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { resolveLocale } from "@app/shared";
import { initI18n } from "@app/i18n";
import { AppShell } from "@app/ui";
import { webPlatform } from "./platform";

void initI18n(resolveLocale("system")).catch(console.error);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppShell platform={webPlatform} />
  </StrictMode>,
);
