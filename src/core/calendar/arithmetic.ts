/**
 * حساب تاریخ شمسی — جمع/کاهش روز و ماه، محدوده ماه، مقایسه.
 *
 * `addMonths` پیاده‌سازی وفادار `addJMonths` در Demo (app/core.js) است:
 * روز نهایی با `daysInMonth` محدود می‌شود (مثلاً ۳۱ فروردین + ۱ ماه = ۳۱ اردیبهشت).
 */
import { daysInMonth, jalaliToJdn, jdnToJalali } from "./jdf";
import type { JalaliDate } from "./jdf";

/** n روز به تاریخ اضافه/کم می‌کند (از طریق JDN — دقیق و بدون خطای ماه). */
export function addDays(date: JalaliDate, days: number): JalaliDate {
  return jdnToJalali(jalaliToJdn(date.jy, date.jm, date.jd) + Math.trunc(days));
}

/**
 * n ماه شمسی اضافه/کم می‌کند — پیاده‌سازی addJMonths در Demo (app/core.js).
 * روز با تعداد روزهای ماه مقصد محدود می‌شود (سرریز ماه کبیسه/اسفند).
 */
export function addMonths(date: JalaliDate, months: number): JalaliDate {
  const m = date.jm - 1 + Math.trunc(months);
  const jy = date.jy + Math.floor(m / 12);
  const jm = ((m % 12) + 12) % 12 + 1;
  const max = daysInMonth(jy, jm);
  return { jy, jm, jd: Math.min(date.jd, max) };
}

/** n سال شمسی اضافه/کم می‌کند — روز با اسفند سال مقصد محدود می‌شود. */
export function addYears(date: JalaliDate, years: number): JalaliDate {
  const jy = date.jy + Math.trunc(years);
  const max = daysInMonth(jy, date.jm);
  return { jy, jm: date.jm, jd: Math.min(date.jd, max) };
}

/** نخستین روز ماه. */
export function startOfMonth(date: JalaliDate): JalaliDate {
  return { jy: date.jy, jm: date.jm, jd: 1 };
}

/** آخرین روز ماه (۲۹ یا ۳۰ اسفند در سال کبیسه). */
export function endOfMonth(date: JalaliDate): JalaliDate {
  return { jy: date.jy, jm: date.jm, jd: daysInMonth(date.jy, date.jm) };
}

/** مقایسه دو تاریخ: -1 / 0 / 1. */
export function compareJalali(a: JalaliDate, b: JalaliDate): -1 | 0 | 1 {
  const ja = jalaliToJdn(a.jy, a.jm, a.jd);
  const jb = jalaliToJdn(b.jy, b.jm, b.jd);
  if (ja < jb) return -1;
  if (ja > jb) return 1;
  return 0;
}

/** فاصله روزانه a → b (b منهای a). */
export function diffDays(a: JalaliDate, b: JalaliDate): number {
  return jalaliToJdn(b.jy, b.jm, b.jd) - jalaliToJdn(a.jy, a.jm, a.jd);
}
