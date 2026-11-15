/**
 * ثابت‌های ماژول تولید — تمام برچسب‌ها از Demo با ارجاع خط (CLAUDE.md §۱۳).
 *
 * JST — app/prod.js:۱۲:
 *   plan: "برنامه‌ریزی شد"، run: "در حال تولید"، qc: "کنترل کیفیت"،
 *   sent: "فرستاده به دپو"، done: "وارد دپو شد"
 */

/** وضعیت‌های کار تولید — app/prod.js:۱۲ (JST). */
export const JOB_STATUS = ["plan", "run", "qc", "sent", "done"] as const;

export type JobStatus = (typeof JOB_STATUS)[number];

/** برچسب فارسی وضعیت — دقیقاً مطابق app/prod.js:۱۲. */
export const JOB_STATUS_LABELS: Readonly<Record<JobStatus, string>> = {
  plan: "برنامه‌ریزی شد",
  run: "در حال تولید",
  qc: "کنترل کیفیت",
  sent: "فرستاده به دپو",
  done: "وارد دپو شد",
};

/**
 * نام مراحل استپر — app/prod.js:۸۰:
 * `["برنامه", "تولید", "کیفیت", "ارسال", "دپو"]`
 */
export const JOB_STEP_NAMES = ["برنامه", "تولید", "کیفیت", "ارسال", "دپو"] as const;

/**
 * گذارهای مجاز state machine — همه با ارجاع به Demo:
 *  - plan → run: data-jstart (app/prod.js:۱۲۱) + کسر مواد
 *  - run → qc: data-jmade (app/prod.js:۱۲۳)
 *  - qc → sent: data-jqc (app/prod.js:۱۲۴) + ثبت good/waste
 *  - sent → done: jrecv (app/stock.js:۷۳) + حرکت kind: job
 *
 * هر گذار خارج از این نقشه در سرویس رد می‌شود.
 */
export const JOB_TRANSITIONS: Readonly<Record<JobStatus, JobStatus | null>> = {
  plan: "run",
  run: "qc",
  qc: "sent",
  sent: "done",
  done: null,
};

/** پیشوند شناسه کار تولید — `X.nextId("PJ")` در Demo (app/prod.js:۱۱۹). */
export const JOB_ID_PREFIX = "PJ";

/** پیش‌فرض تاریخ پایان: امروز + ۳ روز — app/prod.js:۷۵ (`Date.now() + 3 * X.DAY`). */
export const JOB_END_DEFAULT_DAYS = 3;

/** پیام‌های فارسی کسب‌کار —منتقل از رشته‌های HTML دمو (R-19). */
export const JOB_MESSAGES = {
  missingProductQty: "محصول و مقدار را وارد کنید",
  shortMaterial: "مواد اولیه کافی نیست",
  started: "شروع شد؛ مواد کم شد",
  sentToDepot: "برای انبار دپو فرستاده شد",
  made: "تولید شد",
  recvMismatch: "مقدار دریافت با مقدار سالم یکسان نیست",
} as const;
