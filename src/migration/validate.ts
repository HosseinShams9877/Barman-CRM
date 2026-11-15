/**
 * مرحله ۵ مهاجرت — اعتبارسنجی Zod + بررسی ارجاعات (MIGRATION_STRATEGY §۳.۵).
 *
 * موارد ناسازگار هرگز به‌صورت ساکت اصلاح نمی‌شوند:
 *  - خطای اسکیما یا ارجاع اجباری گمشده → رد رکورد (در گزارش فهرست می‌شود).
 *  - ارجاع نرم (کاربر ثبت‌کننده) ناموجود → null شدن + ثبت در
 *    `referentialIssues` (شفاف در گزارش).
 */
import { z } from "zod";
import type { RejectedRecord } from "./types";
import type { MappedData } from "./map";
import { ACCOUNT_KINDS } from "@modules/customers/constants/account-kinds";
import { BUY_STATUSES } from "@modules/purchasing/constants/BUY_STATUS";
import { JOB_STATUS } from "@modules/production/constants";

/** نه‌وضعیت حرکت انبار — inventory/constants (app/stock.js:14). */
const MOVE_KINDS = ["open", "buy", "prod", "sale", "use", "out", "adj", "waste", "job"] as const;
const ORDER_STATUSES = ["open", "done", "cancelled"] as const;
const LEAD_STAGES = ["raw", "opp", "pf", "won", "lost"] as const;
const LEAD_LINES = ["prod", "agency"] as const;
const FOLLOWUP_KINDS = ["in", "stage", "note", "lost"] as const;
const CHEQUE_STATUSES = ["hand", "bank", "clear", "bounce"] as const;
const ORDER_LINES = ["prod", "agency"] as const;

const prefixedId = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}-\\d+$`), {
    message: `شناسه باید به‌صورت ${prefix}-<n> باشد`,
  });

const accountSchema = z.object({
  id: prefixedId("AC"),
  name: z.string().max(192),
  kind: z.enum(ACCOUNT_KINDS.map((k) => k.key) as [string, ...string[]]),
  active: z.boolean(),
  address: z.string().max(512),
  note: z.string().max(2048),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

const phoneSchema = z.object({
  id: z.string().min(1),
  accountId: prefixedId("AC"),
  kind: z.string().max(32),
  number: z.string().min(1).max(32),
});

const contactSchema = z.object({
  id: z.string().min(1),
  accountId: prefixedId("AC"),
  name: z.string().min(1).max(96),
  role: z.string().max(96),
  phone: z.string().max(32),
});

const leadSchema = z.object({
  id: prefixedId("LD"),
  accountId: prefixedId("AC").nullable(),
  line: z.enum(LEAD_LINES),
  stage: z.enum(LEAD_STAGES),
  title: z.string().max(192),
  amount: z.number().int().nonnegative().nullable(),
  ownerId: z.string().nullable(),
  source: z.string().max(64),
  note: z.string().max(2048),
  lostReason: z.string().nullable(),
  lostFrom: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

const followupSchema = z.object({
  id: z.string().min(1),
  leadId: prefixedId("LD"),
  at: z.number().int().nonnegative(),
  kind: z.enum(FOLLOWUP_KINDS),
  result: z.string().max(96),
  note: z.string().max(2048),
  nextAt: z.string().regex(/^\d{4}\/\d{2}\/\d{2}$/).nullable(),
  byUserId: z.string().nullable(),
});

const orderSchema = z.object({
  id: prefixedId("PF"),
  accountId: prefixedId("AC").nullable(),
  contactId: z.string().nullable(),
  leadId: prefixedId("LD").nullable(),
  line: z.enum(ORDER_LINES),
  stage: z.number().int().min(1).max(11),
  status: z.enum(ORDER_STATUSES),
  discPct: z.number().int().min(0).max(100),
  discAmt: z.number().int().nonnegative(),
  ship: z.number().int().nonnegative(),
  install: z.number().int().nonnegative(),
  noVat: z.boolean(),
  validDays: z.number().int().nonnegative(),
  note: z.string().max(2048),
  preset: z.string(),
  skipped: z.unknown(),
  planBuilder: z.unknown(),
  backNote: z.unknown(),
  smOk: z.unknown(),
  mgrOk: z.unknown(),
  due: z.number().int().nonnegative(),
  stageAt: z.number().int().nonnegative(),
  times: z.unknown(),
  sent: z.unknown(),
  prod: z.unknown(),
  prep: z.unknown(),
  delivered: z.unknown(),
  agreed: z.unknown(),
  cancelReason: z.string().nullable(),
  ownerId: z.string().nullable(),
  createdById: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

const itemSchema = z.object({
  id: z.string().min(1),
  orderId: prefixedId("PF"),
  productId: z.string().min(1),
  qty: z.number().int().nonnegative(),
  price: z.number().int().nonnegative(),
  discount: z.number().int().min(0).max(100),
  color: z.string(),
});

const paymentSchema = z.object({
  id: z.string().min(1),
  orderId: prefixedId("PF"),
  kind: z.enum(["cash", "card"]),
  amount: z.number().int().nonnegative(),
  date: z.string().regex(/^\d{4}\/\d{2}\/\d{2}$/),
  void: z.boolean(),
  note: z.string(),
  byUserId: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
});

const chequeSchema = z.object({
  id: z.string().min(1),
  orderId: prefixedId("PF"),
  sayad: z.string(),
  amount: z.number().int().nonnegative(),
  due: z.string().regex(/^\d{4}\/\d{2}\/\d{2}$/),
  status: z.enum(CHEQUE_STATUSES),
  bank: z.string(),
  owner: z.string(),
  note: z.string(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

const stageLogSchema = z.object({
  id: z.string().min(1),
  orderId: prefixedId("PF"),
  fromStage: z.number().int().min(1).max(11).nullable(),
  toStage: z.number().int().min(1).max(11),
  at: z.number().int().nonnegative(),
  byUserId: z.string().nullable(),
  note: z.string(),
  kind: z.enum(["stage", "back", "skip", "cancel", "done"]),
});

const handoffSchema = z.object({
  id: prefixedId("TR"),
  orderId: prefixedId("PF"),
  lines: z.unknown(),
  at: z.number().int().nonnegative(),
  byUserId: z.string().nullable(),
  note: z.string(),
});

const buySchema = z.object({
  id: prefixedId("BY"),
  supplierId: z.string().nullable(),
  status: z.enum(BUY_STATUSES as readonly [string, ...string[]]),
  total: z.number().int().nonnegative(),
  note: z.string(),
  createdBy: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

const buyItemSchema = z.object({
  id: z.string().min(1),
  buyId: prefixedId("BY"),
  materialId: z.string().min(1),
  qty: z.number().nonnegative(),
  price: z.number().int().nonnegative(),
});

const buyChequeSchema = z.object({
  id: z.string().min(1),
  buyId: prefixedId("BY"),
  amount: z.number().int().nonnegative(),
  due: z.string().regex(/^\d{4}\/\d{2}\/\d{2}$/),
  sayad: z.string().nullable(),
  status: z.enum(["issued", "paid"]),
});

const buyStatusLogSchema = z.object({
  id: z.string().min(1),
  buyId: prefixedId("BY"),
  fromStatus: z.string().nullable(),
  toStatus: z.string(),
  at: z.number().int().nonnegative(),
  byUserId: z.string().nullable(),
  note: z.string().nullable(),
});

const jobSchema = z.object({
  id: prefixedId("PJ"),
  productId: z.string().min(1),
  qty: z.number().nonnegative(),
  color: z.string().nullable(),
  end: z.number().int().nullable(),
  status: z.enum(JOB_STATUS as readonly [string, ...string[]]),
  good: z.number().nullable(),
  waste: z.number().nullable(),
  startedAt: z.number().int().nullable(),
  qcAt: z.number().int().nullable(),
  recvQty: z.number().nullable(),
  recvAt: z.number().int().nullable(),
  bomSnapshot: z.unknown(),
  createdBy: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

const moveSchema = z.object({
  id: z.string().min(1),
  wh: z.enum(["raw", "depot"]),
  item: z.string().min(1),
  qty: z.number(),
  kind: z.enum(MOVE_KINDS),
  ref: z.string().nullable(),
  at: z.number().int().nonnegative(),
  byUserId: z.string().nullable(),
  note: z.string(),
});

/** نتیجه اعتبارسنجی. */
export type ValidationResult = {
  rejected: RejectedRecord[];
  /** ارجاع‌های نرم ناموجود که به null تبدیل و گزارش شدند. */
  referentialIssues: { collection: string; id: string; ref: string; kind: string }[];
};

/**
 * اعتبارسنجی کامل داده نقشه‌شده.
 *
 * @param data خروجی map.ts (تغییر درجا روی ارجاع‌های نرم انجام می‌شود — null شدن)
 */
export function validateMapped(data: MappedData, ids: {
  accountIds: Set<string>;
  contactIds: Set<string>;
  productIds: Set<string>;
  materialIds: Set<string>;
  supplierIds: Set<string>;
  userIds: Set<string>;
  leadIds: Set<string>;
  orderIds: Set<string>;
  buyIds: Set<string>;
  jobIds: Set<string>;
}): ValidationResult {
  const rejected: RejectedRecord[] = [];
  const referentialIssues: ValidationResult["referentialIssues"] = [];

  const check = <T>(rows: T[], schema: z.ZodType<T>, collection: string, rejectRow: (row: T) => string): void => {
    for (const row of rows) {
      const result = schema.safeParse(row);
      if (!result.success) {
        rejected.push({
          collection,
          id: rejectRow(row),
          step: "validate",
          reason: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("؛ "),
        });
      }
    }
  };

  // --- اسکماها ---
  check(data.accounts, accountSchema, "accounts", (r) => r.id);
  check(data.phones, phoneSchema, "account_phones", (r) => r.id);
  check(data.contacts, contactSchema, "account_contacts", (r) => r.id);
  check(data.leads, leadSchema, "leads", (r) => r.id);
  check(data.followups, followupSchema, "lead_followups", (r) => r.id);
  check(data.orders, orderSchema, "orders", (r) => r.id);
  check(data.items, itemSchema, "order_items", (r) => r.id);
  check(data.payments, paymentSchema, "order_payments", (r) => r.id);
  check(data.cheques, chequeSchema, "order_cheques", (r) => r.id);
  check(data.stageLogs, stageLogSchema, "order_stage_log", (r) => r.id);
  check(data.handoffs, handoffSchema, "order_handoffs", (r) => r.id);
  check(data.buys, buySchema, "buys", (r) => r.id);
  check(data.buyItems, buyItemSchema, "buy_items", (r) => r.id);
  check(data.buyCheques, buyChequeSchema, "buy_cheques", (r) => r.id);
  check(data.buyStatusLogs, buyStatusLogSchema, "buy_status_log", (r) => r.id);
  check(data.jobs, jobSchema, "jobs", (r) => r.id);
  check(data.moves, moveSchema, "moves", (r) => r.id);

  // --- ارجاعات اجباری (رد رکورد در صورت گسست) ---

  for (const lead of data.leads) {
    if (lead.accountId !== null && !ids.accountIds.has(lead.accountId)) {
      rejected.push({ collection: "leads", id: lead.id, step: "validate", reason: `حساب مرجع وجود ندارد: ${lead.accountId}` });
    }
  }
  for (const order of data.orders) {
    if (order.accountId !== null && !ids.accountIds.has(order.accountId)) {
      rejected.push({ collection: "orders", id: order.id, step: "validate", reason: `حساب مرجع وجود ندارد: ${order.accountId}` });
    }
    if (order.contactId !== null && !ids.contactIds.has(order.contactId)) {
      rejected.push({ collection: "orders", id: order.id, step: "validate", reason: `مخاطب مرجع وجود ندارد: ${order.contactId}` });
    }
    if (order.leadId !== null && !ids.leadIds.has(order.leadId)) {
      rejected.push({ collection: "orders", id: order.id, step: "validate", reason: `سرنخ مرجع وجود ندارد: ${order.leadId}` });
    }
  }
  for (const it of data.items) {
    if (!ids.productIds.has(it.productId)) {
      rejected.push({ collection: "order_items", id: it.id, step: "validate", reason: `محصول مرجع وجود ندارد: ${it.productId}` });
    }
  }
  for (const li of data.buyItems) {
    if (!ids.materialIds.has(li.materialId)) {
      rejected.push({ collection: "buy_items", id: li.id, step: "validate", reason: `ماده مرجع وجود ندارد: ${li.materialId}` });
    }
  }
  for (const b of data.buys) {
    if (b.supplierId !== null && !ids.supplierIds.has(b.supplierId)) {
      // تأمین‌کننده اختیاری است — null شدن گزارش می‌شود (نه رد).
      referentialIssues.push({ collection: "buys", id: b.id, ref: b.supplierId, kind: "supplierId" });
      b.supplierId = null;
    }
  }
  for (const j of data.jobs) {
    if (!ids.productIds.has(j.productId)) {
      rejected.push({ collection: "jobs", id: j.id, step: "validate", reason: `محصول مرجع وجود ندارد: ${j.productId}` });
    }
  }

  // --- ارجاعات نرم کاربر (null شدن + گزارش شفاف) ---
  const softUserRefs: { value: string | null; collection: string; id: string }[] = [];
  for (const l of data.leads) softUserRefs.push({ value: l.ownerId, collection: "leads", id: l.id });
  for (const f of data.followups) softUserRefs.push({ value: f.byUserId, collection: "lead_followups", id: `${f.leadId}/${f.id}` });
  for (const o of data.orders) {
    softUserRefs.push({ value: o.ownerId, collection: "orders", id: o.id });
    softUserRefs.push({ value: o.createdById, collection: "orders", id: o.id });
  }
  for (const sl of data.stageLogs) softUserRefs.push({ value: sl.byUserId, collection: "order_stage_log", id: sl.orderId });
  for (const p of data.payments) softUserRefs.push({ value: p.byUserId, collection: "order_payments", id: p.orderId });
  for (const b of data.buys) softUserRefs.push({ value: b.createdBy, collection: "buys", id: b.id });
  for (const sl of data.buyStatusLogs) softUserRefs.push({ value: sl.byUserId, collection: "buy_status_log", id: sl.buyId });
  for (const mv of data.moves) softUserRefs.push({ value: mv.byUserId, collection: "moves", id: mv.id });

  // Demo کاربر «sys» (سیستی) دارد که در مدل هدف وجود ندارد — core.js:127.
  for (const ref of softUserRefs) {
    if (ref.value !== null && !ids.userIds.has(ref.value)) {
      referentialIssues.push({ collection: ref.collection, id: ref.id, ref: ref.value, kind: "byUserId/owner" });
    }
  }
  for (const l of data.leads) if (l.ownerId !== null && !ids.userIds.has(l.ownerId)) l.ownerId = null;
  for (const o of data.orders) {
    if (o.ownerId !== null && !ids.userIds.has(o.ownerId)) o.ownerId = null;
    if (o.createdById !== null && !ids.userIds.has(o.createdById)) o.createdById = null;
  }
  for (const f of data.followups) if (f.byUserId !== null && !ids.userIds.has(f.byUserId)) f.byUserId = null;
  for (const sl of data.stageLogs) if (sl.byUserId !== null && !ids.userIds.has(sl.byUserId)) sl.byUserId = null;
  for (const p of data.payments) if (p.byUserId !== null && !ids.userIds.has(p.byUserId)) p.byUserId = null;
  for (const b of data.buys) if (!ids.userIds.has(b.createdBy)) b.createdBy = [...ids.userIds][0] ?? "u1";
  for (const sl of data.buyStatusLogs) if (sl.byUserId !== null && !ids.userIds.has(sl.byUserId)) sl.byUserId = null;
  for (const mv of data.moves) if (mv.byUserId !== null && !ids.userIds.has(mv.byUserId)) mv.byUserId = null;

  // --- شناسه‌های تکراری ---
  const dup = <T extends { id: string }>(rows: T[], collection: string): void => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.id)) {
        rejected.push({ collection, id: row.id, step: "validate", reason: "شناسه تکراری" });
      }
      seen.add(row.id);
    }
  };
  dup(data.accounts, "accounts");
  dup(data.leads, "leads");
  dup(data.orders, "orders");
  dup(data.buys, "buys");
  dup(data.jobs, "jobs");
  dup(data.moves, "moves");

  return { rejected, referentialIssues };
}
