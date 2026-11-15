/**
 * اسکیمای اعتبارسنجی خرید — Zod با پیام فارسی (CD-28 / PHASE_06 §۶).
 *
 * قوانین (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - حداقل یک قلم لازم است (app/buy.js:۱۳۸ — فرم خرید بدون قلم معنی ندارد).
 *  - جمع اقلام باید با مبلغ خرید برابر باشد (app/buy.js:۱۳۸:
 *    «جمع برنامه پرداخت با جمع خرید برابر نیست» — همان مفهوم).
 *  - مبلغ price به ریال و عدد صحیح است (CD-13 — بدون اعشار).
 *  - ویرایش فقط در وضعیت req مجاز است (PHASE_06 §۷) — محدودیت
 *    وضعیت در سرویس بررسی می‌شود.
 */
import { z } from "zod";
import { idParamSchema, optionalTextSchema } from "@core/validation";
import { BUY_STATUSES, CHEQUE_STATUSES } from "../constants";
import { createBuyChequeSchema } from "./buy-cheque.schema";

/** مبلغ به ریال — عدد صحیح مثبت (CD-13). */
const priceInput = z
  .number({ message: "قیمت واحد الزامی است." })
  .int({ message: "قیمت واحد باید عدد صحیح باشد." })
  .positive({ message: "قیمت واحد باید بیشتر از صفر باشد." })
  .max(Number.MAX_SAFE_INTEGER, { message: "قیمت واحد بسیار بزرگ است." });

/** مقدار خرید — مثبت، با تلورانس گردسازی مواد (کیلو/مترمربع). */
const qtyInput = z
  .number({ message: "مقدار الزامی است." })
  .positive({ message: "مقدار باید بیشتر از صفر باشد." })
  .max(1_000_000, { message: "مقدار نمی‌تواند بیشتر از یک میلیون باشد." });

/** قلم خرید — ماده خام + مقدار + قیمت واحد. */
export const buyItemSchema = z.object({
  /** شناسه ماده خام در کاتالوگ (cuid) */
  materialId: z
    .string({ message: "قلم خرید الزامی است." })
    .min(1, { message: "قلم خرید الزامی است." })
    .max(64, { message: "شناسه قلم بسیار طولانی است." }),
  qty: qtyInput,
  price: priceInput,
});

export type BuyItemInput = z.infer<typeof buyItemSchema>;

/**
 * ثبت خرید — POST /api/buys.
 *
 * خرید با وضعیت `req` ساخته می‌شود (PHASE_06 §۶). حداقل یک قلم لازم است.
 * `supplierId` اختیاری است (Demo امکان خرید بدون تأمین‌کننده را می‌دهد).
 */
export const createBuySchema = z.object({
  supplierId: z
    .string({ message: "شناسه تأمین‌کننده نامعتبر است." })
    .max(64, { message: "شناسه تأمین‌کننده بسیار طولانی است." })
    .optional(),
  items: z
    .array(buyItemSchema)
    .min(1, { message: "حداقل یک قلم خرید لازم است." })
    .max(100, { message: "نمی‌توان بیشتر از ۱۰۰ قلم در یک خرید ثبت کرد." }),
  note: optionalTextSchema(500),
});

export type CreateBuyInput = z.infer<typeof createBuySchema>;

/**
 * ویرایش خرید — PATCH /api/buys/[id].
 *
 * فقط در وضعیت `req` مجاز است (PHASE_06 §۷). همه فیلدها اختیاری‌اند؛
 * محدودیت وضعیت در سرویس بررسی می‌شود.
 */
export const updateBuySchema = z.object({
  // null = جداسازی تأمین‌کننده (schema Buy: supplierId nullable — disconnected)
  supplierId: z
    .string({ message: "شناسه تأمین‌کننده نامعتبر است." })
    .max(64, { message: "شناسه تأمین‌کننده بسیار طولانی است." })
    .nullish(),
  items: z
    .array(buyItemSchema)
    .min(1, { message: "حداقل یک قلم خرید لازم است." })
    .max(100, { message: "نمی‌توان بیشتر از ۱۰۰ قلم در یک خرید ثبت کرد." })
    .optional(),
  note: z.string().trim().max(500, { message: "یادداشت نمی‌تواند بیشتر از ۵۰۰ نویسه باشد." }).optional(),
  /** همزمانی خوش‌بینانه (R-06 / PHASE_06 §۳) — الزامی */
  rev: z.number().int().nonnegative({ message: "شماره بازنگری نامعتبر است." }),
});

export type UpdateBuyInput = z.infer<typeof updateBuySchema>;

/** پارامترهای query لیست خریدها — GET /api/buys. */
export const buyListQuerySchema = z.object({
  status: z.enum(BUY_STATUSES, { message: "وضعیت خرید نامعتبر است." }).optional(),
  supplierId: z
    .string({ message: "شناسه تأمین‌کننده نامعتبر است." })
    .max(64)
    .optional(),
  q: z.string().trim().optional().default(""),
  page: z.coerce.number().int().positive({ message: "صفحه نامعتبر است." }).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive({ message: "اندازه صفحه نامعتبر است." })
    .max(200, { message: "اندازه صفحه نمی‌تواند بیشتر از ۲۰۰ باشد." })
    .default(50),
});

export type BuyListQuery = z.infer<typeof buyListQuerySchema>;

/** پارامتر `id` مسیر. */
export const buyIdParamSchema = idParamSchema;

/**
 * تبدیل وضعیت — PATCH انتقال وضعیت مجاز نیست؛ انتقال‌ها از طریق
 * routeهای اختصاصی (approve / finance / receive) انجام می‌شوند (PHASE_06 §۷).
 * این اسکیما فقط برای سادگی آزمون‌های ماشین حالت در سرویس استفاده می‌شود.
 */
export const buyTransitionSchema = z.object({
  to: z.enum(BUY_STATUSES, { message: "وضعیت مقصد نامعتبر است." }),
});

export type BuyTransitionInput = z.infer<typeof buyTransitionSchema>;

/**
 * تأیید مدیر خرید — POST /api/buys/[id]/approve (PHASE_06 §۷).
 *
 * `rev` برای تشخیص تداخل همزمان الزامی است (R-06 / PHASE_06 §۳.۲).
 * گذار مجاز فقط `req → ok` است — در سرویس بررسی می‌شود.
 */
export const approveBuySchema = z.object({
  rev: z
    .number({ message: "شماره بازنگری الزامی است." })
    .int({ message: "شماره بازنگری باید عدد صحیح باشد." })
    .nonnegative({ message: "شماره بازنگری نامعتبر است." }),
});

export type ApproveBuyInput = z.infer<typeof approveBuySchema>;

/**
 * تأیید مالی + ثبت چک‌های صادره — POST /api/buys/[id]/finance.
 *
 * چک‌ها با وضعیت `issued` ثبت می‌شوند (app/buy.js:231). جمع مبالغ چک‌ها
 * نباید از مبلغ کل خرید بیشتر باشد (PHASE_06 §۱۲ — مفهوم app/buy.js:138).
 * بردن بدون چک هم مجاز است (خرید نقدی/پرداخت در محل — Demo پرداخت‌ها را
 * بعداً هم می‌تواند ثبت کند، ولی در این فاز چک فقط اینجا ثبت می‌شود).
 */
export const financeBuySchema = z.object({
  cheques: z.array(createBuyChequeSchema).optional(),
  rev: z
    .number({ message: "شماره بازنگری الزامی است." })
    .int({ message: "شماره بازنگری باید عدد صحیح باشد." })
    .nonnegative({ message: "شماره بازنگری نامعتبر است." }),
});

export type FinanceBuyInput = z.infer<typeof financeBuySchema>;

/**
 * رسید انبار — POST /api/buys/[id]/receive (PHASE_06 §۷).
 *
 * مقدارهای ورودی از اقلام خرید خوانده می‌شوند (app/fin-core.js:43 —
 * `lines.forEach` با همان qty اقلام). بدنه فقط `rev` دارد.
 */
export const receiveBuySchema = z.object({
  rev: z
    .number({ message: "شماره بازنگری الزامی است." })
    .int({ message: "شماره بازنگری باید عدد صحیح باشد." })
    .nonnegative({ message: "شماره بازنگری نامعتبر است." }),
});

export type ReceiveBuyInput = z.infer<typeof receiveBuySchema>;

/** وضعیت چک — PATCH /api/buys/[id]/cheques/[cid]. */
export const chequeStatusSchema = z.object({
  status: z.enum(CHEQUE_STATUSES, { message: "وضعیت چک نامعتبر است." }),
});

export type ChequeStatusInput = z.infer<typeof chequeStatusSchema>;
