/**
 * گردسازی مبالغ به مرز ۱۰۰٬۰۰۰ ریال — قانون کسب‌کار R-08.
 * منبع: app/order.js:116 و app/buy.js:61 در Demo.
 *
 * هر مبلغ قبل از ذخیره/نمایش به نزدیک‌ترین ضریب ۱۰۰٬۰۰۰ گرد می‌شود.
 */

export const ROUND_STEP = 100_000;

/** گردسازی یک مقدار به نزدیک‌ترین ضریب ROUND_STEP (Demo: rnd). */
export function roundToStep(value: number | string | null | undefined): number {
  return Math.round((Number(value) || 0) / ROUND_STEP) * ROUND_STEP;
}
