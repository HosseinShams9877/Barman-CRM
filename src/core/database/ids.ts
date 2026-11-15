/**
 * تولید شناسه‌های با پیشوند — بازسازی `X.nextId` در Demo (app/core.js:۳۶۵).
 *
 * Demo: `SEQ0 = { AC: 100, LD: 1000, … }` و شناسه‌ها به‌ترتیب `AC-101`،
 * `AC-102`، `LD-1001`، … صادر می‌شوند.
 *
 * PHASE_03 §۶ جدول شمارنده مستقل (seq) در نظر نگرفته است، لذا شمارنده
 * از بزرگترین شماره موجود در جدول استخراج می‌شود. این روش برای نرخ نوشتن
 * این ماژول کافی است؛ انحراف در گزارش فاز ۳ ثبت شده است.
 *
 * PHASE_05: پیشوند `PJ` برای کارهای تولید اضافه شد (شمارنده از ۵۰۰).
 *
 * PHASE_06: پیشوند `BY` برای خریدها اضافه شد (شمارنده از ۱۰۰).
 */
export const SEQ_START: Readonly<Record<string, number>> = {
  AC: 100,
  LD: 1000,
  PF: 1200,
  PJ: 500,
  BY: 100,
};

/**
 * شناسه بعدی با فرمت `<prefix>-<n>` را برمی‌گرداند.
 *
 * @param prefix  پیشوند، مثلاً "AC" یا "LD".
 * @param existing شناسه‌های موجود همان جدول.
 */
export function nextPrefixedId(prefix: string, existing: Iterable<string>): string {
  const start = SEQ_START[prefix] ?? 100;
  let max = start;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  for (const id of existing) {
    const m = re.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${max + 1}`;
}

/**
 * شناسه حرکت انبار با الگوی `uid("mv")` در Demo (app/core.js:۱۱۰).
 *
 * Demo شناسه حرکت را به‌صورت `mv + Date.now().toString(36) + random` می‌سازد
 * (شمارنده متوالی نیست) — این الگو عیناً بازسازی می‌شود.
 */
export function newMoveId(): string {
  return (
    "mv" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 6)
  );
}
