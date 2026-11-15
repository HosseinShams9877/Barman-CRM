/**
 * تجزیه تاریخ شمسی از متن ورودی — بر اساس parseFaDate در Demo (app/core.js).
 *
 * تفاوت‌های مستند (افزایش کیفیت، نه تغییر قانون):
 *   ۱. ارقام فارسی، علامت‌های فارسی (٬ ٫) و جداکننده‌های `/ - .` پشتیبانی می‌شوند.
 *   ۲. بازه سال ۱۳۰۰–۱۵۹۹ ( Demo: `1[34]\d\d` یعنی ۱۳۰۰–۱۴۹۹).
 *   ۳. روز بر اساس daysInMonth اعتبارسنجی می‌شود (Demo فقط d ≤ ۳۱ چک می‌کرد).
 *
 * خروجی `null` یعنی نامعتبر — هیچ استثنایی پرتاب نمی‌شود.
 */
import { JALALI_MAX_YEAR, JALALI_MIN_YEAR } from "./constants";
import { toEnDigits } from "../formatting/digits";
import { daysInMonth } from "./jdf";
import type { JalaliDate } from "./jdf";

const DATE_RE = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/;

/**
 * تجزیه یک رشته تاریخ شمسی.
 *
 * نمونه: `"۱۴۰۵/۰۸/۱۹"`، `"1405-08-19"`، `"1405.8.19"` → `{jy:1405, jm:8, jd:19}`
 */
export function parseJalali(input: string | null | undefined): JalaliDate | null {
  if (input === null || input === undefined) return null;
  const normalized = toEnDigits(String(input)).trim();
  const match = DATE_RE.exec(normalized);
  if (!match) return null;

  const [, ys, ms, ds] = match;
  const jy = Number(ys);
  const jm = Number(ms);
  const jd = Number(ds);

  if (jy < JALALI_MIN_YEAR || jy > JALALI_MAX_YEAR) return null;
  if (jm < 1 || jm > 12) return null;
  if (jd < 1) return null;
  if (jd > daysInMonth(jy, jm)) return null;

  return { jy, jm, jd };
}

/** معادل parseJalali ولی خروجی قالب ذخیره‌سازی `YYYY/MM/DD` (یا null). */
export function parseJalaliIso(input: string | null | undefined): string | null {
  const date = parseJalali(input);
  if (date === null) return null;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.jy}/${pad(date.jm)}/${pad(date.jd)}`;
}
