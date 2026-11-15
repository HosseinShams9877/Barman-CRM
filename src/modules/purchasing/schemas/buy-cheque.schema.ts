/**
 * اسکیمای اعتبارسنجی چک خرید — Zod با پیام فارسی (CD-28 / PHASE_06 §۶).
 *
 * قوانین (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - مبلغ چک عدد صحیح مثبت به ریال است (CD-13).
 *  - سررسید تاریخ شمسی معتبر `YYYY/MM/DD` با ارقام ASCII است (CD-06 —
 *    اعتبارسنجی با core/calendar، نه RegExp).
 *  - شماره صیادی ارقام خالص است (app/buy.js:231:
 *    `X.toEn(ref).replace(/\D/g, "")`) — اختیاری.
 *  - چک با وضعیت `issued` ثبت می‌شود و فقط به `paid` تغییر می‌کند
 *    (PHASE_06 §۶ — app/fin.js:143 data-cop: `p.chq.status = "paid"`).
 *  - جمع مبالغ چک‌ها نباید از مبلغ خرید بیشتر باشد (PHASE_06 §۱۲).
 */
import { z } from "zod";
import { idParamSchema, jalaliDateSchema } from "@core/validation";

/** شماره صیادی — ارقام خالص (app/buy.js:231). */
const sayadInput = z
  .string({ message: "شماره صیادی نامعتبر است." })
  .trim()
  .regex(/^\d{10,16}$/, { message: "شماره صیادی باید ۱۰ تا ۱۶ رقم باشد." })
  .optional();

/**
 * ثبت چک خرید — در زمان تأمین مالی (ok → fin) ثبت می‌شود.
 *
 * منبع: app/buy.js:231 — `pays.push({ … chq: { sayad, bank, due,
 * status: "issued" } })`. وضعیت همیشه `issued` شروع می‌شود.
 */
export const createBuyChequeSchema = z.object({
  amount: z
    .number({ message: "مبلغ چک الزامی است." })
    .int({ message: "مبلغ چک باید عدد صحیح باشد." })
    .positive({ message: "مبلغ چک باید بیشتر از صفر باشد." })
    .max(Number.MAX_SAFE_INTEGER, { message: "مبلغ چک بسیار بزرگ است." }),
  due: jalaliDateSchema,
  sayad: sayadInput,
});

export type CreateBuyChequeInput = z.infer<typeof createBuyChequeSchema>;

/**
 * ویرایش چک خرید — PATCH /api/buys/[id]/cheques/[cid].
 *
 * فقط انتقال `issued → paid` مجاز است (PHASE_06 §۶ / app/fin.js:143).
 * وضعیت مقصد در سرویس بررسی می‌شود.
 */
export const updateBuyChequeSchema = z.object({
  status: z.literal("paid", { message: "فقط علامت‌گذاری چک به‌عنوان پاس‌شده مجاز است." }),
});

export type UpdateBuyChequeInput = z.infer<typeof updateBuyChequeSchema>;

/** پارامترهای مسیر — buy id و cheque id. */
export const chequeParamSchema = z.object({
  id: z.string().min(1).max(64),
  cid: z.string().min(1).max(64),
});

/** نسخه مستقل از idParamSchema برای سازگاری لوله. */
export const buyChequeIdParamSchema = idParamSchema;
