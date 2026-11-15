/**
 * خطوط محصول سرنخ — منبع: app/core.js:199 (LINES) و server/export.js:49.
 *
 * هر سرنخ دقیقاً به یکی از دو خط تعلق دارد: «محصولات تولیدی» (تولید داخل)
 * یا «محصولات نمایندگی». بورد سرنخ‌ها بر اساس خط فیلتر می‌شود (PHASE_03 §۱۰).
 */
export type LeadLineKey = "prod" | "agency";

export type LeadLine = {
  key: LeadLineKey;
  /** عنوان فارسی — app/core.js:199. */
  label: string;
};

export const LEAD_LINES: readonly LeadLine[] = [
  { key: "prod", label: "محصولات تولیدی" },
  { key: "agency", label: "محصولات نمایندگی" },
] as const;

const LINE_BY_KEY: Readonly<Record<LeadLineKey, LeadLine>> = Object.freeze(
  Object.fromEntries(LEAD_LINES.map((l) => [l.key, l])) as Record<LeadLineKey, LeadLine>,
);

/** برچسب فارسی خط. */
export function lineLabel(key: LeadLineKey): string {
  return LINE_BY_KEY[key].label;
}

/** اعتبارسنجی کلید خط. */
export function isLeadLineKey(value: unknown): value is LeadLineKey {
  return value === "prod" || value === "agency";
}
