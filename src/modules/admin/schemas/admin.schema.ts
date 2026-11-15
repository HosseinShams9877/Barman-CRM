/**
 * اسکیماهای Zod مدیریت کاربران، فهرست‌ها و تنظیمات — PHASE_07 §۵.
 *
 * قوانین کسب‌وکار (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - نام کاربر اجباری و یکتا است (admin.js:125).
 *  - هر کاربر دقیقاً **یک** نقش دارد (admin.js:124 — select تک‌انتخابی؛
 *    با وجود پیوند چندبه‌چند در طرح داده، فرم مدیریت یک نقش تنظیم می‌کند).
 *  - غیرفعال‌سازی کاربر او را حذف نمی‌کند تا تاریخچه معتبر بماند
 *    (admin.js:127 — `off`، PHASE_07 §۱).
 *  - `validDays` صفر در Demo به ۳ تبدیل می‌شود (admin.js:177).
 *  - سقف تخفیف فقط برای سه نقش sales/salesManager/management در فرم
 *    تنظیم می‌شود (admin.js:145).
 *
 * رمز عبور اولیه: Demo ورود با انتخاب نقش است و رمز ندارد؛ پلتفرم
 * هدف (CD-17) ورود با رمز است، پس ایجاد کاربر نیازمند رمز اولیه است
 * (در ویرایش اختیاری — خالی یعنی بدون تغییر).
 */
import { z } from "zod";
import { ROLES } from "@core/permissions";
import { LIST_KEYS } from "../constants/lists";

const roleKeySchema = z.enum(ROLES as unknown as readonly [string, ...string[]]);

/** ایجاد کاربر — نام، نقش، سمت، وضعیت و رمز اولیه. */
export const userCreateSchema = z.object({
  name: z.string().trim().min(1, "نام کاربر را وارد کنید.").max(96),
  role: roleKeySchema,
  title: z.string().trim().max(96).default(""),
  off: z.boolean().default(false),
  password: z.string().min(6, "رمز حداقل ۶ نویسه است.").max(128),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;

/** ویرایش کاربر — همه فیلدها اختیاری؛ رمز خالی یعنی بدون تغییر. */
export const userUpdateSchema = z.object({
  name: z.string().trim().min(1, "نام کاربر را وارد کنید.").max(96).optional(),
  role: roleKeySchema.optional(),
  title: z.string().trim().max(96).optional(),
  off: z.boolean().optional(),
  password: z.string().min(6, "رمز حداقل ۶ نویسه است.").max(128).optional(),
});

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

/** ذخیره ۷ فهرست — کلیدها دقیقاً مطابق admin.js:174. */
export const listsSaveSchema = z.object({
  lists: z.record(
    z.enum(LIST_KEYS as unknown as readonly [string, ...string[]]),
    z.array(z.string().trim().max(96)).max(256),
  ),
});

export type ListsSaveInput = z.infer<typeof listsSaveSchema>;

/** اطلاعات شرکت — فیلدهای admin.js:143. */
const companySchema = z.object({
  name: z.string().trim().max(96).default(""),
  en: z.string().trim().max(96).default(""),
  tagline: z.string().trim().max(192).default(""),
  phone: z.string().trim().max(32).default(""),
  address: z.string().trim().max(256).default(""),
  bale: z.string().trim().max(96).default(""),
});

/** سقف تخفیف سه نقش — admin.js:145 (فقط این سه نقش در فرم هستند). */
const discountCapSchema = z.object({
  sales: z.number().int().nonnegative().max(100).optional(),
  salesManager: z.number().int().nonnegative().max(100).optional(),
  management: z.number().int().nonnegative().max(100).optional(),
});

/**
 * ذخیره تنظیمات — `validDays` صفر به ۳ تبدیل می‌شود (admin.js:177).
 * `vat` درصد بین ۰ و ۱۰۰ است.
 */
export const settingsSaveSchema = z
  .object({
    vat: z.number().int().min(0, "مالیات بین ۰ و ۱۰۰ درصد است.").max(100),
    validDays: z.number().int().nonnegative().max(365),
    company: companySchema,
    discountCap: discountCapSchema.optional(),
  })
  .transform((s) => ({ ...s, validDays: s.validDays === 0 ? 3 : s.validDays }));

export type SettingsSaveInput = z.infer<typeof settingsSaveSchema>;

/** ایجاد/ویرایش تأمین‌کننده — فیلدهای دیالوگ Demo (admin.js:107-113). */
export const supplierSaveSchema = z.object({
  name: z.string().trim().min(1, "نام تأمین‌کننده را وارد کنید.").max(192),
  kind: z.enum(["raw", "agency"]),
  phone: z.string().trim().max(32).default(""),
  terms: z.string().trim().max(192).default(""),
});

export type SupplierSaveInput = z.infer<typeof supplierSaveSchema>;
