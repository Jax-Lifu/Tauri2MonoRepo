import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Accent, AppSettings, FontSize, Platform, ThemeMode, UpdateInfo } from "@app/shared";
import { useTranslation } from "@app/i18n";
import { useSettings, type SettingsPatch } from "../store/settings";
import { Button } from "../components/button";
import { Switch } from "../components/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "../components/alert-dialog";

const ACCENTS: Accent[] = ["blue", "green", "violet", "orange", "rose"];

function Row({ label, description, htmlFor, children }: {
  label: string;
  description?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return <div className="settings-row">
    <div className="row-label"><label htmlFor={htmlFor}>{label}</label>{description && <p>{description}</p>}</div>
    {children}
  </div>;
}

export function SettingsPage({ platform, onError }: { platform: Platform; onError?: (error: unknown) => void }) {
  const { t } = useTranslation();
  const { settings, update, reset, saving, readFailed, error: settingsError } = useSettings();
  const [version, setVersion] = useState("—");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null | undefined>();
  const [updateBusy, setUpdateBusy] = useState<"check" | "install" | null>(null);
  const [error, setError] = useState("");
  const alive = useRef(false);
  const busy = useRef(false);
  const updateResource = useRef<UpdateInfo | null>(null);

  const report = (error: unknown) => {
    if (alive.current) setError(error instanceof Error ? error.message : String(error));
    onError?.(error);
  };
  const dispose = (info: UpdateInfo | null) => { void info?.dispose?.().catch(report); };

  useEffect(() => {
    alive.current = true;
    let current = true;
    void platform.getAppVersion().then((value) => { if (current) setVersion(value); }).catch((error: unknown) => {
      if (current) setError(error instanceof Error ? error.message : String(error));
      onError?.(error);
    });
    return () => {
      current = false;
      alive.current = false;
      if (!busy.current) {
        dispose(updateResource.current);
        updateResource.current = null;
      }
    };
  }, [platform, onError]);

  const change = (patch: SettingsPatch) => { void update(patch).catch(() => {}); };

  const checkUpdate = async () => {
    if (!platform.checkUpdate || busy.current) return;
    busy.current = true;
    setUpdateBusy("check");
    setError("");
    dispose(updateResource.current);
    updateResource.current = null;
    setUpdateInfo(undefined);
    try {
      const result = await platform.checkUpdate();
      updateResource.current = result;
      if (alive.current) setUpdateInfo(result);
    } catch (error) {
      report(error);
    } finally {
      busy.current = false;
      if (alive.current) setUpdateBusy(null);
      else { dispose(updateResource.current); updateResource.current = null; }
    }
  };

  const installUpdate = async () => {
    if (!updateInfo || busy.current) return;
    busy.current = true;
    setUpdateBusy("install");
    setError("");
    try { await updateInfo.install(); } catch (error) { report(error); }
    finally {
      busy.current = false;
      if (alive.current) setUpdateBusy(null);
      else { dispose(updateResource.current); updateResource.current = null; }
    }
  };

  return (
    <div className="page settings-page">
      <header className="page-header">
        <p className="eyebrow">{t("app.workspace")}</p>
        <h1>{t("nav.settings")}</h1>
        <p>{t("settings.description")}</p>
      </header>
      <fieldset className="settings-fields" disabled={saving || readFailed}>
        <section className="settings-section" aria-labelledby="general-title">
          <h2 id="general-title">{t("settings.general")}</h2>
          <Row htmlFor="locale" label={t("settings.language")} description={t("settings.languageDescription")}>
            <select id="locale" value={settings.locale} onChange={(event) => change({ locale: event.target.value as AppSettings["locale"] })}>
              <option value="system">{t("settings.followSystem")}</option>
              <option value="zh-CN">简体中文</option><option value="en-US">English</option>
            </select>
          </Row>
          {platform.setAutostart && <Row htmlFor="autostart" label={t("settings.launchAtLogin")} description={t("settings.launchDescription")}>
            <Switch id="autostart" disabled={saving || readFailed} checked={settings.launchAtLogin} onCheckedChange={(launchAtLogin) => change({ launchAtLogin })} />
          </Row>}
          {platform.setCloseToTray && <Row htmlFor="close-to-tray" label={t("settings.closeToTray")} description={t("settings.trayDescription")}>
            <Switch id="close-to-tray" disabled={saving || readFailed} checked={settings.closeToTray} onCheckedChange={(closeToTray) => change({ closeToTray })} />
          </Row>}
        </section>
        <section className="settings-section" aria-labelledby="appearance-title">
          <h2 id="appearance-title">{t("settings.appearance")}</h2>
          <Row htmlFor="theme" label={t("settings.theme")} description={t("settings.themeDescription")}>
            <select id="theme" value={settings.theme} onChange={(event) => change({ theme: event.target.value as ThemeMode })}>
              <option value="system">{t("settings.followSystem")}</option><option value="light">{t("settings.light")}</option><option value="dark">{t("settings.dark")}</option>
            </select>
          </Row>
          <Row label={t("settings.accent")} description={t("settings.accentDescription")}>
            <div className="swatches" role="group" aria-label={t("settings.accent")}>
              {ACCENTS.map((accent) => <Button key={accent} className={`swatch swatch-${accent}`} aria-label={t(`settings.colors.${accent}`)} aria-pressed={settings.accent === accent} onClick={() => change({ accent })}>
                {settings.accent === accent && <span aria-hidden="true">✓</span>}
              </Button>)}
            </div>
          </Row>
          <Row htmlFor="font-size" label={t("settings.fontSize")}>
            <select id="font-size" value={settings.fontSize} onChange={(event) => change({ fontSize: event.target.value as FontSize })}>
              <option value="sm">{t("settings.small")}</option><option value="md">{t("settings.medium")}</option><option value="lg">{t("settings.large")}</option>
            </select>
          </Row>
          <Row htmlFor="reduce-motion" label={t("settings.reduceMotion")} description={t("settings.motionDescription")}>
            <Switch id="reduce-motion" disabled={saving || readFailed} checked={settings.reduceMotion} onCheckedChange={(reduceMotion) => change({ reduceMotion })} />
          </Row>
        </section>
        {platform.checkUpdate && <section className="settings-section" aria-labelledby="update-title">
          <h2 id="update-title">{t("settings.update")}</h2>
          <Row htmlFor="auto-update" label={t("settings.autoCheckUpdate")}>
            <Switch id="auto-update" disabled={saving || readFailed} checked={settings.autoCheckUpdate} onCheckedChange={(autoCheckUpdate) => change({ autoCheckUpdate })} />
          </Row>
          <div className="update-actions">
            <Button variant="outline" disabled={updateBusy !== null} onClick={() => { void checkUpdate(); }}>{updateBusy === "check" ? t("settings.checking") : t("settings.checkUpdate")}</Button>
            <span role="status">{updateInfo === null ? t("settings.upToDate") : updateInfo ? t("settings.newVersion", { version: updateInfo.version }) : ""}</span>
            {updateInfo && <Button disabled={updateBusy !== null} onClick={() => { void installUpdate(); }}>{updateBusy === "install" ? t("settings.installing") : t("settings.installAndRestart")}</Button>}
          </div>
          {updateInfo?.notes && <p className="release-notes">{updateInfo.notes}</p>}
        </section>}
      </fieldset>
      {platform.name === "desktop" && !platform.checkUpdate && <section className="settings-section">
        <h2>{t("settings.update")}</h2><p className="muted">{t("settings.updatesNotConfigured")}</p>
      </section>}
      {error && <p className="inline-error" role="alert">{t("error.operation")} {error}</p>}
      <section className="settings-section" aria-labelledby="about-title">
        <h2 id="about-title">{t("settings.about")}</h2>
        <Row label={t("settings.version")}><span className="value">{version}</span></Row>
        <Row label={t("settings.platform")}><span className="value">{t(`app.${platform.name}`)}</span></Row>
      </section>
      <div className="settings-footer">
        <span className="muted" role="status">{saving ? t("settings.saving") : readFailed ? "" : settingsError ? t("error.settingsSave") : t("settings.saved")}</span>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="outline" disabled={saving} title={t("settings.resetDescription")}>{t("settings.reset")}</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("settings.reset")}</AlertDialogTitle>
              <AlertDialogDescription>{t("settings.resetConfirm")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("settings.cancel")}</AlertDialogCancel>
              <AlertDialogAction disabled={saving} onClick={() => { void reset().catch(() => {}); }}>{t("settings.reset")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
