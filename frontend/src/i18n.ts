import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import "dayjs/locale/uz-latn";
import { en, ru, uz } from "./locales";

export const LANGS = [
  { code: "ru", label: "Русский", cc: "ru" },
  { code: "en", label: "English", cc: "gb" },
  { code: "uz", label: "O'zbekcha", cc: "uz" },
] as const;

// Языки с письмом справа налево (на будущее)
const RTL = new Set<string>([]);

// Язык интерфейса -> локаль dayjs (для месяцев/дней недели в календаре).
const DAYJS_LOCALE: Record<string, string> = {
  ru: "ru",
  en: "en",
  uz: "uz-latn",
};

const resources = {
  ru: { translation: ru },
  en: { translation: en },
  uz: { translation: uz },
};

const saved = localStorage.getItem("postwave_lang") || "ru";

function applyLocale(code: string) {
  dayjs.locale(DAYJS_LOCALE[code] || "en");
  document.documentElement.dir = RTL.has(code) ? "rtl" : "ltr";
  document.documentElement.lang = code;
}

i18n.use(initReactI18next).init({
  resources,
  lng: saved,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

applyLocale(saved);

export function setLanguage(code: string) {
  i18n.changeLanguage(code);
  localStorage.setItem("postwave_lang", code);
  applyLocale(code);
}

export type Dict = typeof en;
export default i18n;
