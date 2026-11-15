/**
 * ماژول تنظیمات — دسترسی فقط‌خواندنی به تنظیمات سراسری (PHASE_02 §۶).
 *
 * ویرایش تنظیمات در فاز بعدی پیاده می‌شود (admin.settings).
 */
export { getSettings, DEFAULT_SETTINGS } from "./services/settings.service";
export type { CompanyInfo, DiscountCapMap, Settings } from "./services/settings.service";
