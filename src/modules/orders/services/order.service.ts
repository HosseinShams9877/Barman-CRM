/**
 * سرویس سفارش‌ها — منطق کسب‌وکار خط لوله ۱۱ مرحله‌ای (CD-04 گام ۴).
 *
 * قوانین کسب‌کار (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - محاسبه مبالغ calc(o): sub → disc → extra → net → vat → total
 *    (app/core.js:231-240). مبالغ محاسبه می‌شوند، نه ذخیره‌شده (CD-29).
 *  - ماتریس مجوز جابه‌جایی مرحله can(o,r) — app/core.js:182-189:
 *      closed/cancelled → هیچ کاری نمی‌شود؛
 *      management → همه کارها؛
 *      مرحله ۵ (pay) → فقط finance؛
 *      مرحله با who = sales → خود مالک یا salesManager؛
 *      در غیر این صورت فقط نقش who.
 *  - لغو: stage ≤ ۵ توسط management/salesManager/salesِ مالک (canCancel —
 *    order.js:59) و با دلیل اجباری.
 *  - ارسال برای تأیید بر اساس نقش: sales → ۲، salesManager → ۳، بقیه → ۴
 *    (order.js:271-273).
 *  - بازگشت برای اصلاح: ۲/۳ → ۱ با یادداشت (data-rvgo back — order.js:698).
 *  - قطعی‌سازی (finalize — order.js:452-472): نحوه توافق اجباری
 *    (AGREED_HOW — order.js:391)؛ برنامه پرداخت باید با کل تسویه شود
 *    (|total − sum| < ۱ — order.js:147 ok4)؛ سفارش تولیدی → مرحله ۶،
 *    سفارش نمایندگی → پرش ۶/۷/۸ و مرحله ۹ (order.js:470-471).
 *  - پذیرش تولید: تاریخ پایان ≥ شروع (order.js:719).
 *  - کنترل کیفیت: تولید + ضایعات با دلیل، صدور سند تحویل TR-
 *    (qcok — order.js:728-747).
 *  - آماده‌سازی: همه چک‌لیست‌ها باید تیک بخورند (order.js:562).
 *  - تحویل: نام تحویل‌گیرنده اجباری، سفارش بسته می‌شود (order.js:573-576).
 *  - سقف تخفیف سه‌حالته CD-25 (order.js:143 + دستور مالک فاز ۴):
 *      cap = null → نامحدود؛ cap = 0 → بدون تخفیف؛ cap > 0 → سقف درصد.
 *      cap منفی نامعتبر است و در اعتبارسنجی رد می‌شود.
 *  - noMoney (R-32 / app/order.js:11): نقش‌های بدون money.view نسخه
 *    بدون فیلد پولی دریافت می‌کنند و ورودی‌های پولی تاریخچه فیلتر می‌شوند
 *    (MONEY_RE — order.js:606-607).
 *  - محدودیت PHASE_04 §۶: جمع payments + چک‌های تأییدشده نباید از کل
 *    تجاوز کند — در registerPayment / registerCheque بررسی می‌شود.
 */
import { z } from "zod";
import { ORDER_BUCKETS } from "../constants/buckets";
import { isIncompleteCheque } from "../lib/cheque";
import { ROLE_TASKS, matchesTask } from "@modules/home/constants/tasks";
import { instantToJalaliIso, startOfToday } from "@core/calendar";
import { prisma } from "@core/database/client";
import { nextPrefixedId, newMoveId } from "@core/database";
import { badRequest, conflict, forbidden, notFound } from "@core/errors";
import type { Role } from "@core/permissions";
import { getSettings, type DiscountCapMap } from "@modules/settings";
import { Prisma } from "@prisma/client";
import { computeOnHand } from "@modules/inventory/services/stock.service";
import { signedQty } from "@modules/inventory/lib/kinds";
import { round3 } from "@modules/production/services/bom.service";
import {
  getStage,
  ORDER_STAGES,
  ORDER_STATUS_LABELS,
  stageDueMs,
  stageWho,
  type OrderStageKey,
  type StageOwnerRole,
} from "../constants";
import type {
  OrderCalc,
  OrderDetail,
  OrderDetailNoMoney,
  OrderItemRow,
  OrderItemRowNoMoney,
  OrderListParams,
  OrderListResult,
  OrderListItem,
  OrderListItemNoMoney,
  PaymentRow,
  ChequeRow,
  StageLogRow,
  HandoffRow,
} from "../types/order.types";
import type {
  createOrderSchema,
  StageAction,
  updateOrderSchema,
} from "../schemas/order.schema";
import {
  generatePlan,
  presetToParams,
  type PlanParams,
} from "./planGenerator";
import { PAYMENT_PRESETS } from "../constants";

type CreateInput = z.infer<typeof createOrderSchema>;
type UpdateInput = z.infer<typeof updateOrderSchema>;

/** هویت اجراکننده — از نشست ساخته می‌شود (CD-04 گام ۱/۲). */
export type Actor = {
  userId: string;
  roles: Role[];
};

/**
 * محدوده دید لیست سفارش‌ها — مشابه سرنخ‌ها (leads ALLV — app/leads.js:15):
 * نقش sales فقط سفارش‌های خودش را می‌بیند (تعیین در Route Handler).
 */
export type OrderListScope = {
  role?: Role;
  restrictToOwner: boolean;
  userId: string;
};

// --- محاسبه مبالغ (calc(o) — core.js:231-240) -----------------------------

type ItemRow = { qty: number; price: number; discount: number };

/**
 * محاسبه مبالغ سفارش — پیاده‌سازی calc(o) در Demo (app/core.js:231-240).
 *
 *   sub   = Σ qty × price                        (با کسر تخفیف هر قلم)
 *   disc  = round(sub × discPct / 100) + discAmt
 *   extra = ship + install
 *   net   = sub − disc + extra
 *   vat   = noVat ? 0 : round(net × S.vat / 100)
 *   total = net + vat
 *
 * تخفیف هر قلم (PHASE_04 §۶) داخل sub اعمال می‌شود — انحراف کوچک از
 * Demo که تخفیف قلم نداشت (در گزارش فاز ۴ ثبت می‌شود).
 */
export function calcOrder(
  items: ItemRow[],
  opts: { discPct: number; discAmt: number; ship: number; install: number; noVat: boolean; vat: number },
): OrderCalc {
  const sub = items.reduce((acc, it) => acc + itemGross(it), 0);
  const disc = Math.round((sub * clamp0to100(opts.discPct)) / 100) + Math.max(0, opts.discAmt);
  const extra = Math.max(0, opts.ship) + Math.max(0, opts.install);
  const net = Math.max(0, sub - disc) + extra;
  const vat = opts.noVat ? 0 : Math.round((net * clamp0to100(opts.vat)) / 100);
  const total = net + vat;
  return { sub, disc, extra, net, vat, total };
}

/** ارزش ناخالص یک قلم — تخفیف قلم اعمال‌شده. */
function itemGross(it: ItemRow): number {
  const gross = it.qty * it.price;
  const d = clamp0to100(it.discount);
  return d > 0 ? Math.round(gross * (1 - d / 100)) : gross;
}

function clamp0to100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

// --- سقف تخفیف سه‌حالته (CD-25 — order.js:143) ------------------------------

/**
 * سقف مؤثر تخفیف برای کاربر — بیشترین سقف بین نقش‌های او.
 * نقشی که در discountCap نباشد سقف ۰ دارد (order.js:143).
 * `null` یعنی نامحدود.
 */
export function effectiveDiscountCap(caps: DiscountCapMap | null, roles: Role[]): number | null {
  if (caps === null) return null; // کل ستون null → نامحدود (CD-25)
  let max: number | null = null;
  let seen = false;
  for (const role of roles) {
    const cap = caps[role];
    if (cap === undefined) continue;
    seen = true;
    if (cap === null) return null;
    max = max === null || cap > max ? cap : max;
  }
  return seen ? max : 0;
}

/**
 * اجرای سقف تخفیف در سرور — سه حالت CD-25.
 *
 * @throws badRequest اگر تخفیف از سقف بیشتر باشد یا سقف منفی باشد.
 */
export function assertDiscountCap(discPct: number, caps: DiscountCapMap | null, roles: Role[]): void {
  const cap = effectiveDiscountCap(caps, roles);
  if (cap !== null && cap < 0) {
    throw badRequest("تنظیمات سقف تخفیف نامعتبر است.");
  }
  if (cap === null) return; // نامحدود
  if (cap === 0 && discPct > 0) {
    throw badRequest("تخفیف مجاز نیست (سقف تخفیف صفر).");
  }
  if (discPct > cap) {
    throw badRequest("تخفیف از سقف مجاز بیشتر است.");
  }
}

// --- ماتریس جابه‌جایی مرحله (can(o,r) — core.js:182-189) --------------------

/** آیا این نقش می‌تواند اقدام این مرحله را انجام دهد؟ (چندنقشی — هرکافی) */
export function canActOnStage(order: { status: string; stage: number; ownerId: string | null }, roles: Role[], actorId: string): boolean {
  if (order.status !== "open") return false; // closed/cancelled → همه غیرفعال
  if (roles.includes("management") || roles.includes("admin")) return true;
  const stageKey = stageKeyOf(order.stage);
  if (stageKey === null) return false;
  if (order.stage === 5) {
    return roles.includes("finance");
  }
  const who: StageOwnerRole = stageWho(stageKey);
  if (who === "sales") {
    return (roles.includes("sales") && order.ownerId === actorId) || roles.includes("salesManager");
  }
  return roles.includes(who);
}

// --- کمک‌ها ----------------------------------------------------------------

const MONEY_RE = /ریال|تومان|چک|واریز|پرداخت|پیش‌فاکتور|پیش فاکتور|تخفیف|قیمت|مبلغ/;

/** شماره مرحله → کلید مرحله. */
function stageKeyOf(step: number): OrderStageKey | null {
  const s = ORDER_STAGES.find((x) => x.step === step);
  return s ? s.key : null;
}

/** مرحله بعدی — null اگر آخرین مرحله باشد. */
function nextStep(step: number): number | null {
  const nxt = ORDER_STAGES.find((x) => x.step === step + 1);
  return nxt ? nxt.step : null;
}

function assertOpen(row: { status: string; id: string }): void {
  if (row.status === "cancelled") throw badRequest("سفارش لغو شده است.");
  if (row.status === "done") throw badRequest("سفارش بسته شده است.");
}

/**
 * رکورد لیست — فقط روابطی که آیتم لیست به آن نیاز دارد (حساب، مالک،
 * اقلام برای محاسبه، پرداخت/چک برای paid). تاریخچه و اسناد تحویل در لیست
 * بارگذاری نمی‌شوند (CD-09 — بار اضافی).
 */
type ListRow = Prisma.OrderGetPayload<{
  include: {
    account: { select: { name: true } };
    contact: { select: { name: true } };
    owner: { select: { name: true } };
    items: { include: { product: { select: { name: true; code: true; unit: true } } } };
    payments: { include: { by: { select: { name: true } } } };
    cheques: true;
  };
}>;

/**
 * رکورد جزئیات — مثل ListRow به‌علاوه تاریخچه مراحل و اسناد تحویل.
 *
 * نکته: `OrderHandoff` در schema رابطه‌ی `by User?` ندارد (تنها `byUserId`)،
 * بنابراین نام ثبت‌کننده با کوئری مجزا حل می‌شود (resolveHandoffNames).
 */
type OrderRow = Prisma.OrderGetPayload<{
  include: {
    account: { select: { name: true } };
    contact: { select: { name: true } };
    owner: { select: { name: true } };
    items: { include: { product: { select: { name: true; code: true; unit: true } } } };
    payments: { include: { by: { select: { name: true } } } };
    cheques: true;
    stageLog: { include: { by: { select: { name: true } } } };
    handoffs: true;
  };
}>;

/** تبدیل رکورد Prisma به آیتم لیست (نسخه کامل). */
function toListItem(row: ListRow, settings: { vat: number }): OrderListItem {
  const calc = calcOrder(row.items, {
    discPct: row.discPct,
    discAmt: row.discAmt,
    ship: row.ship,
    install: row.install,
    noVat: row.noVat,
    vat: settings.vat,
  });
  const paid = paidOf(row);
  const key = stageKeyOf(row.stage);
  return {
    id: row.id,
    stage: row.stage,
    stageKey: key ?? "draft",
    status: row.status as OrderListItem["status"],
    line: row.line as "prod" | "agency",
    accountId: row.accountId,
    accountName: row.account?.name ?? null,
    contactName: row.contact?.name ?? null,
    leadId: row.leadId,
    ownerId: row.ownerId,
    ownerName: row.owner?.name ?? null,
    discPct: row.discPct,
    calc,
    paid,
    balance: calc.total - paid,
    itemCount: row.items.length,
    dueDate: Number(row.due) > 0 ? isoFromUtc(Number(row.due)) : null,
    stageAt: Number(row.stageAt),
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
  };
}

/** جمع پرداخت‌های باطل‌نشده + چک‌های تأییدشده (paid — core.js:245-250). */
function paidOf(row: { payments: { void: boolean; amount: number }[]; cheques: { status: string; amount: number }[] }): number {
  const paySum = row.payments.filter((p) => !p.void).reduce((a, p) => a + p.amount, 0);
  const chqSum = row.cheques.filter((c) => c.status === "clear").reduce((a, c) => a + c.amount, 0);
  return paySum + chqSum;
}

/** تبدیل UTC ms به تاریخ خالص `YYYY/MM/DD` (CD-06) — بدون Intl. */
function isoFromUtc(ms: number): string | null {
  if (ms <= 0) return null;
  return instantToJalaliIso(ms);
}

// --- لیست -------------------------------------------------------------------

export async function listOrders(
  params: OrderListParams,
  scope: OrderListScope,
  hideMoney: boolean,
): Promise<OrderListResult> {
  const where: Prisma.OrderWhereInput = {};
  if (params.stage !== null) where.stage = params.stage;
  if (params.status !== null) where.status = params.status;
  const bucket = ORDER_BUCKETS.find((b) => b.key === params.bucket);
  if (bucket) { where.stage = { in: [...bucket.stages] }; where.status = "open"; }
  if (params.bucket === "mine" || params.incomplete) where.status = "open";
  if (params.overdue) where.due = { lt: BigInt(Date.now()) };
  if (scope.restrictToOwner) {
    where.ownerId = scope.userId;
  } else if (params.ownerId !== null) {
    where.ownerId = params.ownerId;
  }
  if (params.q.length > 0) {
    where.OR = [
      { id: { contains: params.q } },
      { account: { name: { contains: params.q } } },
      { account: { contacts: { some: { name: { contains: params.q } } } } },
    ];
  }

  if (params.incomplete || params.bucket === "mine") {
    const candidates = await prisma.order.findMany({ where, select: { id: true, stage: true, ownerId: true, due: true, cheques: true } });
    const tasks = scope.role ? ROLE_TASKS[scope.role].filter((t) => !t.info) : [];
    where.id = { in: candidates.filter((o) => {
      const incompleteCheques = o.cheques.filter(isIncompleteCheque).length;
      if (params.incomplete && !(o.stage >= 6 && incompleteCheques > 0)) return false;
      return params.bucket !== "mine" || tasks.some((task) => matchesTask({ id: o.id, stage: o.stage, ownerId: o.ownerId, due: Number(o.due), customer: "", incompleteCheques }, task, scope.userId, Date.now()));
    }).map((o) => o.id) };
  }

  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        account: { select: { name: true } },
        contact: { select: { name: true } },
        owner: { select: { name: true } },
        items: { include: { product: { select: { name: true, code: true, unit: true } } } },
        payments: { include: { by: { select: { name: true } } } },
        cheques: true,
      },
    }),
  ]);

  const settings = await getSettings();
  const items = rows.map((r) => stripListItem(toListItem(r, settings), hideMoney));
  return { items, total, page: params.page, pageSize: params.pageSize };
}

/** حذف فیلدهای پولی برای نقش‌های noMoney (R-32). */
function stripListItem(item: OrderListItem, hideMoney: boolean): OrderListItem | OrderListItemNoMoney {
  if (!hideMoney) return item;
  // تخریب واقعی نه فقط Type-cast — وگرنه فیلدها در JSON باقی می‌مانند (R-32).
  const { calc, paid, balance, discPct, ...rest } = item;
  void calc;
  void paid;
  void balance;
  void discPct;
  return rest as OrderListItemNoMoney;
}

// --- جزئیات -----------------------------------------------------------------

export async function getOrder(id: string, hideMoney: boolean): Promise<OrderDetail | OrderDetailNoMoney> {
  const row = await prisma.order.findUnique({
    where: { id },
    include: {
      account: { select: { name: true } },
      contact: { select: { name: true } },
      owner: { select: { name: true } },
      items: { include: { product: { select: { name: true, code: true, unit: true } } } },
      payments: { include: { by: { select: { name: true } } } },
      cheques: true,
      stageLog: { orderBy: [{ at: "desc" }], include: { by: { select: { name: true } } } },
      handoffs: { orderBy: [{ at: "desc" }] },
    },
  });
  if (!row) throw notFound("سفارش مورد نظر پیدا نشد.");

  const settings = await getSettings();
  const handoffNames = await resolveHandoffNames(row.handoffs);
  const base = toListItem(row, settings);
  const stageKey = stageKeyOf(row.stage) ?? "draft";

  const detail: OrderDetail = {
    ...base,
    note: row.note,
    validDays: row.validDays,
    noVat: row.noVat,
    ship: row.ship,
    install: row.install,
    discAmt: row.discAmt,
    preset: row.preset,
    skipped: asNumberArray(row.skipped),
    backNote: asBackNote(row.backNote),
    smOk: asOk(row.smOk),
    mgrOk: asOk(row.mgrOk),
    times: asTimes(row.times),
    sent: asSent(row.sent),
    prod: asProd(row.prod),
    prep: asPrep(row.prep),
    delivered: asDelivered(row.delivered),
    agreed: asAgreed(row.agreed),
    cancelReason: row.cancelReason,
    items: row.items.map(toItemRow),
    payments: row.payments.map(toPaymentRow),
    cheques: row.cheques.map(toChequeRow),
    stageLog: row.stageLog.map(toStageLogRow),
    handoffs: row.handoffs.map((h) => toHandoffRow(h, handoffNames.get(h.byUserId ?? "") ?? null)),
    stageWho: stageWho(stageKey),
    stageDue: stageDueMs(stageKey),
  };

  if (!hideMoney) return detail;
  return stripDetail(detail);
}

/** حذف فیلدهای پولی از جزئیات + اقلام + فیلتر ورودی‌های پولی تاریخچه. */
function stripDetail(detail: OrderDetail): OrderDetailNoMoney {
  const { calc, paid, balance, discPct, discAmt, ship, install, ...rest } = detail;
  const items = detail.items.map((it) => {
    const { price, discount, ...restItem } = it;
    return restItem as OrderItemRowNoMoney;
  });
  const payments = detail.payments.map(({ amount, ...payment }) => {
    void amount;
    return payment;
  });
  const cheques = detail.cheques.map(({ amount, ...cheque }) => {
    void amount;
    return cheque;
  });
  const stageLog = detail.stageLog.filter((l) => !MONEY_RE.test(l.note));
  return { ...rest, items, payments, cheques, stageLog };
}

function toItemRow(it: OrderRow["items"][number]): OrderItemRow {
  return {
    id: it.id,
    productId: it.productId,
    productName: it.product.name,
    productCode: it.product.code,
    unit: it.product.unit,
    qty: it.qty,
    price: it.price,
    discount: it.discount,
    color: it.color,
  };
}

function toPaymentRow(p: OrderRow["payments"][number]): PaymentRow {
  return {
    id: p.id,
    kind: p.kind as "cash" | "card",
    amount: p.amount,
    date: p.date,
    void: p.void,
    note: p.note,
    byName: p.by?.name ?? null,
    createdAt: Number(p.createdAt),
  };
}

function toChequeRow(c: OrderRow["cheques"][number]): ChequeRow {
  return {
    id: c.id,
    sayad: c.sayad,
    amount: c.amount,
    due: c.due,
    status: c.status as ChequeRow["status"],
    bank: c.bank,
    owner: c.owner,
    note: c.note,
    createdAt: Number(c.createdAt),
    updatedAt: Number(c.updatedAt),
  };
}

function toStageLogRow(l: OrderRow["stageLog"][number]): StageLogRow {
  return {
    id: l.id,
    fromStage: l.fromStage,
    toStage: l.toStage,
    at: Number(l.at),
    byName: l.by?.name ?? null,
    note: l.note,
    kind: l.kind,
  };
}

/**
 * حل نام ثبت‌کننده‌ی اسناد تحویل — `OrderHandoff` فقط `byUserId` دارد
 * (رابطه‌ی `by` در schema تعریف نشده)، بنابراین نام‌ها با یک کوئری
 * مجزای کاربر حل می‌شوند.
 */
async function resolveHandoffNames(
  handoffs: { byUserId: string | null }[],
): Promise<Map<string, string>> {
  const ids = [...new Set(handoffs.map((h) => h.byUserId).filter((x): x is string => x !== null))];
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name]));
}

function toHandoffRow(h: OrderRow["handoffs"][number], byName: string | null): HandoffRow {
  return {
    id: h.id,
    lines: Array.isArray(h.lines) ? (h.lines as HandoffRow["lines"]) : [],
    at: Number(h.at),
    byName,
    note: h.note,
  };
}

// --- ایجاد / ویرایش -----------------------------------------------------------

/**
 * ایجاد پیش‌فاکتور — شناسه PF-<n> (X.nextId("PF") — core.js:364)، مرحله ۱.
 *
 * سقف تخفیف در زمان ایجاد با نقش ایجادکننده بررسی می‌شود (CD-25).
 *
 * `leadId` اگر داده شود: تبدیل سرنخ به پیش‌فاکتور (app/leads.js) —
 * سرنخ به مرحله "won" منتقل نمی‌شود چون معادل آن در این فاز تعریف نشده
 * (انحراف مستند شده در گزارش فاز ۴).
 */
export async function createOrder(input: CreateInput, actor: Actor): Promise<OrderDetail | OrderDetailNoMoney> {
  const settings = await getSettings();
  assertDiscountCap(input.discPct, settings.discountCap, actor.roles);

  const productIds = input.items.map((it) => it.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } });
  if (products.length !== new Set(productIds).size) {
    throw badRequest("یک یا چند محصول پیدا نشد.");
  }

  // شناسه‌های تمام سفارش‌ها (بدون فیلتر وضعیت) — شمارنده تک‌منهای Demo
  // (X.nextId در core.js:365 شمارنده را در meta.seq نگه می‌دارد و به وضعیت
  // سفارش وابسته نیست). فیلتر کردن فقط سفارش‌های open باعث می‌شد پس از
  // done/cancel شدن، شناسه تکراری تولید شود و کانسترینت یکتایی نقض گردد.
  const existing = await prisma.order.findMany({ select: { id: true } });
  const id = nextPrefixedId("PF", existing.map((o) => o.id));
  const now = Date.now();
  const stage1: OrderStageKey = "draft";

  await prisma.$transaction(async (tx) => {
    await tx.order.create({
      data: {
        id,
        accountId: input.accountId ?? null,
        contactId: input.contactId ?? null,
        leadId: input.leadId ?? null,
        line: input.line,
        stage: 1,
        status: "open",
        discPct: input.discPct,
        discAmt: input.discAmt,
        ship: input.ship,
        install: input.install,
        noVat: input.noVat,
        validDays: input.validDays,
        note: input.note,
        preset: input.preset,
        ownerId: input.ownerId ?? actor.userId,
        createdById: actor.userId,
        due: now + stageDueMs(stage1),
        stageAt: now,
        times: { draft: now },
        createdAt: now,
        updatedAt: now,
        items: {
          create: input.items.map((it) => ({
            productId: it.productId,
            qty: it.qty,
            price: it.price,
            discount: it.discount,
            color: it.color,
          })),
        },
      },
    });
    await tx.orderStageLog.create({
      data: {
        orderId: id,
        fromStage: null,
        toStage: 1,
        at: now,
        byUserId: actor.userId,
        note: "ثبت پیش‌فاکتور",
        kind: "stage",
      },
    });
  });

  return getOrder(id, false);
}

/**
 * ویرایش پیش‌فاکتور — فقط در مراحل قابل ویرایش (stage ≤ ۵ و open).
 * `undefined` یعنی «تغییر نده».
 */
export async function updateOrder(
  id: string,
  input: UpdateInput,
  actor: Actor,
  hideMoney: boolean,
): Promise<OrderDetail | OrderDetailNoMoney> {
  const row = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!row) throw notFound("سفارش مورد نظر پیدا نشد.");
  assertOpen(row);
  if (row.stage > 5) {
    throw badRequest("در این مرحله ویرایش سفارش ممکن نیست.");
  }

  const settings = await getSettings();
  const nextDiscPct = input.discPct ?? row.discPct;
  if (input.discPct !== undefined || input.discAmt !== undefined) {
    assertDiscountCap(
      nextDiscPct,
      settings.discountCap,
      actor.roles,
    );
  }

  const data: Prisma.OrderUpdateInput = {};
  if (input.accountId !== undefined) data.account = input.accountId === null ? { disconnect: true } : { connect: { id: input.accountId } };
  if (input.contactId !== undefined) data.contact = input.contactId === null ? { disconnect: true } : { connect: { id: input.contactId } };
  if (input.line !== undefined) data.line = input.line;
  if (input.discPct !== undefined) data.discPct = input.discPct;
  if (input.discAmt !== undefined) data.discAmt = input.discAmt;
  if (input.ship !== undefined) data.ship = input.ship;
  if (input.install !== undefined) data.install = input.install;
  if (input.noVat !== undefined) data.noVat = input.noVat;
  if (input.validDays !== undefined) data.validDays = input.validDays;
  if (input.note !== undefined) data.note = input.note;
  if (input.preset !== undefined) data.preset = input.preset;
  if (input.planBuilder !== undefined) data.planBuilder = input.planBuilder as Prisma.InputJsonValue;
  data.updatedAt = Date.now();

  if (input.items !== undefined) {
    const productIds = input.items.map((it) => it.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } });
    if (products.length !== new Set(productIds).size) {
      throw badRequest("یک یا چند محصول پیدا نشد.");
    }
    data.items = {
      deleteMany: { orderId: id },
      create: input.items.map((it) => ({
        productId: it.productId,
        qty: it.qty,
        price: it.price,
        discount: it.discount,
        color: it.color,
      })),
    };
  }

  await prisma.order.update({ where: { id }, data });
  return getOrder(id, hideMoney);
}

// --- ماشین حالت مرحله -----------------------------------------------------------

/**
 * اجرای اقدام مرحله — معادل data-rvgo / modal actions در Demo.
 *
 * هر انتقال: مهر زمان مرحله (times[stageKey])، stageAt، due = الان + مهلت
 * مرحله جدید (setStage — core.js:171) و یک ورودی OrderStageLog.
 *
 * مجوزها: این تابع `canActOnStage` (core.js:182-189) را اجرا می‌کند —
 * Route Handler قبلاً مجوز `orders.status.change` را بررسی کرده است.
 */
export async function applyStageAction(
  id: string,
  action: StageAction,
  actor: Actor,
  hideMoney: boolean,
): Promise<OrderDetail | OrderDetailNoMoney> {
  const row = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!row) throw notFound("سفارش مورد نظر پیدا نشد.");
  assertOpen(row);

  if (!canActOnStage(row, actor.roles, actor.userId)) {
    throw forbidden("در این مرحله اجازه انجام این کار را ندارید.");
  }

  switch (action.action) {
    case "submit":
      return doSubmit(row, action, actor, hideMoney);
    case "approve":
      return doApprove(row, action, actor, hideMoney);
    case "return":
      return doReturn(row, action, actor, hideMoney);
    case "send":
      return doSend(row, action, actor, hideMoney);
    case "finalize":
      return doFinalize(row, action, actor, hideMoney);
    case "paccept":
      return doPaccept(row, action, actor, hideMoney);
    case "startProduction":
      return doStartProduction(row, actor, hideMoney);
    case "made":
      return doMade(row, action, actor, hideMoney);
    case "qc":
      return doQc(row, action, actor, hideMoney);
    case "receive":
      return doReceive(row, action, actor, hideMoney);
    case "daccept":
      return doDaccept(row, action, actor, hideMoney);
    case "prep":
      return doPrep(row, action, actor, hideMoney);
    case "deliver":
      return doDeliver(row, action, actor, hideMoney);
  }
}

/** نوشتن ورودی تاریخچه مشترک. */
function logEntry(tx: Prisma.TransactionClient, orderId: string, from: number | null, to: number, actor: Actor, note: string, kind: string, now: number) {
  return tx.orderStageLog.create({
    data: { orderId, fromStage: from, toStage: to, at: now, byUserId: actor.userId, note, kind },
  });
}

/**
 * ارسال برای تأیید — نقش تعیین‌کننده مقصد (order.js:271-273):
 * sales → ۲، salesManager → ۳، بقیه → ۴.
 *
 * مشتری در زمان ارسال اجباری است (draftErrors — order.js:217-228).
 */
async function doSubmit(row: Prisma.OrderGetPayload<{ include: { items: true } }>, action: Extract<StageAction, { action: "submit" }>, actor: Actor, hideMoney: boolean) {
  if (row.stage !== 1) throw badRequest("فقط پیش‌فاکتور در مرحله ثبت قابل ارسال است.");

  const accountId = action.accountId ?? row.accountId;
  if (!accountId) {
    throw badRequest("مشتری را انتخاب کنید.");
  }

  let to: number;
  if (actor.roles.includes("sales") && !actor.roles.includes("salesManager")) to = 2;
  else if (actor.roles.includes("salesManager")) to = 3;
  else to = 4;

  const now = Date.now();
  const toKey = stageKeyOf(to);
  const fromKey = stageKeyOf(row.stage);
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: row.id },
      data: {
        accountId,
        stage: to,
        stageAt: now,
        due: now + (toKey ? stageDueMs(toKey) : 0),
        times: { ...asTimes(row.times), ...(fromKey ? { [fromKey]: now } : {}), ...(toKey ? { [toKey]: now } : {}) },
        updatedAt: now,
      },
    });
    await logEntry(tx, row.id, row.stage, to, actor, `ارسال برای تأیید${action.note ? " — " + action.note : ""}`, "stage", now);
  });
  return getOrder(row.id, hideMoney);
}

/** تأیید فروشکه/مدیر — ۲→۳ (smOk) یا ۳→۴ (mgrOk) — data-rvgo ok. */
async function doApprove(row: Prisma.OrderGetPayload<{ include: { items: true } }>, action: Extract<StageAction, { action: "approve" }>, actor: Actor, hideMoney: boolean) {
  const to = nextStep(row.stage);
  if (to === null) throw badRequest("در آخرین مرحله امکان تأیید نیست.");
  if (row.stage === 1) throw badRequest("ابتدا پیش‌فاکتور را ارسال کنید.");
  if (row.stage >= 5) throw badRequest("در این مرحله تأیید معنا ندارد.");

  const now = Date.now();
  const toKey = stageKeyOf(to);
  const fromKey = stageKeyOf(row.stage);
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: row.id },
      data: {
        stage: to,
        stageAt: now,
        due: now + (toKey ? stageDueMs(toKey) : 0),
        times: { ...asTimes(row.times), ...(fromKey ? { [fromKey]: now } : {}), ...(toKey ? { [toKey]: now } : {}) },
        updatedAt: now,
        ...(row.stage === 2 ? { smOk: { by: actor.userId, t: now } } : { mgrOk: { by: actor.userId, t: now } }),
      },
    });
    await logEntry(tx, row.id, row.stage, to, actor, `تأیید شد${action.note ? " — " + action.note : ""}`, "stage", now);
  });
  return getOrder(row.id, hideMoney);
}

/** بازگشت برای اصلاح — ۲/۳ → ۱ با یادداشت (data-rvgo back — order.js:698). */
async function doReturn(row: Prisma.OrderGetPayload<{ include: { items: true } }>, action: Extract<StageAction, { action: "return" }>, actor: Actor, hideMoney: boolean) {
  if (row.stage !== 2 && row.stage !== 3) {
    throw badRequest("فقط مراحل تأیید قابل برگشت هستند.");
  }
  const now = Date.now();
  const text = [action.reason, action.note].filter((x) => x && x.length > 0).join(" — ");
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: row.id },
      data: {
        stage: 1,
        stageAt: now,
        due: now + stageDueMs("draft"),
        times: { ...asTimes(row.times), [stageKeyOf(row.stage) ?? "draft"]: now },
        updatedAt: now,
        backNote: { by: actor.userId, t: now, text },
        // تأییدها پاک می‌شوند — Prisma برای فیلد Json? Requires DbNull
        // به‌جای null تحت الفظی (NullableJsonNullValueInput).
        smOk: row.stage === 2 ? Prisma.DbNull : (row.smOk === null ? Prisma.DbNull : (row.smOk as Prisma.InputJsonValue)),
        mgrOk: Prisma.DbNull,
      },
    });
    await logEntry(tx, row.id, row.stage, 1, actor, `برگشت برای اصلاح — ${text}`, "back", now);
  });
  return getOrder(row.id, hideMoney);
}

/** ارسال پیش‌فاکتور برای مشتری — ۴→۵ (data-sendnow — order.js:708). */
async function doSend(row: Prisma.OrderGetPayload<{ include: { items: true } }>, action: Extract<StageAction, { action: "send" }>, actor: Actor, hideMoney: boolean) {
  if (row.stage !== 4) throw badRequest("ارسال فقط در مرحله «ارسال برای مشتری» ممکن است.");
  const now = Date.now();
  const via = action.via.join("،");
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: row.id },
      data: {
        stage: 5,
        stageAt: now,
        due: now + stageDueMs("pay"),
        times: { ...asTimes(row.times), send: now },
        sent: { via, at: now },
        updatedAt: now,
      },
    });
    await logEntry(tx, row.id, 4, 5, actor, `ارسال پیش‌فاکتور (${via})${action.note ? " — " + action.note : ""}`, "stage", now);
  });
  return getOrder(row.id, hideMoney);
}

/**
 * قطعی‌سازی — ۵→۶ (تولیدی) یا ۵→۹ با پرش ۶/۷/۸ (finalize — order.js:452-472).
 *
 * نحوه توافق اجباری است و برنامه پرداخت باید با کل تسویه شود
 * (|total − sum| < ۱ ریال — order.js:147 ok4). برنامه از preset یا
 * planBuilder ذخیره‌شده تولید می‌شود و در همین تراکنش به payments و
 * cheques تبدیل (materialize) می‌شود.
 */
async function doFinalize(row: Prisma.OrderGetPayload<{ include: { items: true } }>, action: Extract<StageAction, { action: "finalize" }>, actor: Actor, hideMoney: boolean) {
  if (row.stage !== 5) throw badRequest("قطعی‌سازی فقط در مرحله پرداخت ممکن است.");

  const settings = await getSettings();
  const calc = calcOrder(row.items, {
    discPct: row.discPct,
    discAmt: row.discAmt,
    ship: row.ship,
    install: row.install,
    noVat: row.noVat,
    vat: settings.vat,
  });

  const plan = resolvePlan(row, calc.total);
  if (plan.rows.length === 0) {
    throw badRequest("برنامه پرداخت مشخص نیست؛ ابتدا پیش‌تنظیم یا پارامترهای برنامه را تعیین کنید.");
  }
  const diff = Math.abs(calc.total - plan.sum);
  if (diff >= 1) {
    throw badRequest("مجموع برنامه پرداخت با مبلغ کل برابر نیست.");
  }

  const now = Date.now();
  const isProduction = row.line === "prod";
  const to = isProduction ? 6 : 9;
  const skipped = isProduction ? [] : [6, 7, 8];
  const toKey = stageKeyOf(to);
  const howLabel = AGREED_HOW_LABEL(action.agreedHow);
  const planNote = plan.rows.map((r) => `${r.kind === "cheque" ? "چک" : r.kind === "cash" ? "نقد" : "اعتباری"} ${r.due ?? ""}`.trim()).join("، ");

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: row.id },
      data: {
        stage: to,
        stageAt: now,
        due: now + (toKey ? stageDueMs(toKey) : 0),
        times: { ...asTimes(row.times), pay: now, ...(toKey ? { [toKey]: now } : {}) },
        updatedAt: now,
        skipped,
        agreed: { t: now, how: action.agreedHow, note: action.agreedNote },
      },
    });

    // materialize: پرداخت‌ها و چک‌ها (rcInit — order.js:359-363).
    for (const r of plan.rows) {
      if (r.kind === "cash") {
        await tx.orderPayment.create({
          data: {
            orderId: row.id,
            kind: "cash",
            amount: r.amount,
            date: r.due ?? isoToday(),
            note: "پیش‌پرداخت (قطعی‌سازی)",
            byUserId: actor.userId,
            createdAt: now,
          },
        });
      } else if (r.kind === "cheque") {
        await tx.orderCheque.create({
          data: {
            orderId: row.id,
            sayad: "",
            amount: r.amount,
            due: r.due ?? isoToday(),
            status: "hand",
            bank: "",
            owner: "",
            note: "چک برنامه پرداخت",
            createdAt: now,
            updatedAt: now,
          },
        });
      }
      // credit → فقط ثبت در تاریخچه (بعداً تسویه می‌شود).
    }

    if (!isProduction) {
      await logEntry(tx, row.id, 5, 9, actor, "پرش مراحل تولید (سفارش نمایندگی)", "skip", now);
    }
    await logEntry(
      tx,
      row.id,
      5,
      to,
      actor,
      `قطعی شد — توافق: ${howLabel}${action.agreedNote ? " — " + action.agreedNote : ""} — برنامه: ${planNote}`,
      "stage",
      now,
    );
  });

  return getOrder(row.id, hideMoney);
}

/** برنامه پرداخت سفارش — از preset یا planBuilder ذخیره‌شده. */
function resolvePlan(row: Prisma.OrderGetPayload<{ include: { items: true } }>, total: number) {
  const preset = PAYMENT_PRESETS.find((p) => p.key === row.preset);
  if (preset) {
    return generatePlan(presetToParams(preset), total);
  }
  const builder = asPlanBuilder(row.planBuilder);
  if (builder) {
    return generatePlan(builder, total);
  }
  return { preset: "", rows: [], sum: 0 };
}

/** پذیرش و زمان‌بندی تولید — ۶→۷ (paccept — order.js:719). */
async function doPaccept(row: Prisma.OrderGetPayload<{ include: { items: true } }>, action: Extract<StageAction, { action: "paccept" }>, actor: Actor, hideMoney: boolean) {
  if (row.stage !== 6) throw badRequest("پذیرش فقط در مرحله «زمان‌بندی تولید» ممکن است.");
  const now = Date.now();
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: row.id },
      data: {
        stage: 7,
        stageAt: now,
        due: now + stageDueMs("make"),
        times: { ...asTimes(row.times), paccept: now },
        updatedAt: now,
        prod: { start: action.start, end: action.end, acceptedAt: now, startedAt: null, note: action.note ?? "", qc: null },
      },
    });
    await logEntry(tx, row.id, 6, 7, actor, `زمان‌بندی تولید: ${action.start} تا ${action.end}`, "stage", now);
  });
  return getOrder(row.id, hideMoney);
}

/**
 * شروع تولید — ثبت startedAt بدون تغییر مرحله (pstart — order.js:722-726).
 *
 * متصل به حرکت‌های انبار (PHASE_05 §۸): `bomNeed(o.prod.lines)` محاسبه
 * می‌شود، در صورت کسری مواد مسدود می‌شود (order.js:509 — «شروع ممکن
 * نیست») و به‌ازای هر ماده حرکت `use` (منفی) در انبار raw با ref این
 * سفارش در همان تراکنش ثبت می‌شود. مقدار مصرف‌شده روی `prod.used`
 * ذخیره می‌شود (order.js:726).
 */
async function doStartProduction(row: Prisma.OrderGetPayload<{ include: { items: true } }>, actor: Actor, hideMoney: boolean) {
  if (row.stage !== 7) throw badRequest("شروع تولید فقط در مرحله تولید ممکن است.");
  const prod = asProd(row.prod);

  // اقلام خط تولید این سفارش — معادل o.prod.lines در دمو (order.js:464).
  const items = row.items;
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((it) => it.productId) } },
    select: { id: true, line: true, name: true },
  });
  const prodLineItems = items.filter((it) => products.find((p) => p.id === it.productId)?.line === "prod");
  if (prodLineItems.length === 0) {
    throw badRequest("این سفارش قلم تولیدی ندارد.");
  }

  // bomNeed(o.prod.lines) —order.js:723
  const need: Record<string, number> = {};
  for (const it of prodLineItems) {
    const bom = await prisma.bomItem.findMany({ where: { productId: it.productId } });
    for (const b of bom) {
      need[b.materialId] = (need[b.materialId] ?? 0) + b.qty * it.qty;
    }
  }

  // guard کسری — «شروع ممکن نیست» (order.js:509)
  const [onHandMap, materials] = await Promise.all([
    computeOnHand(),
    prisma.material.findMany({ select: { id: true, name: true } }),
  ]);
  const nameById = new Map(materials.map((m) => [m.id, m.name]));
  const shortages: string[] = [];
  for (const [materialId, required] of Object.entries(need)) {
    const have = onHandMap[`raw|${materialId}`] ?? 0;
    if (have < required) shortages.push(nameById.get(materialId) ?? materialId);
  }
  if (shortages.length) {
    throw badRequest(`مواد اولیه کافی نیست: ${shortages.join("، ")}`);
  }

  const now = Date.now();
  await prisma.$transaction(async (tx) => {
    // order.js:723-725 — حرکت‌های use با مقدار منفی مصرف هر ماده
    for (const [materialId, required] of Object.entries(need)) {
      await tx.move.create({
        data: {
          id: newMoveId(),
          wh: "raw",
          item: materialId,
          qty: signedQty("use", round3(required)),
          kind: "use",
          ref: row.id,
          at: BigInt(now),
          byUserId: actor.userId,
          note: `مصرف تولید ${row.id}`,
        },
      });
    }
    // order.js:726 — o.prod.used = need
    await tx.order.update({
      where: { id: row.id },
      data: {
        updatedAt: now,
        prod: {
          ...(prod ?? { start: isoToday(), end: isoToday(), acceptedAt: null, startedAt: null, note: "", qc: null }),
          startedAt: now,
          used: need,
        },
      },
    });
    await logEntry(tx, row.id, 7, 7, actor, "شروع تولید؛ مواد اولیه طبق فرمول کم شد", "stage", now);
  });
  return getOrder(row.id, hideMoney);
}

/** پایان تولید — ۷→۸ (made — order.js:727). */
async function doMade(row: Prisma.OrderGetPayload<{ include: { items: true } }>, action: Extract<StageAction, { action: "made" }>, actor: Actor, hideMoney: boolean) {
  if (row.stage !== 7) throw badRequest("پایان تولید فقط در مرحله تولید ممکن است.");
  const now = Date.now();
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: row.id },
      data: {
        stage: 8,
        stageAt: now,
        due: now + stageDueMs("qc"),
        times: { ...asTimes(row.times), make: now },
        updatedAt: now,
      },
    });
    await logEntry(tx, row.id, 7, 8, actor, `تولید شد${action.note ? " — " + action.note : ""}`, "stage", now);
  });
  return getOrder(row.id, hideMoney);
}

/**
 * کنترل کیفیت — ۸→۹ با تولید/ضایعات و صدور سند تحویل TR- (qcok —
 * order.js:728-747). سند شامل اقلام سفارش با مقدار سالم است.
 */
async function doQc(row: Prisma.OrderGetPayload<{ include: { items: true } }>, action: Extract<StageAction, { action: "qc" }>, actor: Actor, hideMoney: boolean) {
  if (row.stage !== 8) throw badRequest("کنترل کیفیت فقط در مرحله خودش ممکن است.");
  const now = Date.now();
  const prod = asProd(row.prod);
  // شناسه سند تحویل — "TR-"+o.id.slice(3) در Demo (order.js:731).
  const handoffId = `TR-${row.id.slice(3)}`;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: row.id },
      data: {
        stage: 9,
        stageAt: now,
        due: now + stageDueMs("daccept"),
        times: { ...asTimes(row.times), qc: now },
        updatedAt: now,
        prod: {
          ...(prod ?? { start: isoToday(), end: isoToday(), acceptedAt: null, startedAt: null, note: "", qc: null }),
          qc: { good: action.good, waste: action.waste, why: action.why },
        },
      },
    });
    await tx.orderHandoff.create({
      data: {
        id: handoffId,
        orderId: row.id,
        lines: row.items.map((it) => ({ productId: it.productId, qty: it.qty, color: it.color })),
        at: now,
        byUserId: actor.userId,
        note: `سالم: ${action.good}${action.waste > 0 ? `، ضایعات: ${action.waste}` : ""}`,
      },
    });
    await logEntry(
      tx,
      row.id,
      8,
      9,
      actor,
      `کنترل کیفیت — سالم: ${action.good}${action.waste > 0 ? `، ضایعات: ${action.waste} (${action.why})` : ""} — سند ${handoffId}`,
      "stage",
      now,
    );
  });
  return getOrder(row.id, hideMoney);
}

/**
 * دریافت بار — ثبت در مرحله ۹ بدون تغییر مرحله (recv — order.js:748-757).
 *
 * متصل به سند تحویل TR- (PHASE_05 §۸): مقادیر رسید با سند مقایسه
 * می‌شود؛ مغایرت نیازمند یادداشت است (order.js:750). به‌ازای هر قلم با
 * مقدار مثبت حرکت `prod` (مثبت) در انبار depot ثبت می‌شود و رزرو
 * سفارش به همان مقدار اضافه می‌شود (order.js:752-753).
 *
 * NOTE: رزرو (o.resv) در این پلتفرم پیاده‌سازی نشده (Q-04 معوق) —
 * فقط حرکت انبار ثبت می‌شود.
 */
async function doReceive(row: Prisma.OrderGetPayload<{ include: { items: true } }>, action: Extract<StageAction, { action: "receive" }>, actor: Actor, hideMoney: boolean) {
  if (row.stage !== 9) throw badRequest("دریافت فقط در مرحله «قبول در انبار» ممکن است.");

  // سند تحویل این سفارش — "TR-"+o.id.slice(3) در دمو (order.js:731).
  const handoffId = `TR-${row.id.slice(3)}`;
  const handoff = await prisma.orderHandoff.findUnique({ where: { id: handoffId } });
  if (!handoff) throw badRequest("سند تحویل تولیدی برای این سفارش وجود ندارد.");

  // idempotency: ثبت دوگانه بار باعث شمارش مضاعف می‌شود (PHASE_05 §۸).
  const existing = await prisma.move.findFirst({ where: { kind: "prod", ref: row.id } });
  if (existing) {
    throw conflict("بار این سفارش قبلاً در انبار ثبت شده است.");
  }

  const docLines = asHandoffLines(handoff.lines);
  // مقادیر رسید — پیش‌فرض مقدار سند (order.js:749)
  const got = docLines.map((l) => {
    const entered = action.lines?.find((x) => x.productId === l.productId);
    return { productId: l.productId, qty: entered ? entered.qty : l.qty };
  });

  // مغایرت نیاز به توضیح دارد (order.js:750)
  const diffs: string[] = [];
  for (const l of got) {
    const doc = docLines.find((d) => d.productId === l.productId);
    if (doc && l.qty !== doc.qty) {
      diffs.push(`${l.productId}: سند ${doc.qty}، رسید ${l.qty}`);
    }
  }
  const note = action.note?.trim() ?? "";
  if (diffs.length > 0 && note.length === 0) {
    throw badRequest("مغایرت دارد؛ توضیح آن را بنویسید.");
  }

  const now = Date.now();
  await prisma.$transaction(async (tx) => {
    // order.js:752-753 — حرکت‌های prod با مقدار رسید در دپو
    for (const l of got) {
      if (!(l.qty > 0)) continue;
      await tx.move.create({
        data: {
          id: newMoveId(),
          wh: "depot",
          item: l.productId,
          qty: signedQty("prod", round3(l.qty)),
          kind: "prod",
          ref: row.id,
          at: BigInt(now),
          byUserId: actor.userId,
          note: `ورود از تولید ${handoffId}`,
        },
      });
    }
    await tx.order.update({ where: { id: row.id }, data: { updatedAt: now } });
    await logEntry(
      tx,
      row.id,
      9,
      9,
      actor,
      `انبار دپو سند ${handoffId} را تحویل گرفت` + (diffs.length ? ` — مغایرت: ${diffs.join("؛ ")} (${note})` : " — مطابق"),
      "stage",
      now,
    );
  });
  return getOrder(row.id, hideMoney);
}

/** قبول در انبار دپو — ۹→۱۰ (daccept — order.js:748-761). */
async function doDaccept(row: Prisma.OrderGetPayload<{ include: { items: true } }>, action: Extract<StageAction, { action: "daccept" }>, actor: Actor, hideMoney: boolean) {
  if (row.stage !== 9) throw badRequest("قبول در انبار فقط در مرحله ۹ ممکن است.");
  const now = Date.now();
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: row.id },
      data: {
        stage: 10,
        stageAt: now,
        due: now + stageDueMs("prep"),
        times: { ...asTimes(row.times), daccept: now },
        updatedAt: now,
      },
    });
    await logEntry(tx, row.id, 9, 10, actor, `قبول در انبار${action.note ? " — " + action.note : ""}`, "stage", now);
  });
  return getOrder(row.id, hideMoney);
}

/** آماده‌سازی بار — ۱۰→۱۱ (prep — order.js:762). */
async function doPrep(row: Prisma.OrderGetPayload<{ include: { items: true } }>, action: Extract<StageAction, { action: "prep" }>, actor: Actor, hideMoney: boolean) {
  if (row.stage !== 10) throw badRequest("آماده‌سازی فقط در مرحله خودش ممکن است.");
  const now = Date.now();
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: row.id },
      data: {
        stage: 11,
        stageAt: now,
        due: now + stageDueMs("deliver"),
        times: { ...asTimes(row.times), prep: now },
        updatedAt: now,
        prep: { t: now, packs: action.packs, checks: action.checks, note: action.note ?? "" },
      },
    });
    await logEntry(tx, row.id, 10, 11, actor, `آماده شد — ${action.packs} بسته`, "stage", now);
  });
  return getOrder(row.id, hideMoney);
}

/**
 * تحویل به مشتری — ۱۱ → done (deliverAll — order.js:573-576).
 *
 * متصل به حرکت‌های انبار (PHASE_05 §۸): به‌ازای هر قلم سفارش حرکت
 * `sale` (منفی) در انبار depot با ref این سفارش ثبت می‌شود —
 * «اقلام خودکار از موجودی انبار دپو کم می‌شود» (order.js:573-576).
 */
async function doDeliver(row: Prisma.OrderGetPayload<{ include: { items: true } }>, action: Extract<StageAction, { action: "deliver" }>, actor: Actor, hideMoney: boolean) {
  if (row.stage !== 11) throw badRequest("تحویل فقط در مرحله آخر ممکن است.");
  const now = Date.now();
  await prisma.$transaction(async (tx) => {
    // order.js:573 — حرکت‌های sale به‌ازای هر قلم سفارش
    for (const it of row.items) {
      await tx.move.create({
        data: {
          id: newMoveId(),
          wh: "depot",
          item: it.productId,
          qty: signedQty("sale", round3(it.qty)),
          kind: "sale",
          ref: row.id,
          at: BigInt(now),
          byUserId: actor.userId,
          note: "تحویل به مشتری",
        },
      });
    }
    await tx.order.update({
      where: { id: row.id },
      data: {
        stageAt: now,
        times: { ...asTimes(row.times), deliver: now },
        updatedAt: now,
        status: "done",
        delivered: { t: now, to: action.to },
      },
    });
    await logEntry(tx, row.id, 11, 11, actor, `تحویل به ${action.to}${action.note ? " — " + action.note : ""}`, "done", now);
  });
  return getOrder(row.id, hideMoney);
}

/**
 * لغو سفارش — فقط stage ≤ ۵ توسط management/salesManager/sales مالک
 * (canCancel — order.js:59) و با دلیل اجباری.
 */
export async function cancelOrder(
  id: string,
  reason: string,
  actor: Actor,
  hideMoney: boolean,
): Promise<OrderDetail | OrderDetailNoMoney> {
  const row = await prisma.order.findUnique({ where: { id } });
  if (!row) throw notFound("سفارش مورد نظر پیدا نشد.");
  assertOpen(row);

  const canCancel =
    row.stage <= 5 &&
    (actor.roles.includes("management") ||
      actor.roles.includes("admin") ||
      actor.roles.includes("salesManager") ||
      (actor.roles.includes("sales") && row.ownerId === actor.userId));
  if (!canCancel) {
    throw forbidden("لغو این سفارش مجاز نیست.");
  }

  const now = Date.now();
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: row.id },
      data: { status: "cancelled", cancelReason: reason, updatedAt: now },
    });
    await logEntry(tx, row.id, row.stage, row.stage, actor, `لغو سفارش — ${reason}`, "cancel", now);
  });
  return getOrder(row.id, hideMoney);
}

// --- تبدیل‌های امن Json → نوع ----------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asNumberArray(v: unknown): number[] {
  return Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : [];
}

function asBackNote(v: unknown): { by: string; t: number; text: string } | null {
  if (!isRecord(v)) return null;
  return {
    by: typeof v["by"] === "string" ? v["by"] : "",
    t: typeof v["t"] === "number" ? v["t"] : 0,
    text: typeof v["text"] === "string" ? v["text"] : "",
  };
}

function asOk(v: unknown): { by: string; t: number } | null {
  if (!isRecord(v)) return null;
  return {
    by: typeof v["by"] === "string" ? v["by"] : "",
    t: typeof v["t"] === "number" ? v["t"] : 0,
  };
}

function asTimes(v: unknown): Record<string, number> {
  if (!isRecord(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "number") out[k] = val;
  }
  return out;
}

function asSent(v: unknown): { via: string; at: number } | null {
  if (!isRecord(v)) return null;
  return {
    via: typeof v["via"] === "string" ? v["via"] : "",
    at: typeof v["at"] === "number" ? v["at"] : 0,
  };
}

/** خطوط سند تحویل — `lines` JSON روی OrderHandoff (order.js:731). */
function asHandoffLines(v: unknown): { productId: string; qty: number; color: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => ({
      productId: typeof x["productId"] === "string" ? x["productId"] : "",
      qty: typeof x["qty"] === "number" ? x["qty"] : 0,
      color: typeof x["color"] === "string" ? x["color"] : "",
    }))
    .filter((x) => x.productId.length > 0);
}

function asProd(v: unknown): NonNullable<OrderDetail["prod"]> | null {
  if (!isRecord(v)) return null;
  return {
    start: typeof v["start"] === "string" ? v["start"] : "",
    end: typeof v["end"] === "string" ? v["end"] : "",
    acceptedAt: typeof v["acceptedAt"] === "number" ? v["acceptedAt"] : null,
    startedAt: typeof v["startedAt"] === "number" ? v["startedAt"] : null,
    note: typeof v["note"] === "string" ? v["note"] : "",
    qc: isRecord(v["qc"])
      ? {
          good: typeof v["qc"]["good"] === "number" ? v["qc"]["good"] : 0,
          waste: typeof v["qc"]["waste"] === "number" ? v["qc"]["waste"] : 0,
          why: typeof v["qc"]["why"] === "string" ? v["qc"]["why"] : "",
        }
      : null,
    used: isRecord(v["used"])
      ? Object.entries(v["used"]).reduce<Record<string, number>>((acc, [k, val]) => {
          if (typeof val === "number") acc[k] = val;
          return acc;
        }, {})
      : null,
  };
}

function asPrep(v: unknown): NonNullable<OrderDetail["prep"]> | null {
  if (!isRecord(v)) return null;
  return {
    t: typeof v["t"] === "number" ? v["t"] : 0,
    packs: typeof v["packs"] === "number" ? v["packs"] : 0,
    checks: Array.isArray(v["checks"]) ? v["checks"].filter((x): x is string => typeof x === "string") : [],
    note: typeof v["note"] === "string" ? v["note"] : "",
  };
}

function asDelivered(v: unknown): NonNullable<OrderDetail["delivered"]> | null {
  if (!isRecord(v)) return null;
  return {
    t: typeof v["t"] === "number" ? v["t"] : 0,
    to: typeof v["to"] === "string" ? v["to"] : "",
  };
}

function asAgreed(v: unknown): NonNullable<OrderDetail["agreed"]> | null {
  if (!isRecord(v)) return null;
  return {
    t: typeof v["t"] === "number" ? v["t"] : 0,
    how: typeof v["how"] === "string" ? v["how"] : "",
    note: typeof v["note"] === "string" ? v["note"] : "",
  };
}

function asPlanBuilder(v: unknown): PlanParams | null {
  if (!isRecord(v)) return null;
  const rest = v["rest"];
  if (rest !== "cash" && rest !== "cheque" && rest !== "credit") return null;
  const gap = v["gap"];
  const first = v["first"];
  return {
    pre: typeof v["pre"] === "number" ? v["pre"] : 0,
    preMode: v["preMode"] === "amt" ? "amt" : "pct",
    preAmt: typeof v["preAmt"] === "number" ? v["preAmt"] : 0,
    rest,
    n: typeof v["n"] === "number" ? v["n"] : 1,
    gap: gap === "15d" || gap === "1m" || gap === "2m" || gap === "3m" ? gap : "1m",
    first: first === "1m" || first === "2m" || first === "3m" ? first : "1m",
  };
}

// --- کمک‌های نمایش -----------------------------------------------------------

function AGREED_HOW_LABEL(key: string): string {
  const map: Record<string, string> = { call: "تلفنی", pay: "واریز", chq: "چک", visit: "حضوری" };
  return map[key] ?? key;
}

function isoToday(): string {
  return instantToJalaliIso(startOfToday());
}

/** برچسب فارسی وضعیت سفارش (Q-11). */
export function statusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS] ?? status;
}

/** برچسب فارسی مرحله. */
export function stageLabel(step: number): string {
  const key = stageKeyOf(step);
  return key ? getStage(key).label : `مرحله ${step}`;
}
