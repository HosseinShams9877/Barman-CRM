/**
 * Bucketing ماهانه بر اساس JDN — رفع R-11 (PHASE_07 §۹).
 *
 * مشکل Demo (reports.js:32): `fa(X.fDate(t)).slice(0,7)` روی تاریخ نمایشی
 * برش می‌زد — اگر قالب نمایش تغییر کند یا ارقام فارسی/انگلیسی درهم
 * باشند، کلید ماه خراب می‌شود.
 *
 * راه‌حل: لحظه (UTC ms) → تاریخ شمسی واقعی با `instantToJalali`
 * (موتور واحد JDF — CD-07) → کلید `YYYY/MM` با ارقام ASCII.
 */
import { instantToJalali } from "@core/calendar";

/** روز به میلی‌ثانیه — X.DAY در Demo. */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * کلید ماه شمسی یک لحظه: `YYYY/MM` با ارقام ASCII.
 *
 * کلیدهای خروجی مرتب‌شدنی به‌صورت لغزشی هستند (رشته با طول ثابت)
 * و با مقایسه رشته‌ای ساده صعودی می‌شوند.
 */
export function monthKeyOf(ms: number): string {
  const d = instantToJalali(ms);
  const jm = String(d.jm).padStart(2, "0");
  return `${d.jy}/${jm}`;
}

/**
 * لحظه شروع بازه روزهای اخیر — مطابق Demo
 * (reports.js:14: `Date.now() - F.days * X.DAY`).
 */
export function rangeFrom(days: number, now: number = Date.now()): number {
  return now - days * MS_PER_DAY;
}
