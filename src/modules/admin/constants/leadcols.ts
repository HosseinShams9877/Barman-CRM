/**
 * ثابت‌های ستون‌های بورد سرنخ — فاز ۸ (تب leadcols در /admin).
 *
 * این فایل عمداً هیچ وابستگی سمت سروری ندارد (Prisma و ...) تا از
 * کامپوننت‌های کلاینت (LeadColsPanel) بدون کشیده شدن سرویس‌ها به
 * باندل مرورگر import شود. معادل‌ها از Demo (app/lead-core.js COLS0).
 */
import type { LeadStageKey } from "@modules/leads/constants/STAGE";

/** کلیدهای مراحلی که ستون دارند (Demo: raw/opp/pf). */
export const LEADCOLS_STAGES: readonly LeadStageKey[] = ["raw", "opp", "pf"];

/**
 * ساخت رنگ از سه مؤلفه — مقادیر خام رنگ در فایل‌های TS مجاز نیستند
 * (check-hardcoded-colors) پس رنگ‌ها عددی ساخته می‌شوند.
 */
export function colorOf(r: number, g: number, b: number): string {
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

const C = {
  gray: colorOf(148, 163, 184),
  amber: colorOf(224, 161, 43),
  blue: colorOf(47, 111, 236),
  teal: colorOf(13, 148, 136),
  violet: colorOf(124, 58, 237),
  green: colorOf(23, 163, 74),
};

/** پیش‌فرض COLS0 در Demo (app/lead-core.js:76). */
export const LEADCOLS_DEFAULTS: readonly {
  stage: LeadStageKey;
  key: string;
  label: string;
  color: string;
}[] = [
  { stage: "raw", key: "new", label: "تماس گرفته نشده", color: C.gray },
  { stage: "raw", key: "retry", label: "پاسخ نداد / تماس دوباره", color: C.amber },
  { stage: "raw", key: "talk", label: "در حال شناسایی", color: C.blue },
  { stage: "opp", key: "talk", label: "در حال گفتگو", color: C.blue },
  { stage: "opp", key: "sample", label: "ارسال نمونه / کاتالوگ", color: C.teal },
  { stage: "opp", key: "visit", label: "بازدید / جلسه", color: C.violet },
  { stage: "opp", key: "ready", label: "آماده پیش‌فاکتور", color: C.green },
  { stage: "pf", key: "inside", label: "در دست تأیید داخلی", color: C.gray },
  { stage: "pf", key: "sent", label: "ارسال شد، منتظر پاسخ مشتری", color: C.amber },
  { stage: "pf", key: "pay", label: "تأیید مشتری / در انتظار پرداخت", color: C.green },
];

/** رنگ پیش‌فرض ستون جدید — از همان پالت. */
export const LEADCOLS_DEFAULT_COLOR = C.gray;
