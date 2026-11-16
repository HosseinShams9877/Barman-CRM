/**
 * سرویس خرید — ماشین حالت `req → ok → fin → recv` (PHASE_06 §۶/§۷).
 *
 * همه قوانین با ارجاع به Demo (CLAUDE.md §۱۳):
 *  - `total(b)` = Σ qty × price اقلام (app/fin-core.js:22).
 *  - `paidAmt(b)` = جمع مبالغ چک‌های «پاس‌شده» (app/fin-core.js:23 — در Demo
 *    همه پرداخت‌ها؛ اینجا چک‌هایی که واقعاً پاس شده‌اند، طبق دروازه خروج
 *    ۴ PHASE_06: چک با وضعیت `issued` هنوز پرداختنی است).
 *  - `due(b)` = 0 در وضعیت `req`، در غیر این صورت max(0, total − paid)
 *    (app/fin-core.js:24).
 *  - `stockIn(b, lines)` حرکت `kind: "buy"` مثبت در انبار `raw` با
 *    `note: "ورود خرید <id>"` (app/fin-core.js:41-44).
 *  - ویرایش فقط در `req` (PHASE_06 §۷) — مطابق Demo که ویرایش خرید قبل
 *    از تأیید مدیریت ممکن است.
 *
 * اتصال خرید → انبار در یک تراکنش Prisma انجام می‌شود: یا همه حرکت‌ها +
 * انتقال وضعیت با هم، یا هیچ‌کدام (درخواست صریح مالک: ارتباط خرید به
 * انبار باید تراکنشی باشد — بدون حرکت یتیم و بدون دوبار شمارش).
 */
import { prisma } from "@core/database/client";
import { newMoveId, nextPrefixedId } from "@core/database";
import { instantToJalaliIso } from "@core/calendar";
import { badRequest, conflict, notFound } from "@core/errors";
import type { Role } from "@core/permissions";
import { Prisma } from "@prisma/client";
import { BUY_STATUS_LABELS, isLegalTransition, type BuyStatus } from "../constants";
import type {
  ApproveBuyInput,
  BuyListQuery,
  CreateBuyInput,
  FinanceBuyInput,
  ReceiveBuyInput,
  UpdateBuyInput,
} from "../schemas/buy.schema";
import type {
  BuyDetail,
  BuyDetailNoMoney,
  BuyListParams,
  BuyListResult,
  BuyListResultNoMoney,
  BuyListItem,
  BuyListItemNoMoney,
} from "../types/buy.types";

/** بازیگر انجام‌دهنده عملیات (مشتق از نشست سرور). */
export type BuyActor = { userId: string; roles: Role[] };

// --- محاسبات (fin-core.js:22-24) -------------------------------------------

/** گردسازی مقدار حرکت — مطابق round3 در فاز ۵. */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * مبلغ کل خرید — Σ qty × price هر قلم، هر قلم گردشده به ریال صحیح (CD-13).
 *
 * Demo (fin-core.js:22) گردسازی نمی‌کند، ولی مبالغ در این پروژه عدد صحیح
 * ریال هستند (CD-13)؛ لذا هر قلم گرد شده و سپس جمع می‌شود.
 */
export function calcBuyTotal(items: { qty: number; price: number }[]): number {
  return items.reduce((sum, it) => sum + Math.round(it.qty * it.price), 0);
}

/**
 * مبلغ پرداخت‌شده — جمع چک‌های با وضعیت `paid` (fin-core.js:23 با تفسیر
 * دروازه خروج ۴ PHASE_06).
 */
function paidOf(cheques: { status: string; amount: number }[]): number {
  return cheques.filter((c) => c.status === "paid").reduce((a, c) => a + c.amount, 0);
}

/**
 * بدهی باقی‌مانده — 0 در `req`، در غیر این صورت max(0, total − paid)
 * (fin-core.js:24).
 */
export function calcDue(status: BuyStatus, total: number, paid: number): number {
  if (status === "req") return 0;
  return Math.max(0, total - paid);
}

// --- خواندن -----------------------------------------------------------------

/** شکل include مشترک برای لیست و جزئیات. */
const BUY_INCLUDE = {
  supplier: { select: { name: true } },
  creator: { select: { name: true } },
  items: { include: { material: { select: { name: true, code: true, unit: true } } } },
  cheques: { orderBy: [{ due: "asc" }, { id: "asc" }] as const },
  statusLog: {
    orderBy: [{ at: "desc" }] as const,
    include: { by: { select: { name: true } } },
  },
} satisfies Prisma.BuyInclude;

type BuyRow = Prisma.BuyGetPayload<{ include: typeof BUY_INCLUDE }>;

/** تبدیل رکورد Prisma به ردیف لیست (نسخه کامل). */
function toListItem(row: BuyRow): BuyListItem {
  const paid = paidOf(row.cheques);
  return {
    id: row.id,
    status: row.status as BuyStatus,
    supplierId: row.supplierId,
    supplierName: row.supplier?.name ?? null,
    itemCount: row.items.length,
    chequeCount: row.cheques.length,
    createdByName: row.creator?.name ?? null,
    createdAt: isoFromUtc(Number(row.createdAt)),
    rev: row.rev,
    calc: { total: row.total, paid, due: calcDue(row.status as BuyStatus, row.total, paid) },
  };
}

/** تبدیل رکورد Prisma به جزئیات (نسخه کامل). */
function toDetail(row: BuyRow): BuyDetail {
  const paid = paidOf(row.cheques);
  return {
    ...toListItem(row),
    note: row.note,
    updatedAt: Number(row.updatedAt),
    items: row.items.map((it) => ({
      id: it.id,
      materialId: it.materialId,
      materialName: it.material.name,
      materialCode: it.material.code,
      unit: it.material.unit,
      qty: it.qty,
      price: it.price,
    })),
    cheques: row.cheques.map((c) => ({
      id: c.id,
      amount: c.amount,
      due: c.due,
      sayad: c.sayad,
      status: c.status as "issued" | "paid",
    })),
    statusLog: row.statusLog.map((l) => ({
      id: l.id,
      fromStatus: (l.fromStatus ?? null) as BuyStatus | null,
      toStatus: l.toStatus as BuyStatus,
      at: Number(l.at),
      byName: l.by?.name ?? null,
      note: l.note,
    })),
    calc: { total: row.total, paid, due: calcDue(row.status as BuyStatus, row.total, paid) },
  };
}

/** حذف فیلدهای پولی برای نقش‌های noMoney (R-32) — تخریب واقعی، نه type-cast. */
function stripListItem(item: BuyListItem): BuyListItemNoMoney {
  const { calc, ...rest } = item;
  void calc;
  return rest;
}

function stripDetail(detail: BuyDetail): BuyDetailNoMoney {
  const { calc, items, cheques, ...rest } = detail;
  void calc;
  return {
    ...rest,
    items: items.map(({ price, ...it }) => {
      void price;
      return it;
    }),
    cheques: cheques.map(({ amount, ...c }) => {
      void amount;
      return c;
    }),
  };
}

/** تبدیل UTC ms به تاریخ خالص `YYYY/MM/DD` (CD-06) — بدون Intl. */
function isoFromUtc(ms: number): string {
  return instantToJalaliIso(ms);
}

/** بارگذاری خرید یا ۴۰۴. */
async function loadBuyOr404(id: string): Promise<BuyRow> {
  const row = await prisma.buy.findUnique({ where: { id }, include: BUY_INCLUDE });
  if (!row) throw notFound("خرید مورد نظر پیدا نشد.");
  return row;
}

/**
 * GET /api/buys — لیست خریدها با فیلتر وضعیت/تأمین‌کننده و جستجو.
 *
 * جستجو روی شناسه خرید و نام تأمین‌کننده.
 */
export async function listBuys(
  params: BuyListParams,
  hideMoney: boolean,
): Promise<BuyListResult | BuyListResultNoMoney> {
  const where: Prisma.BuyWhereInput = {};
  if (params.status !== null) where.status = params.status;
  if (params.supplierId !== null) where.supplierId = params.supplierId;
  if (params.q.length > 0) {
    where.OR = [
      { id: { contains: params.q } },
      { supplier: { name: { contains: params.q } } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.buy.count({ where }),
    prisma.buy.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: BUY_INCLUDE,
    }),
  ]);

  const items = rows.map((r) => (hideMoney ? stripListItem(toListItem(r)) : toListItem(r)));
  return { items, total, page: params.page, pageSize: params.pageSize };
}

/** GET /api/buys/[id] — جزئیات خرید با اقلام، چک‌ها و تاریخچه وضعیت. */
export async function getBuy(id: string, hideMoney: boolean): Promise<BuyDetail | BuyDetailNoMoney> {
  const row = await loadBuyOr404(id);
  return hideMoney ? stripDetail(toDetail(row)) : toDetail(row);
}

// --- ایجاد و ویرایش ----------------------------------------------------------

/**
 * POST /api/buys — ثبت درخواست خرید با وضعیت `req` (PHASE_06 §۶).
 *
 * شناسه `BY-` از بزرگترین شماره موجود استخراج می‌شود (nextPrefixedId —
 * مطابق X.nextId در app/core.js:365). یک رکورد تاریخچه برای ایجاد ثبت
 * می‌شود (PHASE_06 §۳.۲).
 */
export async function createBuy(
  input: CreateBuyInput,
  actor: BuyActor,
): Promise<BuyDetail | BuyDetailNoMoney> {
  const materialIds = input.items.map((it) => it.materialId);
  const materials = await prisma.material.findMany({
    where: { id: { in: materialIds } },
    select: { id: true },
  });
  if (materials.length !== new Set(materialIds).size) {
    throw badRequest("یک یا چند ماده اولیه پیدا نشد.");
  }
  if (input.supplierId !== undefined) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: input.supplierId },
      select: { id: true },
    });
    if (!supplier) throw badRequest("تأمین‌کننده پیدا نشد.");
  }

  const existing = await prisma.buy.findMany({ select: { id: true } });
  const id = nextPrefixedId("BY", existing.map((b) => b.id));
  const now = Date.now();
  const total = calcBuyTotal(input.items);

  await prisma.$transaction(async (tx) => {
    await tx.buy.create({
      data: {
        id,
        supplierId: input.supplierId ?? null,
        status: "req",
        total,
        note: input.note ?? null,
        createdBy: actor.userId,
        createdAt: now,
        updatedAt: now,
        rev: 0,
        items: {
          create: input.items.map((it) => ({
            materialId: it.materialId,
            qty: it.qty,
            price: it.price,
          })),
        },
      },
    });
    await tx.buyStatusLog.create({
      data: {
        buyId: id,
        fromStatus: null,
        toStatus: "req",
        at: now,
        byUserId: actor.userId,
        note: "ثبت درخواست خرید",
      },
    });
  });

  return getBuy(id, false);
}

/**
 * PATCH /api/buys/[id] — ویرایش فقط در وضعیت `req` (PHASE_06 §۷).
 *
 * `rev` الزامی است و در صورت عدم تطابق ۴۰۹ برمی‌گردد (R-06). در صورت
 * تغییر اقلام، `total` دوباره محاسبه و ذخیره می‌شود.
 */
export async function updateBuy(
  id: string,
  input: UpdateBuyInput,
  _actor: BuyActor,
  hideMoney: boolean,
): Promise<BuyDetail | BuyDetailNoMoney> {
  const row = await prisma.buy.findUnique({ where: { id }, include: { items: true } });
  if (!row) throw notFound("خرید مورد نظر پیدا نشد.");
  if (row.status !== "req") {
    throw badRequest("ویرایش خرید فقط در وضعیت «درخواست خرید» ممکن است.");
  }
  assertRev(row, input.rev);

  if (input.supplierId !== undefined && input.supplierId !== null) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: input.supplierId },
      select: { id: true },
    });
    if (!supplier) throw badRequest("تأمین‌کننده پیدا نشد.");
  }

  const data: Prisma.BuyUpdateInput = { updatedAt: Date.now(), rev: row.rev + 1 };
  if (input.supplierId !== undefined) {
    data.supplier =
      input.supplierId === null ? { disconnect: true } : { connect: { id: input.supplierId } };
  }
  if (input.note !== undefined) data.note = input.note;

  if (input.items !== undefined) {
    const materialIds = input.items.map((it) => it.materialId);
    const materials = await prisma.material.findMany({
      where: { id: { in: materialIds } },
      select: { id: true },
    });
    if (materials.length !== new Set(materialIds).size) {
      throw badRequest("یک یا چند ماده اولیه پیدا نشد.");
    }
    data.total = calcBuyTotal(input.items);
    data.items = {
      deleteMany: {},
      create: input.items.map((it) => ({
        materialId: it.materialId,
        qty: it.qty,
        price: it.price,
      })),
    };
  }

  await prisma.buy.update({ where: { id }, data });
  return getBuy(id, hideMoney);
}

// --- گذارهای وضعیت ------------------------------------------------------------

/** بررسی تطابق `rev` — R-06 (PHASE_06 §۳.۲). در صورت عدم تطابق ۴۰۹. */
function assertRev(row: { rev: number }, rev: number): void {
  if (row.rev !== rev) {
    throw conflict("این خرید توسط کاربر دیگری تغییر کرده است — دوباره بارگذاری کنید.");
  }
}

/** پیام خطای گذار غیرمجاز. */
function transitionError(from: string, to: string): string {
  return `گذار وضعیت «${BUY_STATUS_LABELS[from as BuyStatus] ?? from}» به «${BUY_STATUS_LABELS[to as BuyStatus] ?? to}» مجاز نیست.`;
}

/**
 * POST /api/buys/[id]/approve — تأیید مدیر خرید `req → ok` (PHASE_06 §۷).
 *
 * مجوز `purchasing.approve` در مسیر بررسی می‌شود (CD-04 مرحله ۲).
 */
export async function approveBuy(
  id: string,
  input: ApproveBuyInput,
  actor: BuyActor,
  hideMoney: boolean,
): Promise<BuyDetail | BuyDetailNoMoney> {
  const row = await loadBuyOr404(id);
  if (!isLegalTransition(row.status as BuyStatus, "ok")) {
    throw badRequest(transitionError(row.status, "ok"));
  }
  assertRev(row, input.rev);

  const now = Date.now();
  await prisma.$transaction(async (tx) => {
    await tx.buy.update({
      where: { id },
      data: { status: "ok", updatedAt: now, rev: row.rev + 1 },
    });
    await tx.buyStatusLog.create({
      data: {
        buyId: id,
        fromStatus: row.status,
        toStatus: "ok",
        at: now,
        byUserId: actor.userId,
        note: "تأیید درخواست خرید",
      },
    });
  });

  return getBuy(id, hideMoney);
}

/**
 * POST /api/buys/[id]/finance — تأیید مالی `ok → fin` + ثبت چک‌های صادره.
 *
 * چک‌ها با وضعیت `issued` ثبت می‌شوند (app/buy.js:231). جمع مبالغ چک‌ها
 * نباید از مبلغ کل خرید بیشتر باشد (PHASE_06 §۱۲).
 *
 * مجوز `finance.approve` در مسیر بررسی می‌شود.
 */
export async function financeBuy(
  id: string,
  input: FinanceBuyInput,
  actor: BuyActor,
  hideMoney: boolean,
): Promise<BuyDetail | BuyDetailNoMoney> {
  const row = await loadBuyOr404(id);
  if (!isLegalTransition(row.status as BuyStatus, "fin")) {
    throw badRequest(transitionError(row.status, "fin"));
  }
  assertRev(row, input.rev);

  const cheques = input.cheques ?? [];
  const chequeSum = cheques.reduce((a, c) => a + c.amount, 0);
  if (chequeSum > row.total) {
    throw badRequest("جمع مبالغ چک‌ها نمی‌تواند بیشتر از مبلغ کل خرید باشد.");
  }

  const now = Date.now();
  await prisma.$transaction(async (tx) => {
    if (cheques.length > 0) {
      await tx.buyCheque.createMany({
        data: cheques.map((c) => ({
          buyId: id,
          amount: c.amount,
          due: c.due,
          sayad: c.sayad ?? null,
          status: "issued",
        })),
      });
    }
    await tx.buy.update({
      where: { id },
      data: { status: "fin", updatedAt: now, rev: row.rev + 1 },
    });
    await tx.buyStatusLog.create({
      data: {
        buyId: id,
        fromStatus: row.status,
        toStatus: "fin",
        at: now,
        byUserId: actor.userId,
        note:
          cheques.length > 0
            ? `تأیید مالی با ${cheques.length} چک صادره`
            : "تأیید مالی (بدون چک)",
      },
    });
  });

  return getBuy(id, hideMoney);
}

/**
 * POST /api/buys/[id]/receive — رسید انبار `fin → recv` + حرکت‌های `buy`.
 *
 * حرکت‌ها در همان تراکنش انتقال وضعیت ایجاد می‌شوند (درخواست مالک:
 * اتصال خرید → انبار باید تراکنشی باشد). انبار مقصد همیشه `raw` است
 * (PHASE_06 §۳.۴ — خرید مواد اولیه؛ Demo fin-core.js:42 انبار را بر اساس
 * `b.kind` انتخاب می‌کند، ولی در این فاز خرید فقط مواد اولیه را شامل
 * می‌شود).
 *
 * محافظ تکرار: اگر حرکت `kind: "buy"` با همین `ref` وجود داشته باشد
 * ۴۰۹ برمی‌گردد (جلوگیری از ورود دوباره و دوبار شمارش موجودی).
 */
export async function receiveBuy(
  id: string,
  input: ReceiveBuyInput,
  actor: BuyActor,
  hideMoney: boolean,
): Promise<BuyDetail | BuyDetailNoMoney> {
  const row = await loadBuyOr404(id);
  if (!isLegalTransition(row.status as BuyStatus, "recv")) {
    throw badRequest(transitionError(row.status, "recv"));
  }
  assertRev(row, input.rev);

  // محافظ تکرار (idempotency) — جستجوی حرکت قبلی با همین مرجع
  const dup = await prisma.move.findFirst({
    where: { kind: "buy", ref: id },
    select: { id: true },
  });
  if (dup) {
    throw conflict("این خرید قبلاً وارد انبار شده است.");
  }

  const now = Date.now();
  await prisma.$transaction(async (tx) => {
    // app/fin-core.js:43 — برای هر قلم با qty > 0 یک حرکت ورود خرید
    for (const it of row.items) {
      const qty = round3(it.qty);
      if (!(qty > 0)) continue;
      await tx.move.create({
        data: {
          id: newMoveId(),
          wh: "raw",
          item: it.materialId,
          qty,
          kind: "buy",
          ref: id,
          at: BigInt(now),
          byUserId: actor.userId,
          note: `ورود خرید ${id}`,
        },
      });
    }
    await tx.buy.update({
      where: { id },
      data: { status: "recv", updatedAt: now, rev: row.rev + 1 },
    });
    await tx.buyStatusLog.create({
      data: {
        buyId: id,
        fromStatus: row.status,
        toStatus: "recv",
        at: now,
        byUserId: actor.userId,
        note: "رسید انبار — ورود مواد به انبار مواد",
      },
    });
  });

  return getBuy(id, hideMoney);
}

/**
 * PATCH /api/buys/[id]/cheques/[cid] — چک صادره `issued → paid`.
 *
 * منبع: app/fin.js:143 (data-cop → `p.chq.status = "paid"`). پاس کردن چک
 * آن را از فهرست چک‌های صادرهٔ پرداختنی خارج می‌کند و `paid` خرید را
 * افزایش می‌دهد (دروازه خروج ۴ PHASE_06).
 *
 * توجه: چک خرید فاقد فیلد `updatedAt` است، پس فقط وضعیت عوض می‌شود.
 */
export async function payBuyCheque(
  buyId: string,
  chequeId: string,
  actor: BuyActor,
  hideMoney: boolean,
): Promise<BuyDetail | BuyDetailNoMoney> {
  const row = await loadBuyOr404(buyId);
  const cheque = await prisma.buyCheque.findUnique({ where: { id: chequeId } });
  if (!cheque || cheque.buyId !== buyId) {
    throw notFound("چک مورد نظر پیدا نشد.");
  }
  if (cheque.status === "paid") {
    throw conflict("این چک قبلاً پاس شده است.");
  }
  if (cheque.status !== "issued") {
    throw badRequest("فقط چک صادرشده قابل پاس کردن است.");
  }

  const now = Date.now();
  await prisma.$transaction(async (tx) => {
    await tx.buyCheque.update({
      where: { id: chequeId },
      data: { status: "paid" },
    });
    await tx.buyStatusLog.create({
      data: {
        buyId,
        fromStatus: row.status,
        toStatus: row.status,
        at: now,
        byUserId: actor.userId,
        note: "پاس شدن چک صادره",
      },
    });
  });

  return getBuy(buyId, hideMoney);
}

// --- تبدیل پارامترهای query ----------------------------------------------------

/** تبدیل خروجی Zod لیست به `BuyListParams` سرویس. */
export function toListParams(query: BuyListQuery): BuyListParams {
  return {
    status: query.status ?? null,
    supplierId: query.supplierId ?? null,
    q: query.q,
    page: query.page,
    pageSize: query.pageSize,
  };
}
