/**
 * انواع تراکنش مالی — ۸ گزینه ثابت Demo (PHASE_06 §۶).
 *
 * منبع دقیق: فهرست انتخاب در دیالوگ ثبت هزینه/دریافت متفرقه
 * (app/fin.js:145):
 *
 *   «هزینه: حقوق پرسنل»
 *   «هزینه: اجاره»
 *   «هزینه: آب، برق، گاز و تلفن»
 *   «هزینه: حمل و بارگیری»
 *   «هزینه: تبلیغات»
 *   «هزینه: تعمیرات و ابزار»
 *   «هزینه: سایر»
 *   «دریافت متفرقه»
 *
 * یعنی ۷ نوع هزینه + ۱ نوع دریافت = ۸ گزینه. هیچ نوع جدیدی اختراع نمی‌شود
 * (CLAUDE.md §۱۳).
 *
 * جهت تراکنش از کلید استنتاج می‌شود (app/fin.js:147):
 *   dir = kind.indexOf("دریافت") === 0 ? 1 : -1
 *
 * کلید ذخیره‌شده در پایگاه داده (app/fin.js:147):
 *   stored = label.replace("هزینه: ", "هزینه — ")
 */

/** برچسب قابل انتخاب — دقیقاً مطابق فهرست Demo (app/fin.js:145). */
export const EXPENSE_KIND_LABELS = [
  "هزینه: حقوق پرسنل",
  "هزینه: اجاره",
  "هزینه: آب، برق، گاز و تلفن",
  "هزینه: حمل و بارگیری",
  "هزینه: تبلیغات",
  "هزینه: تعمیرات و ابزار",
  "هزینه: سایر",
  "دریافت متفرقه",
] as const;

export type ExpenseKindLabel = (typeof EXPENSE_KIND_LABELS)[number];

/**
 * کلید ذخیره‌شده در پایگاه داده — Demo «هزینه: » را با «هزینه — »
 * جایگزین می‌کند (app/fin.js:147).
 */
export const STORED_KIND_PREFIX_FROM = "هزینه: ";
export const STORED_KIND_PREFIX_TO = "هزینه — ";

/** تبدیل برچسب انتخابی → کلید ذخیره‌شده (app/fin.js:147). */
export function toStoredKind(label: string): string {
  return label.replace(STORED_KIND_PREFIX_FROM, STORED_KIND_PREFIX_TO);
}

/** تبدیل کلید ذخیره‌شده → برچسب نمایشی. */
export function toDisplayKind(stored: string): string {
  return stored.replace(STORED_KIND_PREFIX_TO, STORED_KIND_PREFIX_FROM);
}

/** جهت تراکنش — شروع با «دریافت» = income، در غیر این صورت expense (app/fin.js:147). */
export type TxnDirection = "expense" | "income";

/** جهت عددی Demo: +1 = دریافت، −1 = پرداخت. */
export function directionOfKind(storedKind: string): TxnDirection {
  return storedKind.indexOf("دریافت") === 0 ? "income" : "expense";
}

/** معادل عددی جهت (Demo `dir`) — برای محاسبه جریان نقدی. */
export function directionSign(direction: TxnDirection): 1 | -1 {
  return direction === "income" ? 1 : -1;
}

/** فهرست کلیدهای ذخیره‌شده — برای اعتبارسنجی Zod. */
export const TXN_STORED_KINDS: readonly string[] = EXPENSE_KIND_LABELS.map(toStoredKind);
