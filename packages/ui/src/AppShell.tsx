import { useCallback, useEffect, useRef, useState } from "react";
import { resolveLocale, type Platform } from "@app/shared";
import { initI18n, useTranslation } from "@app/i18n";
import { useSettings } from "./store/settings";
import { applyAppearance, watchSystemTheme } from "./theme";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Button } from "./components/button";
import { GreetScreen } from "./GreetScreen";
import { SettingsPage } from "./pages/SettingsPage";
import "./styles/theme.css";

type Route = "home" | "settings";
const readRoute = (): Route => window.location.hash === "#/settings" ? "settings" : "home";

export function AppShell({ platform, onReady, onError }: {
  platform: Platform;
  onReady?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
}) {
  const { t } = useTranslation();
  const { ready, error, readFailed } = useSettings();
  const [route, setRoute] = useState<Route>(readRoute);
  const [startupError, setStartupError] = useState("");
  const notified = useRef(false);
  const navigate = useCallback((next: Route) => {
    setRoute(next);
    window.location.hash = next === "home" ? "/" : "/settings";
  }, []);

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    let active = true;
    void useSettings.getState().hydrate(platform).then(async () => {
      if (!active || notified.current) return;
      notified.current = true;
      await onReady?.();
    }).catch((error: unknown) => {
      if (active) setStartupError(error instanceof Error ? error.message : String(error));
      onError?.(error);
    });
    return () => { active = false; };
  }, [platform, onReady, onError]);

  useEffect(() => { if (error) onError?.(error); }, [error, onError]);

  useEffect(() => watchSystemTheme(() => applyAppearance(useSettings.getState().settings)), []);

  useEffect(() => {
    const onLanguage = () => {
      const { locale } = useSettings.getState().settings;
      if (locale === "system") void initI18n(resolveLocale(locale)).catch((error: unknown) => {
        setStartupError(error instanceof Error ? error.message : String(error));
        onError?.(error);
      });
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ",") { event.preventDefault(); navigate("settings"); }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("languagechange", onLanguage);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("languagechange", onLanguage); };
  }, [onError, navigate]);

  return <ErrorBoundary onError={onError}>
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark" aria-hidden="true">t.</span><span>{t("app.title")}</span></div>
        <div className="sidebar-label">{t("app.workspace")}</div>
        <nav className="app-nav" aria-label={t("nav.label")}>
          <Button variant="ghost" className="h-auto min-h-[40px] text-base" aria-current={route === "home" ? "page" : undefined} onClick={() => navigate("home")}><span aria-hidden="true">⌂</span>{t("nav.home")}</Button>
          <Button variant="ghost" className="h-auto min-h-[40px] text-base" aria-current={route === "settings" ? "page" : undefined} onClick={() => navigate("settings")}><span aria-hidden="true">⚙</span>{t("nav.settings")}</Button>
        </nav>
        <div className="sidebar-footer"><span className="platform-label"><span className="status-dot" aria-hidden="true" />{t(`app.${platform.name}`)}</span><p>{t("app.shortcut")} <kbd>Ctrl / ⌘ ,</kbd></p></div>
      </aside>
      <main className="workspace">
        <div className="workspace-bar"><span>{t("app.workspace")}</span><span aria-hidden="true">/</span><strong>{t(`nav.${route}`)}</strong></div>
        {(error || startupError) && <div className="error-banner" role="alert">
          <div><strong>{readFailed ? t("error.settingsRead") : t("error.operation")}</strong><p>{error?.message || startupError}</p></div>
          {readFailed ? <Button variant="outline" onClick={() => { void useSettings.getState().hydrate(platform, true).catch((error: unknown) => onError?.(error)); }}>{t("error.retry")}</Button>
            : <Button variant="outline" onClick={() => location.reload()}>{t("error.reload")}</Button>}
        </div>}
        {!ready ? <p className="loading-state" role="status">{t("app.loading")}</p> : route === "home"
          ? <GreetScreen platform={platform} onSettings={() => navigate("settings")} onError={onError} />
          : <SettingsPage platform={platform} onError={onError} />}
      </main>
    </div>
  </ErrorBoundary>;
}
