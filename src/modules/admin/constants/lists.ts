/**
 * ۷ فهرست ثابت کسب‌کار — منبع: app/admin.js:131 (LNAMES) + meta.lists.
 *
 * هر فهرست مجموعه‌ای از مقدارهای فارسی است (هر مورد در یک خط) که در
 * جای‌جای برنامه استفاده می‌شود: منبع ورود سرنخ، سمت مخاطب‌ها، دلیل
 * از دست رفتن و غیره. کلیدها دقیقاً مطابق Demo هستند.
 */
export const LIST_KEYS = [
  "sources",
  "roles",
  "results",
  "lost",
  "projects",
  "channels",
  "waste",
] as const;

export type ListKey = (typeof LIST_KEYS)[number];

/** برچسب فارسی هر فهرست — منبع: app/admin.js:131. */
export const LIST_LABELS: Readonly<Record<ListKey, string>> = {
  sources: "منبع ورود سرنخ (برای گزارش)",
  roles: "سمت مخاطب‌ها",
  results: "نتیجه تماس / پیگیری",
  lost: "دلیل از دست رفتن",
  projects: "نوع پروژه",
  channels: "راه‌های ارسال پیش‌فاکتور",
  waste: "علت ضایعات تولید",
};

/** تقسیم متن textarea به فهرست — منبع: admin.js:174 (split/trim/filter). */
export function linesToList(text: string): string[] {
  return text
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}
