/**
 * ثابت‌های انبار — همه با ارجاع به Demo (CLAUDE.md §۱۳).
 *
 *  - ۹ نوع حرکت: KIND در Demo (app/stock.js:۱۴).
 *  - دو انبار: `raw` (مواد اولیه) و `depot` (محصول نهایی).
 *  - علامت qty بر اساس kind مطابق جمع جبری `onHand` (app/core.js:۲۰۶):
 *    ورودها مثبت، خروج‌ها منفی، `adj` دوطرفه (مقدار علامت‌دار از کلاینت).
 */

/** نوع انبار — `wh` در حرکت‌ها (app/stock.js:۱۶). */
export const WAREHOUSES = ["raw", "depot"] as const;
export type Warehouse = (typeof WAREHOUSES)[number];

export const WAREHOUSE_LABELS: Readonly<Record<Warehouse, string>> = {
  raw: "انبار مواد",
  depot: "دپو محصول",
};

/**
 * ۹ نوع حرکت — دقیقاً مطابق KIND در Demo (app/stock.js:۱۴).
 * ترتیب کلیدها preserved و در فیلتر UI به همین ترتیب نمایش داده می‌شود.
 */
export const MOVE_KINDS = [
  "open",
  "buy",
  "prod",
  "sale",
  "use",
  "out",
  "adj",
  "waste",
  "job",
] as const;

export type MoveKind = (typeof MOVE_KINDS)[number];

export const MOVE_KIND_LABELS: Readonly<Record<MoveKind, string>> = {
  open: "موجودی اول دوره",
  buy: "ورود خرید",
  prod: "ورود از تولید",
  sale: "تحویل به مشتری",
  use: "مصرف تولید",
  out: "خروج دستی",
  adj: "اصلاح شمارش",
  waste: "ضایعات",
  job: "تولید برای انبار",
};

/**
 * حرکت‌های قابل ثبت دستی توسط کاربر.
 *
 *  - outView دپو (app/stock.js:۵۳): out / adj− / adj+ / waste.
 *  - useView مواد (app/stock.js:۸۶): out / waste / adj / adj+.
 *  - `open` (موجودی اول دوره) فقط در لیست KIND دمو دیده می‌شود و جایی در
 *    app/ ساخته نمی‌شود؛ برای تسهیل راه‌اندازی، ثبت دستی آن مجاز است.
 *  - buy (رسید خرید) و prod (ورود از تولید) و sale (تحویل مشتری) و
 *    use (مصرف تولید) و job (ورود کار به دپو) سیستمی‌اند و فقط از طریق
 *    عملیات کسب‌کار (فاز ۴/۵/۶) ساخته می‌شوند.
 */
export const MANUAL_ENTRY_KINDS = ["open", "out", "adj", "waste"] as const;
export type ManualEntryKind = (typeof MANUAL_ENTRY_KINDS)[number];

/**
 * حرکت‌هایی که قابل ویرایش/حذف هستند — فقط حرکت‌های دستی (PHASE_05 §۸).
 * `waste` ثبت دستی است ولی در لیست ویرایش دمو نیست (app/stock.js:۵۳ فاقد
 * ویرایش است)؛ طبق §۸ فقط `open`/`out`/`adj` قابل ویرایش/حذف‌اند.
 */
export const EDITABLE_KINDS = ["open", "out", "adj"] as const;
export type EditableKind = (typeof EDITABLE_KINDS)[number];

/**
 * جهت پیش‌فرض علامت qty برای هر kind (مطابق جمع جبری core.js:۲۰۶).
 *  - `+1`: ورود (موجودی را زیاد می‌کند)
 *  - `−1`: خروج (موجودی را کم می‌کند)
 *  - `0`: مقدار علامت‌دار مستقیماً از کلاینت دریافت می‌شود (adj).
 */
export const SIGN_BY_KIND: Readonly<Record<MoveKind, 1 | -1 | 0>> = {
  open: 1,
  buy: 1,
  prod: 1,
  sale: -1,
  use: -1,
  out: -1,
  adj: 0,
  waste: -1,
  job: 1,
};
