/**
 * ثابت‌های کسب‌وکار سفارش — همه با ارجاع به Demo (CLAUDE.md §۱۳).
 *
 *  - PRESETS / GAPS / rnd / genPlan — app/order.js:109-132
 *  - KIND (نوع پرداخت) — app/core.js:242
 *  - BANKS — app/core.js:770 (۱۸ بانک)
 *  - دلایل برگشت پیش‌فاکتور — app/order.js:326
 *  - چک‌لیست کنترل کیفیت — app/order.js:520
 *  - چک‌لیست آماده‌سازی بار — app/order.js:562
 *  - نحوه توافق مشتری — app/order.js:391
 *  - طول شماره صیادی — app/order.js:622
 */

/** نوع برنامه پرداخت — KIND در Demo (core.js:242). */
export const PAYMENT_KIND_LABELS: Readonly<Record<string, string>> = {
  cash: "نقد / واریز",
  cheque: "چک صیادی",
  credit: "اعتباری (بعداً)",
};

/** کلیدهای معتبر نوع قلم برنامه پرداخت (genPlan — order.js:118-132). */
export const PLAN_KINDS = ["cash", "cheque", "credit"] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

/** نوع رسید پرداخت ثبت‌شده — core.js:242 + rcInit (order.js:359). */
export const RECEIPT_KINDS = ["cash", "card"] as const;
export type ReceiptKind = (typeof RECEIPT_KINDS)[number];

/** وضعیت چک — چرخه hand → bank → clear / bounce (Demo fin). */
export const CHEQUE_STATUSES = ["hand", "bank", "clear", "bounce"] as const;
export type ChequeStatus = (typeof CHEQUE_STATUSES)[number];

export const CHEQUE_STATUS_LABELS: Readonly<Record<ChequeStatus, string>> = {
  hand: "نزد ما",
  bank: "در بانک",
  clear: "وصول‌شده",
  bounce: "برگشتی",
};

/** طول مجاز شماره صیادی (order.js:622). */
export const SAYAD_LENGTH = 16;

/** فاصله سررسید چک‌ها — GAPS در Demo (order.js:115). */
export const PLAN_GAPS = [
  { key: "15d", label: "۱۵ روز" },
  { key: "1m", label: "۱ ماه" },
  { key: "2m", label: "۲ ماه" },
  { key: "3m", label: "۳ ماه" },
] as const;

export type PlanGap = (typeof PLAN_GAPS)[number]["key"];

/** شروع سررسید چک‌ها نسبت به امروز — GAPS شبیه Demo (order.js:115). */
export const PLAN_FIRST = [
  { key: "1m", label: "۱ ماه" },
  { key: "2m", label: "۲ ماه" },
  { key: "3m", label: "۳ ماه" },
] as const;

export type PlanFirst = (typeof PLAN_FIRST)[number]["key"];

/**
 * پیش‌تنظیم‌های برنامه پرداخت — PRESETS در Demo (order.js:109-114).
 * `pre` درصد پیش‌پرداخت، `rest` نوع تسویه باقی‌مانده، `n` تعداد چک،
 * `gap` فاصله سررسیدها، `first` شروع سررسید.
 */
export type PaymentPreset = {
  key: string;
  label: string;
  pre: number;
  rest: PlanKind;
  n: number;
  gap: PlanGap;
  first: PlanFirst;
};

export const PAYMENT_PRESETS: readonly PaymentPreset[] = [
  { key: "full", label: "نقد کامل", pre: 100, rest: "cheque", n: 1, gap: "1m", first: "1m" },
  { key: "half", label: "نصف نقد، نصف چک", pre: 50, rest: "cheque", n: 1, gap: "1m", first: "1m" },
  { key: "3chq", label: "پیش‌پرداخت + ۳ چک", pre: 30, rest: "cheque", n: 3, gap: "1m", first: "1m" },
  { key: "deliv", label: "نصف الان، نصف تحویل", pre: 50, rest: "credit", n: 1, gap: "1m", first: "1m" },
] as const;

/** برچسب پیش‌تنظیم با کلید — برای پاسخ API. */
export function presetLabel(key: string): string {
  return PAYMENT_PRESETS.find((p) => p.key === key)?.label ?? "";
}

/** دلایل برگشت پیش‌فاکتور — RV.REASONS در Demo (order.js:326). */
export const BACK_REASONS = [
  "قیمت کمتر از فهرست",
  "تخفیف زیاد است",
  "شرایط پرداخت مناسب نیست",
  "اقلام یا مقدار اشتباه است",
  "مشتری یا مخاطب اشتباه است",
] as const;

/** چک‌لیست کنترل کیفیت — QC.CHECKS در Demo (order.js:520). */
export const QC_CHECKS = [
  "ابعاد و ضخامت",
  "یکنواختی رنگ",
  "سطح بدون ترک و حباب",
  "استحکام و وزن",
] as const;

/** چک‌لیست آماده‌سازی بار — PREP.CHECKS در Demo (order.js:562) — همه باید تیک بخورند. */
export const PREP_CHECKS = [
  "اقلام شمرده و با سفارش تطبیق داده شد",
  "رنگ و کد محصول درست است",
  "بسته‌بندی و برچسب‌گذاری انجام شد",
] as const;

/** نحوه توافق مشتری — AGREED_HOW در Demo (order.js:391) — در قطعی‌سازی اجباری است. */
export const AGREED_HOW = [
  { key: "call", label: "تلفنی / گفتگو" },
  { key: "pay", label: "واریز کرد" },
  { key: "chq", label: "چک داد" },
  { key: "visit", label: "حضوری" },
] as const;

export type AgreedHowKey = (typeof AGREED_HOW)[number]["key"];

/** کانال‌های ارسال پیش‌فاکتور — data-sendnow (order.js:708). */
export const SEND_VIAS = ["sms", "email", "chat"] as const;
export type SendVia = (typeof SEND_VIAS)[number];

export const SEND_VIA_LABELS: Readonly<Record<SendVia, string>> = {
  sms: "پیامک",
  email: "ایمیل",
  chat: "پیام‌رسان",
};

/** وضعیت سفارش — Q-11 (جمع‌بندی دو پرچم closed/cancelled Demo). */
export const ORDER_STATUSES = ["open", "done", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  open: "در جریان",
  done: "تسویه و بسته‌شده",
  cancelled: "لغو‌شده",
};
