/**
 * انواع تلفن حساب — PHASE_03 §۳.۱ (تلفن‌های چندگانه با نوع).
 *
 * Demo فهرست ثابت تلفن ندارد؛ این فهرست حداقلی فقط برای دسته‌بندی نمایشی
 * است و مقدار خالی («بدون نوع») هم مجاز است. این یک طبقه‌بندی UI است،
 * نه قانون کسب‌وکار (CLAUDE.md §۱۳).
 */
export const PHONE_KINDS = [
  { key: "mobile", label: "موبایل" },
  { key: "office", label: "دفتر" },
  { key: "factory", label: "کارخانه" },
  { key: "whatsapp", label: "واتساپ" },
  { key: "other", label: "سایر" },
] as const;

export type PhoneKindKey = (typeof PHONE_KINDS)[number]["key"];

/** برچسب فارسی نوع تلفن — کلید ناشناخته → خود کلید. */
export function phoneKindLabel(key: string | null | undefined): string {
  const found = PHONE_KINDS.find((k) => k.key === key);
  return found ? found.label : key ?? "";
}
