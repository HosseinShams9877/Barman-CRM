/**
 * محلی‌سازی پایه — فاز ۱ (core/localization طبق PHASE_01 §۵).
 * برنامه فارسی و RTL است. هیچ وابستگی‌ای به Intl وجود ندارد (CD-06).
 */

export const APP_LANG = "fa" as const;
export const APP_DIR = "rtl" as const;
export type AppLocale = "fa-IR";
export const APP_LOCALE: AppLocale = "fa-IR";

/** زبان‌های RTL پشتیبانی‌شده. */
const RTL_LANGS: ReadonlySet<string> = new Set(["fa", "ar", "ps", "ur"]);

export function isRtlLocale(lang: string): boolean {
  return RTL_LANGS.has(lang.trim().toLowerCase());
}

/** صفت‌های html برنامه برای layout. */
export function htmlAttrs(): Readonly<Record<string, string>> {
  return { lang: APP_LANG, dir: APP_DIR };
}
