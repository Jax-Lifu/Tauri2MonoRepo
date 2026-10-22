import { useRef, useState, type FormEvent } from "react";
import type { Platform } from "@app/shared";
import { useTranslation } from "@app/i18n";
import { Button } from "./components/button";
import { Input } from "./components/input";

export function GreetScreen({ platform, onSettings, onError }: {
  platform: Platform;
  onSettings?: () => void;
  onError?: (error: unknown) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  const greet = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      setMessage((await platform.greet(name)).message);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      onError?.(error);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="page home-page">
      <header className="page-header">
        <p className="eyebrow">{t("app.workspace")}</p>
        <h1>{t("app.welcome")}</h1>
        <p>{t("app.description")}</p>
      </header>
      <section className="greet-section" aria-labelledby="greet-title">
        <h2 id="greet-title">{t("app.demo")}</h2>
        <form onSubmit={(event) => { void greet(event); }}>
          <label htmlFor="greet-name">{t("app.name")}</label>
          <div className="greet-input-row">
            <Input id="greet-name" className="h-[40px] text-base md:text-base" autoComplete="given-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={t("app.namePlaceholder")} />
            <Button type="submit" className="h-[40px] text-base" disabled={busy}>{busy ? t("app.greeting") : t("app.greet")}<span aria-hidden="true">↗</span></Button>
          </div>
        </form>
        {error && <p className="inline-error" role="alert">{t("error.operation")} {error}</p>}
        <div className="greet-response" aria-live="polite">
          <span className="response-label">{t("app.result")}</span>
          <p className={message ? "" : "muted"}>{message || t("app.resultEmpty")}</p>
        </div>
      </section>
      {onSettings && (
        <section className="preferences-link">
          <div><h2>{t("app.preferences")}</h2><p>{t("app.preferencesDescription")}</p></div>
          <Button variant="link" className="px-0" onClick={onSettings}>{t("app.openSettings")} <span aria-hidden="true">→</span></Button>
        </section>
      )}
    </div>
  );
}
