/**
 * اسکیمای ورود گروهی سرنخ‌ها — PHASE_03 §۷ (POST /api/leads/import).
 *
 * در Demo ورود گروهی فقط فهرست شماره‌ها + یک منبع ثابت بود
 * (app/leads.js:338-357). در فاز ۳ ورودی CSV است تا هر ردیف می‌تواند
 * منبع/خط/یادداشت خود را داشته باشد — این یک توسعه فاز ۳ است (R-30).
 *
 * ستون‌های شناسایی‌شده در سرتیتر (به‌ترتیب اهمیت، case-insensitive):
 *   phone (اجباری)، source (اجباری)، line، title، note
 *
 * پاسخ شامل گزارش ردیف‌به‌ردیف با پیام فارسی است (A-3.x / درگاه خروج ۴).
 */
import { z } from "zod";
import { leadLineSchema } from "./lead.schema";

export const importLeadsSchema = z.object({
  /** متن خام CSV — سرتیتر در خط اول. */
  csv: z.string().min(1).max(512 * 1024),
  /** خط پیش‌فرض ردیف‌هایی که ستون line ندارند. */
  line: leadLineSchema.default("prod"),
  /**
   * کارشناس مسئول پیش‌فرض — فقط با مجوز leads.assign می‌توان کارشناسی
   * غیر از خود کاربر را ثبت کرد (بررسی در Route Handler).
   */
  ownerId: z.string().trim().min(1).max(64).optional(),
});

/** نتیجه یک ردیف CSV. */
export type ImportRowResult = {
  /** شماره خط در فایل CSV (بدون احتساب سرتیتر). */
  row: number;
  phone: string;
  ok: boolean;
  error?: string;
};

/** نتیجه کل عملیات ورود گروهی. */
export type ImportResult = {
  created: number;
  failed: number;
  rows: ImportRowResult[];
};
