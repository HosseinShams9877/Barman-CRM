/**
 * قالب‌بندی مبالغ و اعداد — پیاده‌سازی وفادار به Demo (app/core.js §۱۰۸-۱۰۹).
 * مبالغ به ریال و با جداکننده هزارگان فارسی «٬» نمایش داده می‌شوند.
 */
import { toFaDigits } from "./digits";

/**
 * گروه‌بندی سه‌تایی ارقام با جداکننده داده‌شده — بدون وابستگی به Intl
 * (خروجی با `toLocaleString("en-US")` در Demo یکسان است، اما بدون نیاز
 * به داده‌های ICU کار می‌کند — تصمیم همراه با حذف وابستگی Intl).
 */
function groupDigits(intPart: string, separator: string): string {
  const negative = intPart.startsWith("-");
  const digits = negative ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return negative ? `-${grouped}` : grouped;
}

/**
 * قالب‌بندی مبلغ (Demo: money) — گرد کردن، گروه‌بندی سه‌تایی با
 * جداکننده «٬» و ارقام فارسی. ورودی نامعتبر ۰ می‌شود.
 */
export function formatMoney(value: number | string | null | undefined): string {
  const rounded = Math.round(Number(value) || 0);
  return toFaDigits(groupDigits(String(rounded), "٬"));
}

/**
 * قالب‌بندی عدد عمومی (Demo: num) — بدون d: گرد به سه رقم اعشار،
 * با d: دقیقاً d رقم اعشار با جداکننده فارسی «٫». (بدون گروه‌بندی — فرق با money)
 */
export function formatNumber(
  value: number | string | null | undefined,
  decimals?: number,
): string {
  const v = Number(value) || 0;
  const s =
    decimals === undefined ? String(Math.round(v * 1000) / 1000) : v.toFixed(decimals);
  return toFaDigits(s).replace(".", "٫");
}
