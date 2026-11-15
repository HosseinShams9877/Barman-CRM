/**
 * اسکیماهای مشترک Zod — استفاده مجدد بین Route Handlerها و فرم‌های کلاینت
 * (BACKEND_AND_API_ARCHITECTURE §۲.۳ اصل ۲ — اعتبارسنجی دوگانه).
 *
 * قانون R-13: در Demo اعتبارسنجی سرور وجود نداشت. اینجا همه ورودی‌ها
 * در سرور با Zod اعتبارسنجی می‌شوند — هیچ استثنایی نیست.
 */
import { z } from "zod";
import { parseJalali } from "../calendar/parse";
import { JALALI_MAX_YEAR, JALALI_MIN_YEAR } from "../calendar/constants";

/** شناسه رکورد — cuid (پرازا). */
export const idParamSchema = z.object({
  id: z.string().min(1).max(64),
});

/** تاریخ خالص شمسی قرارداد `YYYY/MM/DD` با ارقام ASCII (CD-06). */
export const jalaliDateSchema = z
  .string()
  .min(1)
  .refine(
    (v) => {
      const d = parseJalali(v);
      return d !== null && d.jy >= JALALI_MIN_YEAR && d.jy <= JALALI_MAX_YEAR;
    },
    { message: "تاریخ شمسی معتبر نیست (مثال: ۱۴۰۵/۰۸/۱۹)." },
  );

/** عدد صحیح نامنفی. */
export const nonNegativeIntSchema = z.number().int().nonnegative();

/** مبلغ به ریال — عدد صحیح نامنفی (گردسازی R-08 در لایه service انجام می‌شود). */
export const moneySchema = nonNegativeIntSchema.max(Number.MAX_SAFE_INTEGER);

/** عدد مطلقاً مثبت. */
export const positiveIntSchema = z.number().int().positive();

/** پارامترهای صفحه‌بندی — پیش‌فرض امن. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});

/** متن اختیاری کوتاه. */
export const optionalTextSchema = (max: number) => z.string().trim().max(max).optional();

/** متن اجباری کوتاه. */
export const requiredTextSchema = (max: number) => z.string().trim().min(1).max(max);

/** شماره تلفن — ارقام، فاصله، خط تیره، پرانتز، +. */
export const phoneSchema = z
  .string()
  .trim()
  .max(32)
  .optional()
  .refine((v) => !v || /^[+()\d\s-]+$/.test(v), {
    message: "شماره تلفن معتبر نیست.",
  });
