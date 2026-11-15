/**
 * اسکیماهای Zod کاتالوگ محصول/ماده/فرمول — PHASE_07 §۵.
 *
 * قوانین کسب‌وکار (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - کد محصول/ماده اجباری، uppercase و یکتا است (admin.js:41-43، admin.js:61-62).
 *  - قیمت محصول باید مثبت باشد (admin.js:42: `!(price > 0)` → رد).
 *  - قیمت ماده می‌تواند صفر باشد (admin.js:64 — فقط کد و نام اجباری است).
 *  - رنگ‌ها با ویرگول جدا می‌شوند و موارد خالی حذف می‌شوند (admin.js:46).
 *  - زمان تولید پیش‌فرض ۲ روز است (admin.js:38/47).
 *  - محصول `agency` می‌تواند تأمین‌کننده داشته باشد (admin.js:39).
 *
 * پیام‌های فارسی با faErrorMap (CD-40 — ادامه CD-28).
 */
import { z } from "zod";
import { moneySchema, positiveIntSchema } from "@core/validation";
import { MATERIAL_UNITS, PRODUCT_LINES, PRODUCT_UNITS } from "../constants/units";

/** کد محصول — uppercase در Demo (admin.js:41: `X.toEn(...).toUpperCase()`). */
export const productCodeSchema = z
  .string()
  .trim()
  .min(1, "کد محصول را وارد کنید.")
  .max(32)
  .transform((c) => c.toUpperCase());

/** کد ماده اولیه — همان قانون (admin.js:61). */
export const materialCodeSchema = productCodeSchema;

/** فهرست رنگ‌ها — هر مورد با ویرگول فارسی/انگلیسی جدا (admin.js:46). */
export const colorsInputSchema = z
  .string()
  .max(512)
  .default("")
  .transform((s) =>
    s
      .split(/[،,]/)
      .map((x) => x.trim())
      .filter(Boolean),
  );

/** ایجاد/ویرایش محصول — فیلدهای دقیق دیالوگ Demo (admin.js:31-48). */
export const productSaveSchema = z.object({
  code: productCodeSchema,
  name: z.string().trim().min(1, "نام محصول را وارد کنید.").max(192),
  line: z.enum(PRODUCT_LINES),
  category: z.string().trim().max(96).default(""),
  unit: z.enum(PRODUCT_UNITS),
  price: positiveIntSchema.max(Number.MAX_SAFE_INTEGER, "قیمت باید عدد مثبتی باشد."),
  colors: colorsInputSchema,
  days: z.number().int().nonnegative().max(365).default(2),
  supplierId: z.string().min(1).max(64).nullable().optional(),
  active: z.boolean().default(true),
});

export type ProductSaveInput = z.infer<typeof productSaveSchema>;

/** ایجاد/ویرایش ماده اولیه — فیلدهای دیالوگ Demo (admin.js:58-65). */
export const materialSaveSchema = z.object({
  code: materialCodeSchema,
  name: z.string().trim().min(1, "نام ماده را وارد کنید.").max(192),
  unit: z.enum(MATERIAL_UNITS),
  price: moneySchema.max(Number.MAX_SAFE_INTEGER),
  min: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0),
});

export type MaterialSaveInput = z.infer<typeof materialSaveSchema>;

/**
 * ذخیره فرمول تولید (BOM) — PUT کامل (admin.js:171-178).
 *
 * ردیف‌های با مقدار صفر/منفی در Demo قبل از ذخیره فیلتر می‌شوند
 * (admin.js:173: `.filter((x) => x.q > 0)`)؛ اینجا رد می‌شوند چون
 * کلاینت باید مقادیر معتبر بفرستد (اعتبارسنجی دوگانه R-13).
 */
export const bomSaveSchema = z.object({
  items: z
    .array(
      z.object({
        materialId: z.string().min(1).max(64),
        qty: z.number().positive("مقدار مصرف باید بزرگتر از صفر باشد."),
      }),
    )
    .max(64),
});

export type BomSaveInput = z.infer<typeof bomSaveSchema>;
