/**
 * مراحل سرنخ — منبع: server/export.js:48 (STAGE) و app/leads.js:72.
 *
 * پنج مرحله (PHASE_03 §۶):
 *   raw (سرنخ اولیه) → opp (فرصت تجاری) → pf (پیش‌فاکتور) → won (خرید قطعی)
 *   و lost (از دست رفته) به‌عنوان ستون پنجم بورد.
 *
 * `lost` ترمینال است: ورود به آن نیازمند دلیل است (app/leads.js:474) و
 * بازگرداندن آن به مرحله قبل انجام می‌شود (app/leads.js:539).
 */
export type LeadStageKey = "raw" | "opp" | "pf" | "won" | "lost";

export type LeadStage = {
  key: LeadStageKey;
  /** عنوان فارسی — server/export.js:48. */
  label: string;
  /** گروه رنگی Q-09 (توکن‌های --color-stage-* در utilities.css). */
  group: "sales" | "approval" | "fulfillment" | "lost";
  /** ترتیب نمایش در بورد (PHASE_03 §۱۰: ۵ ستون). */
  order: number;
  /** صفت باز بودن — سرنخ‌های باز در فیلترهای پیش‌فرض دیده می‌شوند. */
  open: boolean;
};

export const LEAD_STAGES: readonly LeadStage[] = [
  { key: "raw", label: "سرنخ اولیه", group: "sales", order: 1, open: true },
  { key: "opp", label: "فرصت تجاری", group: "sales", order: 2, open: true },
  { key: "pf", label: "پیش‌فاکتور", group: "approval", order: 3, open: true },
  { key: "won", label: "خرید قطعی", group: "fulfillment", order: 4, open: true },
  { key: "lost", label: "از دست رفته", group: "lost", order: 5, open: false },
] as const;

/** کلیدهای مراحل باز — معادل isOpen در Demo (app/leads.js:67). */
export const OPEN_STAGES: readonly LeadStageKey[] = ["raw", "opp", "pf", "won"];

/** کلیدهای ستون‌های بورد به ترتیب نمایش. */
export const BOARD_STAGES: readonly LeadStageKey[] = ["raw", "opp", "pf", "won", "lost"];

const STAGE_BY_KEY: Readonly<Record<LeadStageKey, LeadStage>> = Object.freeze(
  Object.fromEntries(LEAD_STAGES.map((s) => [s.key, s])) as Record<LeadStageKey, LeadStage>,
);

/** برچسب فارسی مرحله. */
export function stageLabel(key: LeadStageKey): string {
  return STAGE_BY_KEY[key].label;
}

/** گروه رنگی مرحله (برای chip و ستون‌ها). */
export function stageGroupOf(key: LeadStageKey): LeadStage["group"] {
  return STAGE_BY_KEY[key].group;
}

/** آیا مرحله باز است؟ */
export function isOpenStage(key: LeadStageKey): boolean {
  return STAGE_BY_KEY[key].open;
}

/** آیا مرحله ترمینال (lost) است؟ */
export function isLostStage(key: LeadStageKey): boolean {
  return key === "lost";
}

/** اعتبارسنجی کلید مرحله — برای Zod و سرویس‌ها. */
export function isLeadStageKey(value: unknown): value is LeadStageKey {
  return (
    typeof value === "string" &&
    (Object.keys(STAGE_BY_KEY) as string[]).includes(value)
  );
}

/**
 * مرحله‌هدف برای بازگرداندن یک سرنخ lost — قانون Demo:
 * `lostFrom` مگر اینکه pf باشد، که در آن حالت opp (app/leads.js:539).
 *
 * در اینجا تعریف می‌شود (نه در سرویس) تا بدون کشیدن Prisma در سمت
 * کلاینت هم قابل استفاده باشد.
 */
export function reviveTarget(lostFrom: LeadStageKey | null): LeadStageKey {
  return lostFrom && lostFrom !== "pf" ? lostFrom : "opp";
}
