/**
 * خط لوله مراحل سفارش و نگاشت گروه‌های معنایی (Q-09).
 *
 * منبع حقیقت ۱۱ مرحله: Demo `app/core.js` آرایه STAGES (ثبت‌شده در
 * docs/knowledge/VALIDATION_AND_BUSINESS_RULES.md).
 *
 * طبق Q-09 به جای ۱۱ رنگ، مراحل در ۴ گروه معنایی دسته‌بندی می‌شوند و
 * هر گروه دقیقاً به یک توکن رنگ معنایی متصل است:
 *   sales       → draft, smgr, send        → --color-stage-sales
 *   approval    → mgr, pay                 → --color-stage-approval
 *   production  → paccept, make, qc        → --color-stage-production
 *   fulfillment → daccept, prep, deliver   → --color-stage-fulfillment
 * حالت‌های پایانی (done/cancelled) جزو خط لوله نیستند و از توکن‌های
 * --color-success و --color-danger استفاده می‌کنند.
 */

export type OrderStageKey =
  | "draft"
  | "smgr"
  | "mgr"
  | "send"
  | "pay"
  | "paccept"
  | "make"
  | "qc"
  | "daccept"
  | "prep"
  | "deliver";

export type StageGroup = "sales" | "approval" | "production" | "fulfillment";

export type TerminalStage = "done" | "cancelled";

export type OrderStage = {
  key: OrderStageKey;
  /** برچسب فارسی مرحله — برابر با Demo. */
  label: string;
  /** گروه معنایی رنگ (Q-09). */
  group: StageGroup;
  /** شماره مرحله در خط لوله (۱..۱۱). */
  step: number;
  /** نقش مسئول اجرای این مرحله (Demo STAGES.who — core.js:156-168). */
  who: StageOwnerRole;
  /** مهلت انجام این مرحله به دقیقه (Demo STAGES.due — core.js:156-168). */
  dueMin: number;
  /** شرح اقدام مرحله (Demo STAGES.action — core.js:156-168). */
  action: string;
};

/** نقش‌های مسئول مراحل طبق STAGES.who در Demo (core.js:156-168). */
export type StageOwnerRole = "sales" | "salesManager" | "management" | "finance" | "production" | "depot";

export const ORDER_STAGES: readonly OrderStage[] = [
  { key: "draft", label: "ثبت پیش‌فاکتور", group: "sales", step: 1, who: "sales", dueMin: 240, action: "اقلام، قیمت و شرایط فروش ← ارسال برای مدیر فروش" },
  { key: "smgr", label: "بررسی مدیر فروش", group: "sales", step: 2, who: "salesManager", dueMin: 240, action: "بررسی قیمت و شرایط ← تأیید یا برگشت" },
  { key: "mgr", label: "تأیید مدیر", group: "approval", step: 3, who: "management", dueMin: 480, action: "تأیید نهایی پیش‌فاکتور" },
  { key: "send", label: "ارسال برای مشتری", group: "sales", step: 4, who: "sales", dueMin: 120, action: "ارسال لینک و PDF پیش‌فاکتور با پیامک، ایمیل یا پیام‌رسان" },
  { key: "pay", label: "تأیید مشتری و پرداخت", group: "approval", step: 5, who: "finance", dueMin: 2880, action: "ثبت تأیید مشتری، واریزها و چک‌ها ← قطعی کردن" },
  { key: "paccept", label: "قبول و زمان‌بندی تولید", group: "production", step: 6, who: "production", dueMin: 480, action: "قبول سفارش و تعیین تاریخ شروع و پایان تولید" },
  { key: "make", label: "تولید", group: "production", step: 7, who: "production", dueMin: 4320, action: "شروع تولید (کسر خودکار مواد اولیه) ← تولید شد" },
  { key: "qc", label: "کنترل کیفیت", group: "production", step: 8, who: "production", dueMin: 480, action: "ثبت مقدار سالم و ضایعات ← ارسال به انبار دپو" },
  { key: "daccept", label: "قبول در انبار دپو", group: "fulfillment", step: 9, who: "depot", dueMin: 480, action: "تحویل گرفتن و تطبیق با سند تولید، یا قبول سفارش از موجودی" },
  { key: "prep", label: "آماده‌سازی بار", group: "fulfillment", step: 10, who: "depot", dueMin: 1440, action: "جمع‌آوری و بسته‌بندی ← آماده شد" },
  { key: "deliver", label: "تحویل به مشتری", group: "fulfillment", step: 11, who: "depot", dueMin: 2880, action: "خروج بار و تأیید تحویل (کسر خودکار از انبار)" },
] as const;

export const STAGE_GROUP_LABELS: Readonly<Record<StageGroup, string>> = {
  sales: "فروش",
  approval: "تأیید",
  production: "تولید",
  fulfillment: "تحویل",
};

export const STAGE_GROUP_TOKENS: Readonly<Record<StageGroup, string>> = {
  sales: "var(--color-stage-sales)",
  approval: "var(--color-stage-approval)",
  production: "var(--color-stage-production)",
  fulfillment: "var(--color-stage-fulfillment)",
};

export const TERMINAL_STAGE_TOKENS: Readonly<Record<TerminalStage, string>> = {
  done: "var(--color-success)",
  cancelled: "var(--color-danger)",
};

const STAGE_BY_KEY: Readonly<Record<OrderStageKey, OrderStage>> = Object.freeze(
  Object.fromEntries(
    ORDER_STAGES.map((s): [OrderStageKey, OrderStage] => [s.key, s]),
  ) as Record<OrderStageKey, OrderStage>,
);

export function getStage(key: OrderStageKey): OrderStage {
  return STAGE_BY_KEY[key];
}

/** مرحله بر اساس شماره خط لوله (۱..۱۱) — undefined برای شماره نامعتبر. */
export function getStageByStep(step: number): OrderStage | undefined {
  return ORDER_STAGES.find((s) => s.step === step);
}

export function stageGroup(key: OrderStageKey): StageGroup {
  return STAGE_BY_KEY[key].group;
}

export function stageToken(key: OrderStageKey): string {
  return STAGE_GROUP_TOKENS[STAGE_BY_KEY[key].group];
}

/** نقش مسئول اجرای مرحله (core.js:156-168). */
export function stageWho(key: OrderStageKey): StageOwnerRole {
  return STAGE_BY_KEY[key].who;
}

/** مهلت انجام مرحله به میلی‌ثانیه (core.js:156-168 — دقیقه × ۶۰٬۰۰۰). */
export function stageDueMs(key: OrderStageKey): number {
  return STAGE_BY_KEY[key].dueMin * 60_000;
}

/** آخرین شماره مرحله خط لوله (۱۱). */
export const LAST_STAGE_STEP: number = ORDER_STAGES.length;
