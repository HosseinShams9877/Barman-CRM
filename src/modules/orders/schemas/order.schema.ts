/**
 * اسکیماهای Zod سفارش — اعتبارسنجی دوگانه (R-13) + پیام فارسی (CD-28).
 *
 * قوانین کسب‌وکار (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - حداقل یک قلم با qty و قیمت مثبت (order.js:147 ok1/ok2).
 *  - درصد تخفیف ۰..۱۰۰؛ اجرای سقف سه‌حالته CD-25 در سرویس (نیازمند نقش).
 *  - چک‌لیست آماده‌سازی باید **همه** موارد تیک بخورد (order.js:562).
 *  - کنترل کیفیت: تعداد تولید + ضایعات؛ دلیل ضایعات اجباری (order.js:520).
 *  - پذیرش تولید: تاریخ پایان باید بزرگ‌تر یا مساوی شروع باشد (order.js:719).
 *  - شماره صیادی دقیقاً ۱۶ رقم (order.js:622) — خالی مجاز است (Q-06).
 *  - لغو فقط با دلیل (canCancel — order.js:59).
 *  - جمع برنامه پرداخت باید با کل برابر باشد (تلورانس ۱ ریال — order.js:147 ok4).
 *
 * همه Route Handlerهای فاز ۴ `parseOrFail(schema, raw, faErrorMap)` را
 * فراخوانی می‌کنند تا پیام‌ها فارسی باشند (دستور مالک فاز ۴).
 */
import { z } from "zod";
import {
  jalaliDateSchema,
  moneySchema,
  nonNegativeIntSchema,
  paginationSchema,
  positiveIntSchema,
} from "@core/validation";
import {
  AGREED_HOW,
  BACK_REASONS,
  CHEQUE_STATUSES,
  PREP_CHECKS,
  QC_CHECKS,
  SAYAD_LENGTH,
  SEND_VIAS,
} from "../constants";

/** خط محصول — app/core.js:199. */
export const orderLineSchema = z.enum(["prod", "agency"]);

/** مرحله خط لوله ۱..۱۱ (orderStage.ts — core.js:156-168). */
export const orderStageParamSchema = z.coerce.number().int().min(1).max(11);

/** وضعیت سفارش (Q-11). */
export const orderStatusSchema = z.enum(["open", "done", "cancelled"]);

/** درصد تخفیف — عدد صحیح ۰ تا ۱۰۰. */
export const discountPctSchema = z.number().int().min(0).max(100);

/** شناسه سفارش — الگوی PF-1201 (X.nextId("PF") — core.js:364). */
export const orderIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .refine((v) => /^PF-\d+$/.test(v), {
    message: "شناسه سفارش معتبر نیست (مثال: PF-1201).",
  });

/**
 * جمع‌کردن مبلغ و چک‌های تأییدشده — کمکی برای تست‌ها و سرویس.
 * تلورانس ۱ ریال مطابق order.js:147 (ok4: |diff| < 1).
 */
export const PAYMENT_TOLERANCE = 1;

// --- اقلام -------------------------------------------------------------

/** قلم سفارش — مشخصات کامل. */
export const orderItemSchema = z.object({
  productId: z.string().trim().min(1).max(64),
  qty: positiveIntSchema.max(1_000_000),
  /** قیمت واحد به ریال — مثبت (order.js:147 ok2). */
  price: positiveIntSchema,
  /** درصد تخفیف قلم — ۰..۱۰۰ (PHASE_04 §۶). */
  discount: discountPctSchema.default(0),
  color: z.string().trim().max(64).default(""),
});

/** ویرایش قلم موجود — همه فیلدها لازم (جایگزینی کامل خط). */
export const orderItemEditSchema = orderItemSchema.extend({
  id: z.string().trim().min(1).max(64),
});

/** پارامترهای مولد برنامه پرداخت سفارشی (genPlan — order.js:118-132). */
export const planBuilderSchema = z
  .object({
    /** درصد پیش‌پرداخت ۰..۱۰۰. */
    pre: discountPctSchema.default(0),
    /** پیش‌پرداخت به صورت درصد یا مبلغ ثابت. */
    preMode: z.enum(["pct", "amt"]).default("pct"),
    /** مبلغ ثابت پیش‌پرداخت — فقط وقتی preMode = "amt". */
    preAmt: moneySchema.default(0),
    /** نوع تسویه باقی‌مانده. */
    rest: z.enum(["cash", "cheque", "credit"]).default("cheque"),
    /** تعداد چک‌ها — ۱..۱۲. */
    n: z.number().int().min(1).max(12).default(1),
    /** فاصله سررسید چک‌ها — کلیدهای PLAN_GAPS (order.js:115). */
    gap: z.enum(["15d", "1m", "2m", "3m"]).default("1m"),
    /** شروع سررسید چک‌ها — کلیدهای PLAN_FIRST (order.js:115). */
    first: z.enum(["1m", "2m", "3m"]).default("1m"),
  })
  .superRefine((val, ctx) => {
    if (val.preMode === "amt" && val.preAmt <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["preAmt"],
        message: "مبلغ پیش‌پرداخت باید بزرگ‌تر از صفر باشد.",
      });
    }
    if (val.preMode === "pct" && (val.pre < 0 || val.pre > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pre"],
        message: "درصد پیش‌پرداخت باید بین ۰ و ۱۰۰ باشد.",
      });
    }
  });

// --- ایجاد/ویرایش -------------------------------------------------------------

/**
 * ایجاد پیش‌فاکتور — حداقل یک قلم (order.js:147 ok1).
 *
 * `leadId` برای تبدیل سرنخ به پیش‌فاکتور استفاده می‌شود (app/leads.js):
 * اقلام اولیه از محصولات مورد علاقه سرنخ ساخته نمی‌شوند (کاتالوگ Demo
 * متفاوت است) — سرویس یک قلم پیش‌فرض با qty=10 می‌سازد (order.js:25-26
 * fallback وقتی ld.area وجود ندارد).
 *
 * `accountId` در زمان ایجاد اختیاری است (draft)، اما در زمان «ارسال
 * برای تأیید» اجباری می‌شود (draftErrors — order.js:217-228).
 */
export const createOrderSchema = z
  .object({
    accountId: z.string().trim().min(1).max(64).optional(),
    contactId: z.string().trim().min(1).max(64).optional(),
    leadId: z.string().trim().min(1).max(64).optional(),
    line: orderLineSchema.default("prod"),
    items: z.array(orderItemSchema).min(1).max(200),
    discPct: discountPctSchema.default(0),
    discAmt: moneySchema.default(0),
    ship: moneySchema.default(0),
    install: moneySchema.default(0),
    noVat: z.boolean().default(false),
    validDays: positiveIntSchema.max(365).default(3),
    note: z.string().trim().max(4096).default(""),
    preset: z.string().trim().max(32).default(""),
    ownerId: z.string().trim().min(1).max(64).optional(),
  })
  .superRefine((val, ctx) => {
    // درصد تخفیف صفر با مبلغ تخفیف متناقض است — یادآوری ملایم (نه رد).
    if (val.discPct === 0 && val.discAmt > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discPct"],
        message: "مبلغ تخفیف وارد شده ولی درصد صفر است.",
      });
    }
  });

/**
 * ویرایش پیش‌فاکتور — فقط در مراحل قابل ویرایش (بررسی در سرویس).
 * `undefined` یعنی «تغییر نده».
 */
export const updateOrderSchema = z.object({
  accountId: z.string().trim().min(1).max(64).nullable().optional(),
  contactId: z.string().trim().min(1).max(64).nullable().optional(),
  line: orderLineSchema.optional(),
  items: z.array(orderItemEditSchema).min(1).max(200).optional(),
  discPct: discountPctSchema.optional(),
  discAmt: moneySchema.optional(),
  ship: moneySchema.optional(),
  install: moneySchema.optional(),
  noVat: z.boolean().optional(),
  validDays: positiveIntSchema.max(365).optional(),
  note: z.string().trim().max(4096).optional(),
  preset: z.string().trim().max(32).optional(),
  planBuilder: planBuilderSchema.optional(),
});

// --- کوئری لیست -------------------------------------------------------------

/** کوئری لیست سفارش‌ها — فیلتر مرحله/وضعیت/مالک + جستجو + صفحه‌بندی. */
export const listOrdersQuerySchema = paginationSchema.extend({
  stage: orderStageParamSchema.optional(),
  status: orderStatusSchema.optional(),
  ownerId: z.string().trim().min(1).max(64).optional(),
  q: z.string().trim().max(128).default(""),
});

// --- اقدامات مرحله (data-rvgo / data-rvsend — order.js) -------------------

/** گروه اقدام «ارسال برای تأیید» — draft → ۲/۳/۴ بر اساس نقش (order.js:271-273). */
const submitActionSchema = z.object({
  action: z.literal("submit"),
  /** مشتری در زمان ارسال اجباری است (draftErrors — order.js:217-228). */
  accountId: z.string().trim().min(1).max(64).optional(),
  note: z.string().trim().max(1024).optional(),
});

/** تأیید فروشکه/مدیر — ۲→۳ (smOk) یا ۳→۴ (mgrOk) — data-rvgo ok. */
const approveActionSchema = z.object({
  action: z.literal("approve"),
  note: z.string().trim().max(1024).optional(),
});

/** بازگشت برای اصلاح — ۲/۳→۱ با یادداشت (data-rvgo back — order.js:698). */
const returnActionSchema = z
  .object({
    action: z.literal("return"),
    /** دلیل یکی از BACK_REASONS (order.js:326) یا متن آزاد. */
    reason: z.string().trim().max(192).optional(),
    note: z.string().trim().min(1).max(2048),
  })
  .superRefine((val, ctx) => {
    if (!val.reason && val.note.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["note"],
        message: "دلیل بازگشت را بنویسید.",
      });
    }
  });

/** ارسال پیش‌فاکتور برای مشتری — ۴→۵ (data-sendnow — order.js:708). */
const sendActionSchema = z.object({
  action: z.literal("send"),
  via: z.array(z.enum(SEND_VIAS)).min(1).max(3),
  note: z.string().trim().max(1024).optional(),
});

/**
 * قطعی‌سازی — ۵→۶ (تولیدی) یا ۵→۹ (پرش ۶/۷/۸) — finalize (order.js:452-472).
 *
 * قوانین: نحوه توافق اجباری است (AGREED_HOW — order.js:391) و برنامه
 * پرداخت باید با کل تسویه شود (|total − sum| < ۱ ریال — order.js:147 ok4).
 * خود برنامه از preset/planBuilder ذخیره‌شده دوباره تولید می‌شود.
 */
const finalizeActionSchema = z.object({
  action: z.literal("finalize"),
  agreedHow: z.enum(AGREED_HOW.map((a) => a.key) as [string, ...string[]]),
  agreedNote: z.string().trim().max(2048).default(""),
});

/** پذیرش تولید — ۶→۷ با تاریخ شروع/پایان (order.js:719). */
export const pacceptActionSchema = z
  .object({
    action: z.literal("paccept"),
    start: jalaliDateSchema,
    end: jalaliDateSchema,
    note: z.string().trim().max(2048).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.end < val.start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end"],
        message: "تاریخ پایان تولید باید بعد از تاریخ شروع باشد.",
      });
    }
  });

/** شروع تولید — ثبت startedAt بدون تغییر مرحله (order.js:725). */
const startProductionActionSchema = z.object({
  action: z.literal("startProduction"),
});

/** پایان تولید — ۷→۸ (order.js:727 made). */
const madeActionSchema = z.object({
  action: z.literal("made"),
  note: z.string().trim().max(2048).optional(),
});

/**
 * کنترل کیفیت — ۸→۹ با تعداد تولید/ضایعات و صدور سند تحویل TR-
 * (qcok — order.js:728-747).
 */
export const qcActionSchema = z
  .object({
    action: z.literal("qc"),
    /** تعداد تولید شده — مثبت. */
    good: positiveIntSchema.max(1_000_000),
    /** تعداد ضایعات — نامنفی. */
    waste: nonNegativeIntSchema.max(1_000_000),
    /** دلیل ضایعات — اجباری وقتی waste > 0 (order.js:520). */
    why: z.string().trim().max(2048).default(""),
    note: z.string().trim().max(2048).optional(),
    /** چک‌لیست کنترل کیفیت — باید همه تیک بخورند (order.js:520). */
    checks: z.array(z.enum(QC_CHECKS)).max(QC_CHECKS.length).default([]),
  })
  .superRefine((val, ctx) => {
    if (val.waste > 0 && val.why.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["why"],
        message: "دلیل ضایعات را بنویسید.",
      });
    }
  });

/**
 * دریافت بار — ثبت در مرحله ۹ بدون تغییر مرحله (order.js:748-761).
 *
 * `lines`: مقادیر رسید به‌ازای قلم — در Demo فیلدهای `data-rv` پر می‌شوند
 * و پیش‌فرض هر قلم مقدار سند تحویل است (order.js:749). مغایرت با سند
 * نیازمند یادداشت است که آن بررسی در سرویس انجام می‌شود (دسترسی به سند).
 */
const receiveActionSchema = z.object({
  action: z.literal("receive"),
  lines: z
    .array(
      z.object({
        productId: z.string().trim().min(1).max(64),
        qty: nonNegativeIntSchema.max(1_000_000),
      }),
    )
    .max(100)
    .optional(),
  note: z.string().trim().max(2048).optional(),
});

/** تأیید دریافت — ۹→۱۰ (daccept — order.js:748-761). */
const dacceptActionSchema = z.object({
  action: z.literal("daccept"),
  note: z.string().trim().max(2048).optional(),
});

/**
 * آماده‌سازی بار — ۱۰→۱۱ (prep — order.js:762).
 * همه موارد چک‌لیست باید تیک بخورند (order.js:562).
 */
export const prepActionSchema = z
  .object({
    action: z.literal("prep"),
    packs: positiveIntSchema.max(10_000),
    checks: z.array(z.enum(PREP_CHECKS)).max(PREP_CHECKS.length).default([]),
    note: z.string().trim().max(2048).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.checks.length < PREP_CHECKS.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checks"],
        message: "تمام موارد چک‌لیست آماده‌سازی باید تیک بخورند.",
      });
    }
  });

/** تحویل به مشتری — ۱۱→done (deliver — order.js:766-770). */
const deliverActionSchema = z.object({
  action: z.literal("deliver"),
  /** نام تحویل‌گیرنده — اجباری (order.js:573-576). */
  to: z.string().trim().min(1).max(96),
  note: z.string().trim().max(2048).optional(),
});

/**
 * بدنه `POST /api/orders/[id]/stage` — اتحاد متمایز روی `action`.
 * هر اقدام فقط فیلدهای خود را می‌پذیرد (فیلدهای ناشناخته رد می‌شوند).
 */
export const stageActionSchema = z.discriminatedUnion("action", [
  submitActionSchema,
  approveActionSchema,
  returnActionSchema,
  sendActionSchema,
  finalizeActionSchema,
  pacceptActionSchema,
  startProductionActionSchema,
  madeActionSchema,
  qcActionSchema,
  receiveActionSchema,
  dacceptActionSchema,
  prepActionSchema,
  deliverActionSchema,
]);

export type StageAction = z.infer<typeof stageActionSchema>;

/**
 * لغو سفارش — فقط در stage ≤ ۵ توسط management/salesManager/sales مالک
 * (canCancel — order.js:59). بررسی مجوز در سرویس.
 */
export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(1).max(192),
});

// --- پرداخت‌ها و چک‌ها -----------------------------------------------------

/** ثبت پرداخت دریافتی — KIND: cash|card (core.js:242). */
export const createPaymentSchema = z.object({
  kind: z.enum(["cash", "card"]),
  amount: positiveIntSchema,
  date: jalaliDateSchema,
  note: z.string().trim().max(2048).default(""),
});

/** ویرایش پرداخت — باطل‌سازی (p.void) یا یادداشت. */
export const updatePaymentSchema = z.object({
  void: z.boolean().optional(),
  note: z.string().trim().max(2048).optional(),
});

/**
 * ثبت چک دریافتی — شماره صیادی دقیقاً ۱۶ رقم (order.js:622).
 * خالی مجاز است (Q-06: چک ناقص با نشان هشدار).
 */
export const createChequeSchema = z.object({
  sayad: z
    .string()
    .trim()
    .default("")
    .refine((v) => v === "" || (/^\d+$/.test(v) && v.length === SAYAD_LENGTH), {
      message: `شماره صیادی باید دقیقاً ${SAYAD_LENGTH} رقم باشد.`,
    }),
  amount: positiveIntSchema,
  due: jalaliDateSchema,
  bank: z.string().trim().max(64).default(""),
  owner: z.string().trim().max(96).default(""),
  note: z.string().trim().max(2048).default(""),
});

/** ویرایش چک — وضعیت و اطلاعات بانکی (fin). */
export const updateChequeSchema = z.object({
  status: z.enum(CHEQUE_STATUSES).optional(),
  bank: z.string().trim().max(64).optional(),
  owner: z.string().trim().max(96).optional(),
  note: z.string().trim().max(2048).optional(),
});

// --- برنامه پرداخت ---------------------------------------------------------

/** بدنه `POST /api/orders/[id]/plan` — پارامترهای مولد (genPlan). */
export const generatePlanSchema = z.object({
  preset: z.string().trim().max(32).optional(),
  builder: planBuilderSchema.optional(),
});

export type GeneratePlanInput = z.infer<typeof generatePlanSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type CreateChequeInput = z.infer<typeof createChequeSchema>;
export type UpdateChequeInput = z.infer<typeof updateChequeSchema>;
