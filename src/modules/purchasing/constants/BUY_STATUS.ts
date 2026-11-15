/**
 * وضعیت‌های خرید — PHASE_06 §۶.
 *
 * چرخه یک‌طرفه: `req → ok → fin → recv`.
 *
 * نگاشت به Demo (app/fin-core.js:9-17 — ST):
 *   req  ≈ ST.req  «درخواست کمبود (از تولید)» — فقط در این وضعیت ویرایش می‌شود.
 *   ok   ≈ مرحله تأیید مدیر (PHASE_06 §۶ وضعیت جدید — Demo بین این دو حالت
 *          پیش‌نویس/req داشت؛ نقشه راه چرخه ۴ وضعیتی را تعریف کرده است).
 *   fin  ≈ ST.fin  «منتظر پرداخت مالی» — چک‌ها صادر و ثبت می‌شوند.
 *   recv ≈ ST.done «وارد انبار شد» — حرکت‌های ورود `buy` ساخته می‌شوند.
 *
 * انتقال غیرمجاز (مثلاً req → recv) در سرور رد می‌شود (PHASE_06 §۸).
 */

export const BUY_STATUSES = ["req", "ok", "fin", "recv"] as const;

export type BuyStatus = (typeof BUY_STATUSES)[number];

/** برچسب فارسی وضعیت‌ها — برای نمایش در UI. */
export const BUY_STATUS_LABELS: Readonly<Record<BuyStatus, string>> = {
  req: "درخواست خرید",
  ok: "تأیید شد",
  fin: "منتظر پرداخت مالی",
  recv: "وارد انبار شد",
};

/** نشانگر رنگی وضعیت (معادل color در Demo ST) — فقط display. */
export const BUY_STATUS_TONE: Readonly<Record<BuyStatus, "info" | "success" | "warning" | "neutral">> = {
  req: "neutral",
  ok: "info",
  fin: "warning",
  recv: "success",
};

/** ترتیب جریان — اندیس وضعیت در مسیر اصلی. */
export const BUY_STATUS_FLOW: readonly BuyStatus[] = BUY_STATUSES;

/** وضعیت بعدی در مسیر اصلی — null برای وضعیت پایانی. */
export const BUY_NEXT_STATUS: Readonly<Record<BuyStatus, BuyStatus | null>> = {
  req: "ok",
  ok: "fin",
  fin: "recv",
  recv: null,
};

/**
 * آیا انتقال from → to مجاز است؟ — فقط یک گام به جلو در مسیر اصلی.
 * (PHASE_06 §۸: انتقال غیرمجاز در سرور رد می‌شود.)
 */
export function isLegalTransition(from: BuyStatus, to: BuyStatus): boolean {
  return BUY_NEXT_STATUS[from] === to;
}

/**
 * آیا خرید در وضعیت req قابل ویرایش است؟
 * (PHASE_06 §۷: PATCH فقط در وضعیت req مجاز است.)
 */
export function isEditableStatus(status: BuyStatus): boolean {
  return status === "req";
}

// --- چک خرید ---------------------------------------------------------------

export const CHEQUE_STATUSES = ["issued", "paid"] as const;

export type ChequeStatus = (typeof CHEQUE_STATUSES)[number];

/**
 * برچسب فارسی وضعیت چک — منبع: CST در Demo (app/fin.js:54):
 *   issued: «صادر شده»، paid: «پاس شد».
 */
export const CHEQUE_STATUS_LABELS: Readonly<Record<ChequeStatus, string>> = {
  issued: "صادر شده",
  paid: "پاس شد",
};

/** نشانگر رنگی وضعیت چک — فقط display. */
export const CHEQUE_STATUS_TONE: Readonly<Record<ChequeStatus, "warning" | "success">> = {
  issued: "warning",
  paid: "success",
};
