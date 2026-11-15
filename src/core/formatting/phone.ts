/**
 * نرمال‌سازی شماره تلفن — بازسازی `X.normPhone` در Demo (app/core.js:۵۳۸).
 *
 * قانون: ارقام فارسی → ASCII، حذف همه نویسه‌های غیررقمی، سپس:
 *   - شماره با پیشوند ۹۸ و طول ۱۲ → ۰ + ارقام داخلی (۹۸۹… → ۰۸۹…)
 *   - شماره ۱۰ رقمی آغازشده با ۹ → افزودن ۰ ابتدا (۹۱۲… → ۰۹۱۲…)
 *
 * این ماژول منبع واحد نرمال‌سازی تلفن برای کل برنامه است (R-30).
 */
import { toEnDigits, toFaDigits } from "./digits";

/**
 * شماره تلفن را به فرمت استاندارد ۱۱ رقم ایرانی برمی‌گرداند.
 * ورودی نامعتبر → رشته خالی یا مقدار نرمال‌نشده (برای گزارش خطا).
 */
export function normalizePhone(input: string | null | undefined): string {
  let s = toEnDigits(input ?? "").replace(/\D/g, "");
  if (s.indexOf("98") === 0 && s.length === 12) s = "0" + s.slice(2);
  if (s.length === 10 && s[0] === "9") s = "0" + s;
  return s;
}

/** آیا شماره نرمال‌شده معتبر است؟ (۱۱ رقم آغازشده با ۰ — app/lead-core.js:۵۴) */
export function isValidIranPhone(normalized: string): boolean {
  return normalized.length === 11 && normalized[0] === "0";
}

/**
 * نمایش فارسی شماره تلفن با دسته‌بندی ۴-۳-۴ — بازسازی `X.phoneFa`
 * در Demo (app/core.js:۵۴۶): ۰۹۱۲ ۱۲۳ ۴۵۶۷.
 */
export function formatPhoneFa(input: string | null | undefined): string {
  const s = normalizePhone(input);
  return toFaDigits(s.length === 11 ? `${s.slice(0, 4)} ${s.slice(4, 7)} ${s.slice(7)}` : s);
}
