/**
 * تبدیل ارقام فارسی/انگلیسی — پیاده‌سازی وفادار به Demo (app/core.js).
 * این ماژول منبع واحد تبدیل ارقام برای کل برنامه است.
 */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** تبدیل ارقام ASCII به فارسی (Demo: fa) */
export function toFaDigits(input: string | number | null | undefined): string {
  return String(input ?? "").replace(/\d/g, (d) => FA_DIGITS[Number(d)] ?? d);
}

/**
 * نرمال‌سازی متن فارسی به ارقام ASCII (Demo: toEn).
 * ارقام فارسی را تبدیل می‌کند، جداکننده‌های هزارگان (٬ و ، و ،) را
 * حذف می‌کند و جداکننده اعشار فارسی (٫) را به نقطه تبدیل می‌کند.
 */
export function toEnDigits(input: string | number | null | undefined): string {
  return String(input)
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٬,]/g, "")
    .replace("٫", ".");
}

/** تجزیه عدد از متن فارسی — ۰ برای ورودی نامعتبر (Demo: numIn) */
export function parseFaNumber(input: string | number | null | undefined): number {
  const n = parseFloat(toEnDigits(input));
  return Number.isFinite(n) ? n : 0;
}
