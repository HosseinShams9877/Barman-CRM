/**
 * اسکیمای اعتبارسنجی حرکت‌های انبار — Zod با پیام فارسی (CD-28).
 *
 * قوانین (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - پیام اعتبارسنجی فرم دستی: «محصول، مقدار و علت را وارد کنید»
 *    (app/stock.js:۶۶-۶۷: نبود قلم/مقدار/علت).
 *  - guard موجودی: «بیشتر از موجودی آزاد است (بخشی رزرو سفارش‌هاست)»
 *    (app/stock.js:۶۸) — در سرویس با freeQty بررسی می‌شود.
 *  - علامت qty بر اساس kind (PHASE_05 §۱۲): مقدار ورودی مثبت است و
 *    علامت در سرویس اعمال می‌شود؛ `adj` مقدار علامت‌دار می‌گیرد.
 */
import { z } from "zod";
import { idParamSchema, optionalTextSchema, positiveIntSchema } from "@core/validation";
import { MANUAL_ENTRY_KINDS, MOVE_KINDS, WAREHOUSES } from "../constants";

/**
 * مقدار مطلقاً مثبت (با تلورانس گردسازی) — برای qty ورودی.
 *
 * `adj` (اصلاح شمارش) دوطرفه است: مقدار علامت‌دار مستقیم از کلاینت
 * می‌آید (adj−/adj+ در دمو — app/stock.js:۵۳/۸۸) و فقط صفر مجاز نیست.
 * اعتبارسنجی نهایی علامت بر اساس kind در `validateQtyForKind` است
 * (PHASE_05 §۱۲).
 */
const qtyInput = z
  .number({ message: "مقدار حرکت الزامی است." })
  .min(-1_000_000, { message: "مقدار نمی‌تواند کمتر از منفی یک میلیون باشد." })
  .max(1_000_000, { message: "مقدار نمی‌تواند بیشتر از یک میلیون باشد." });

/**
 * اعتبارسنجی علامت بر اساس kind (PHASE_05 §۱۲):
 *  - kinds با جهت ثابت (open/out/waste): مقدار باید مثبت باشد؛ علامت
 *    در سرویس با `signedQty` اعمال می‌شود.
 *  - `adj` دوطرفه است: فقط صفر مجاز نیست (همانی که کلاینت دمو می‌فرستد).
 */
function validateQtyForKind(kind: string, qty: number): boolean {
  if (kind === "adj") return qty !== 0;
  return qty > 0;
}

/**
 * مقدار مثبت — برای اقلام رزرو (PHASE_05 §۳.۹).
 * `adj` دوطرفه است ولی مقدار رزرو همیشه مثبت است.
 */
const positiveQty = z
  .number({ message: "مقدار الزامی است." })
  .positive({ message: "مقدار باید بیشتر از صفر باشد." })
  .max(1_000_000, { message: "مقدار نمی‌تواند بیشتر از یک میلیون باشد." });

/**
 * ثبت حرکت دستی — POST /api/moves.
 *
 * `kind` فقط یکی از حرکت‌های دستی است (MANUAL_ENTRY_KINDS)؛ حرکت‌های
 * سیستمی (buy/prod/sale/use/job) فقط از عملیات کسب‌کار ساخته می‌شوند
 * («بدون حرکت یتیمی، بدون شمارش مضاعف»).
 */
export const createMoveSchema = z
  .object({
    wh: z.enum(WAREHOUSES, { message: "انبار نامعتبر است." }),
    itemId: z
      .string({ message: "قلم حرکت الزامی است." })
      .min(1, { message: "قلم حرکت الزامی است." })
      .max(64, { message: "شناسه قلم بسیار طولانی است." }),
    qty: qtyInput,
    kind: z.enum(MANUAL_ENTRY_KINDS, {
      message: "ثبت این نوع حرکت به‌صورت دستی مجاز نیست.",
    }),
    note: z
      .string({ message: "علت حرکت الزامی است." })
      .trim()
      .min(1, { message: "علت حرکت الزامی است." })
      .max(200, { message: "علت حرکت نمی‌تواند بیشتر از ۲۰۰ نویسه باشد." }),
  })
  .refine((v) => validateQtyForKind(v.kind, v.qty), {
    message: "مقدار باید بیشتر از صفر باشد.",
    path: ["qty"],
  });

export type CreateMoveInput = z.infer<typeof createMoveSchema>;

/**
 * ویرایش حرکت دستی — PATCH /api/moves/[id].
 *
 * فقط حرکت‌های `open`/`out`/`adj` قابل ویرایش‌اند (PHASE_05 §۸) —
 * محدودیت kind در سرویس بررسی می‌شود. `adj` مقدار علامت‌دار می‌گیرد.
 */
export const updateMoveSchema = z
  .object({
    /** برای `adj` می‌تواند منفی باشد؛ برای `open`/`out` باید مثبت باشد. */
    qty: qtyInput.optional(),
    note: optionalTextSchema(200),
  })
  .refine((v) => v.qty === undefined || v.qty !== 0, {
    message: "مقدار باید بیشتر از صفر باشد.",
    path: ["qty"],
  });

export type UpdateMoveInput = z.infer<typeof updateMoveSchema>;

/** پارامترهای query لیست حرکت‌ها — GET /api/moves. */
export const moveListQuerySchema = z.object({
  wh: z.enum(WAREHOUSES).optional(),
  kind: z.enum(MOVE_KINDS).optional(),
  q: z.string().trim().optional().default(""),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});

export type MoveListQuery = z.infer<typeof moveListQuerySchema>;

/** پارامتر `id` مسیر — مشترک با سایر ماژول‌ها. */
export const moveIdParamSchema = idParamSchema;

/**
 * بررسی رزرو — POST /api/reservations/check (PHASE_05 §۳.۹).
 *
 * guard موجودی: سرور بررسی می‌کند موجودی آزاد کافی است (freeQty —
 * core.js:۲۰۸). Q-04 باز است → طبق PHASE_05 §۳.۹ مسدودسازی اجرا می‌شود.
 */
export const reservationCheckSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z
          .string({ message: "شناسه محصول الزامی است." })
          .min(1, { message: "شناسه محصول الزامی است." })
          .max(64, { message: "شناسه محصول بسیار طولانی است." }),
        qty: positiveQty,
      }),
    )
    .min(1, { message: "حداقل یک قلم لازم است." })
    .max(100, { message: "نمی‌توان بیشتر از ۱۰۰ قلم بررسی کرد." }),
});

export type ReservationCheckInput = z.infer<typeof reservationCheckSchema>;
