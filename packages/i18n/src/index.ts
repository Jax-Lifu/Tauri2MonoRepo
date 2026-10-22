import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import type { Locale } from "@app/shared";
import type {} from "./i18next";
import zhCN from "./locales/zh-CN.json";
import enUS from "./locales/en-US.json";

export const resources = {
  "zh-CN": { translation: zhCN },
  "en-US": { translation: enUS },
} as const;

export const i18n = createInstance();
let initialization: Promise<unknown> | undefined;

export async function initI18n(locale: Locale): Promise<void> {
  initialization ??= i18n.use(initReactI18next).init({
    resources,
    lng: locale,
    fallbackLng: "en-US",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    initImmediate: false,
  });
  await initialization;
  if (i18n.language !== locale) await i18n.changeLanguage(locale);
  document.documentElement.lang = locale;
}

export { useTranslation, Trans } from "react-i18next";
