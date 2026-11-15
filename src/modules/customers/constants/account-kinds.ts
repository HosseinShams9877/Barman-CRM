/**
 * انواع حساب — PHASE_03 §۶ (`kind` در جدول `accounts`).
 *
 * Demo فهرست ثابتی برای `kind` ندارد؛ سرنخ بدون حساب شناخته‌شده با
 * `kind = "unknown"` و بدون نام ذخیره می‌شود (app/lead-core.js:۵۷).
 * سه نوع دیگر برای دسته‌بندی نمایشی تعریف شده‌اند — این یک طبقه‌بندی
 * UI است، نه قانون کسب‌وکار (CLAUDE.md §۱۳).
 */
export const ACCOUNT_KINDS = [
  { key: "customer", label: "مشتری" },
  { key: "supplier", label: "تأمین‌کننده" },
  { key: "partner", label: "شریک" },
  { key: "unknown", label: "ناشناخته" },
] as const;

export type AccountKindKey = (typeof ACCOUNT_KINDS)[number]["key"];

/** برچسب فارسی نوع حساب — کلید ناشناخته → خود کلید. */
export function accountKindLabel(key: string | null | undefined): string {
  const found = ACCOUNT_KINDS.find((k) => k.key === key);
  return found ? found.label : key ?? "";
}

/**
 * آیا نوع به نام حساب نیاز دارد؟
 * قانون Demo: فقط `unknown` بدون نام مجاز است (lead-core.js:۵۷).
 */
export function kindRequiresName(kind: string): boolean {
  return kind !== "unknown";
}
