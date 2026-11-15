/**
 * اسکیمای اعتبارسنجی تراکنش مالی — Zod با پیام فارسی (CD-28 / PHASE_06 §۶).
 *
 * قوانین (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - نوع تراکنش یکی از ۸ گزینه ثابت فهرست Demo است (app/fin.js:145) —
 *    هیچ نوع جدیدی اختراع نمی‌شود.
 *  - جهت از نوع استنتاج می‌شود (app/fin.js:147):
 *    `kind.indexOf("دریافت") === 0 ? 1 : -1` — یعنی client جهت را
 *    انتخاب نمی‌کند.
 *  - مبلغ عدد صحیح مثبت به ریال است (CD-13).
 *  - تاریخ تراکنش خالص `YYYY/MM/DD` با ارقام ASCII است (CD-06).
 *  - side: «دریافت متفرقه» = income، ۷ نوع «هزینه: …» = expense.
 */
import { z } from "zod";
import { idParamSchema, jalaliDateSchema, optionalTextSchema } from "@core/validation";
import { EXPENSE_KIND_LABELS } from "../constants";

/** مبلغ به ریال — عدد صحیح مثبت (CD-13). */
const amountInput = z
  .number({ message: "مبلغ تراکنش الزامی است." })
  .int({ message: "مبلغ تراکنش باید عدد صحیح باشد." })
  .positive({ message: "مبلغ تراکنش باید بیشتر از صفر باشد." })
  .max(Number.MAX_SAFE_INTEGER, { message: "مبلغ تراکنش بسیار بزرگ است." });

/**
 * ثبت تراکنش — POST /api/txns (PHASE_06 §۶).
 *
 * `kind` برچسب انتخابی است (یکی از ۸ گزینه) و در سرویس به کلید
 * ذخیره‌شده تبدیل می‌شود (app/fin.js:147). جهت در سرویس از kind
 * استنتاج می‌شود و از سوی کاربر پذیرفته نمی‌شود.
 */
export const createTxnSchema = z.object({
  kind: z.enum(EXPENSE_KIND_LABELS, {
    message: "نوع تراکنش باید یکی از گزینه‌های ثابت فهرست باشد.",
  }),
  amount: amountInput,
  at: jalaliDateSchema,
  who: optionalTextSchema(100),
  note: optionalTextSchema(500),
});

export type CreateTxnInput = z.infer<typeof createTxnSchema>;

/**
 * پارامترهای query لیست تراکنش‌ها — GET /api/txns.
 *
 * `kind` با کلید ذخیره‌شده (مثلاً «هزینه — اجاره») فیلتر می‌کند؛
 * `direction` با expense/income فیلتر می‌کند.
 */
export const txnListQuerySchema = z.object({
  kind: z
    .string({ message: "نوع تراکنش نامعتبر است." })
    .trim()
    .max(64, { message: "نوع تراکنش بسیار طولانی است." })
    .optional(),
  direction: z
    .enum(["expense", "income"], { message: "جهت تراکنش نامعتبر است." })
    .optional(),
  page: z.coerce.number().int().positive({ message: "صفحه نامعتبر است." }).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive({ message: "اندازه صفحه نامعتبر است." })
    .max(200, { message: "اندازه صفحه نمی‌تواند بیشتر از ۲۰۰ باشد." })
    .default(50),
});

export type TxnListQuery = z.infer<typeof txnListQuerySchema>;

/**
 * پارامترهای query گزارش جریان نقدی — GET /api/finance/cashflow.
 *
 * `month` اختیاری با قالب `YYYY/MM` و ارقام ASCII (CD-06). در صورت عدم
 * ارائه، همه ماه‌ها برمی‌گردند.
 */
export const cashflowQuerySchema = z.object({
  month: z
    .string()
    .trim()
    .regex(/^(\d{4})\/(0?[1-9]|1[012])$/, {
      message: "ماه باید با قالب YYYY/MM و ارقام ASCII باشد.",
    })
    .optional(),
});

export type CashflowQuery = z.infer<typeof cashflowQuerySchema>;

/** پارامتر `id` مسیر. */
export const txnIdParamSchema = idParamSchema;
