/**
 * سرویس تراکنش‌های مالی — ثبت و فهرست هزینه/دریافت متفرقه
 * (PHASE_06 §۶ / app/fin.js:145-147).
 *
 * همه قوانین با ارجاع به Demo (CLAUDE.md §۱۳):
 *  - نوع تراکنش یکی از ۸ گزینه ثابت است (app/fin.js:145).
 *  - جهت از نوع استنتاج می‌شود: شروع با «دریافت» = income، در غیر
 *    این صورت expense (app/fin.js:147).
 *  - کلید ذخیره‌شده: `label.replace("هزینه: ", "هزینه — ")`
 *    (app/fin.js:147).
 *  - مبلغ عدد صحیح مثبت به ریال (CD-13).
 *  - تاریخ خالص `YYYY/MM/DD` با ارقام ASCII (CD-06).
 *
 * noMoney (R-32): مبلغ تراکنش برای نقش‌های فاقد `money.view` در
 * پاسخ حذف می‌شود (فیلتر سرور — پنهان‌سازی در UI کافی نیست).
 */
import { prisma } from "@core/database/client";
import { instantToJalaliIso } from "@core/calendar";
import { badRequest } from "@core/errors";
import { Prisma } from "@prisma/client";
import { toStoredKind, directionOfKind, TXN_STORED_KINDS, type TxnDirection } from "../constants";
import type { CreateTxnInput, TxnListQuery } from "../schemas/txn.schema";
import type {
  TxnListParams,
  TxnRow,
  TxnRowNoMoney,
  TxnListResult,
  TxnListResultNoMoney,
} from "../types/txn.types";

/** تبدیل UTC ms به تاریخ خالص `YYYY/MM/DD` (CD-06) — بدون Intl. */
function isoFromUtc(ms: number): string {
  return instantToJalaliIso(ms);
}

// --- خواندن -----------------------------------------------------------------

/** شکل include مشترک. */
const TXN_INCLUDE = { by: { select: { name: true } } } satisfies Prisma.TxnInclude;

type TxnRowType = Prisma.TxnGetPayload<{ include: typeof TXN_INCLUDE }>;

/** تبدیل رکورد Prisma به ردیف (نسخه کامل). */
function toRow(row: TxnRowType): TxnRow {
  return {
    id: row.id,
    kind: row.kind,
    direction: row.direction as TxnDirection,
    amount: row.amount,
    at: row.at,
    who: row.who,
    note: row.note,
    byName: row.by?.name ?? null,
    createdAt: isoFromUtc(Number(row.createdAt)),
  };
}

/** حذف مبلغ برای نقش‌های noMoney (R-32) — تخریب واقعی، نه type-cast. */
function stripRow(row: TxnRow): TxnRowNoMoney {
  const { amount, ...rest } = row;
  void amount;
  return rest;
}

/**
 * GET /api/txns — فهرست تراکنش‌ها با فیلتر نوع/جهت.
 *
 * جستجو روی `who` و `note` انجام می‌شود.
 */
export async function listTxns(
  params: TxnListParams,
  hideMoney: boolean,
): Promise<TxnListResult | TxnListResultNoMoney> {
  const where: Prisma.TxnWhereInput = {};
  if (params.kind !== null) where.kind = params.kind;
  if (params.direction !== null) where.direction = params.direction;
  if (params.q.length > 0) {
    where.OR = [
      { who: { contains: params.q } },
      { note: { contains: params.q } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.txn.count({ where }),
    prisma.txn.findMany({
      where,
      orderBy: [{ at: "desc" }, { createdAt: "desc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: TXN_INCLUDE,
    }),
  ]);

  const items = rows.map((r) => (hideMoney ? stripRow(toRow(r)) : toRow(r)));
  return { items, total, page: params.page, pageSize: params.pageSize };
}

// --- ثبت -------------------------------------------------------------------

/**
 * POST /api/txns — ثبت هزینه/دریافت متفرقه (PHASE_06 §۶).
 *
 * جهت و کلید ذخیره‌شده در سرویس از `kind` استنتاج می‌شوند
 * (app/fin.js:147) — کاربر جهت را انتخاب نمی‌کند.
 */
export async function createTxn(
  input: CreateTxnInput,
  byUserId: string,
  hideMoney: boolean,
): Promise<TxnRow | TxnRowNoMoney> {
  const direction = directionOfKind(toStoredKind(input.kind));
  const storedKind = toStoredKind(input.kind);

  // محافظ یکپارچگی — کلید ذخیره‌شده باید یکی از TXN_STORED_KINDS باشد
  if (!TXN_STORED_KINDS.includes(storedKind)) {
    throw badRequest("نوع تراکنش نامعتبر است.");
  }

  const row = await prisma.txn.create({
    data: {
      kind: storedKind,
      direction,
      amount: input.amount,
      at: input.at,
      who: input.who ?? null,
      note: input.note ?? null,
      byUserId,
      createdAt: BigInt(Date.now()),
    },
    include: TXN_INCLUDE,
  });

  return hideMoney ? stripRow(toRow(row)) : toRow(row);
}

// --- تبدیل پارامترهای query ----------------------------------------------------

/** تبدیل خروجی Zod لیست به `TxnListParams` سرویس. */
export function toListParams(query: TxnListQuery): TxnListParams {
  return {
    kind: query.kind ?? null,
    direction: query.direction ?? null,
    q: "",
    page: query.page,
    pageSize: query.pageSize,
  };
}
