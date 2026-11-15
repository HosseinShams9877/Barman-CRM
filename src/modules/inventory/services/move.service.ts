/**
 * سرویس حرکت‌های انبار — منطق کسب‌وکار (CD-04 گام ۴).
 *
 * قوانین (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - پیام اعتبارسنجی: «محصول، مقدار و علت را وارد کنید»
 *    (app/stock.js:۶۶-۶۷) — در اسکیمای Zod.
 *  - guard موجودی خروج دپو: «بیشتر از موجودی آزاد است (بخشی رزرو
 *    سفارش‌هاست)» (app/stock.js:۶۸) — برای `out` در `depot` رعایت می‌شود.
 *  - ثبت دستی فقط kinds دستی (open/out/adj/waste)؛ kinds سیستمی
 *    (buy/prod/sale/use/job) فقط از عملیات کسب‌کار ساخته می‌شوند
 *    (PHASE_05: بدون حرکت یتیمی، بدون شمارش مضاعف).
 *  - ویرایش/حذف فقط حرکت‌های `open`/`out`/`adj` (PHASE_05 §۸).
 *  - علامت qty بر اساس kind (core.js:۲۰۶) — در سرور اعمال می‌شود.
 *  - شناسه `mv…` مطابق uid("mv") در Demo (app/core.js:۱۱۰).
 *  - noMoney (R-32): حرکت‌های انبار خودشان مقدار/مبلغ ندارند، ولی
 *    لیست حرکت‌ها قیمت ندارد؛ فیلتر پولی در /api/stock اعمال می‌شود.
 */
import { instantToJalaliIso } from "@core/calendar";
import { prisma } from "@core/database/client";
import { newMoveId } from "@core/database";
import { badRequest, notFound } from "@core/errors";
import type { Role } from "@core/permissions";
import { MOVE_KIND_LABELS, WAREHOUSE_LABELS } from "../constants";
import { signedQty, isSystemKind } from "../lib/kinds";
import { computeOnHand, freeQtyOf, reservedQty } from "./stock.service";
import type {
  MoveListParams,
  MoveListResult,
  MoveRow,
} from "../types/move.types";
import type { CreateMoveInput, UpdateMoveInput } from "../schemas/move.schema";

/** هویت اجراکننده — از نشست ساخته می‌شود (CD-04 گام ۱/۲). */
export type Actor = {
  userId: string;
  roles: Role[];
};

type ItemInfo = { id: string; name: string; code: string; unit: string };

/** پاسخ لیست — آیتم‌های هر دو انبار با نام/کد/واحد قلم. */
export async function listMoves(params: MoveListParams): Promise<MoveListResult> {
  const where = {
    ...(params.wh ? { wh: params.wh } : {}),
    ...(params.kind ? { kind: params.kind } : {}),
  };

  const [rows, total, materials, products] = await Promise.all([
    prisma.move.findMany({
      where,
      orderBy: { at: "desc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.move.count({ where }),
    prisma.material.findMany(),
    prisma.product.findMany(),
  ]);

  const names = new Map<string, ItemInfo>();
  for (const m of materials) names.set(m.id, { id: m.id, name: m.name, code: m.code, unit: m.unit });
  for (const p of products) names.set(p.id, { id: p.id, name: p.name, code: p.code, unit: p.unit });

  let items = rows.map((r) => toRow(r, names));
  if (params.q) {
    const q = params.q.toLowerCase();
    items = items.filter(
      (r) =>
        r.itemName.toLowerCase().includes(q) ||
        r.itemCode.toLowerCase().includes(q) ||
        r.itemId.toLowerCase().includes(q),
    );
  }

  return { items, total, page: params.page, pageSize: params.pageSize };
}

function toRow(
  r: {
    id: string;
    wh: string;
    item: string;
    qty: number;
    kind: string;
    ref: string | null;
    at: bigint;
    byUserId: string | null;
    note: string;
  },
  names: Map<string, ItemInfo>,
): MoveRow {
  const info = names.get(r.item);
  const kind = r.kind as keyof typeof MOVE_KIND_LABELS;
  return {
    id: r.id,
    wh: (r.wh as keyof typeof WAREHOUSE_LABELS),
    itemId: r.item,
    itemName: info?.name ?? r.item,
    itemCode: info?.code ?? "",
    unit: info?.unit ?? "",
    qty: r.qty,
    kind,
    kindLabel: MOVE_KIND_LABELS[kind] ?? kind,
    ref: r.ref,
    at: Number(r.at),
    day: instantToJalaliIso(Number(r.at)),
    byName: null,
    note: r.note,
  };
}

/** نام/کد/واحد یک قلم از کاتالوگ انبار متناظر. */
async function itemInfoFor(
  wh: "raw" | "depot",
  itemId: string,
): Promise<ItemInfo> {
  const row =
    wh === "raw"
      ? await prisma.material.findUnique({ where: { id: itemId } })
      : await prisma.product.findUnique({ where: { id: itemId } });
  if (!row) return { id: itemId, name: itemId, code: "", unit: "" };
  return { id: row.id, name: row.name, code: row.code, unit: row.unit };
}

/** بررسی وجود قلم در کاتالوگ انبار متناظر. */
async function assertItemExists(wh: "raw" | "depot", itemId: string): Promise<void> {
  const inCatalog =
    wh === "raw"
      ? !!(await prisma.material.findUnique({ where: { id: itemId }, select: { id: true } }))
      : !!(await prisma.product.findUnique({ where: { id: itemId }, select: { id: true } }));
  if (!inCatalog) {
    throw badRequest("قلم انتخاب‌شده در کاتالوگ وجود ندارد.");
  }
}

/** guard موجودی برای خروج دپو — app/stock.js:۶۸. */
async function assertFreeQty(
  wh: "raw" | "depot",
  itemId: string,
  qtyAbs: number,
  excludeMoveId?: string,
): Promise<void> {
  if (wh !== "depot") return;
  const onHandMap = await computeOnHand();
  let h = onHandMap[`${wh}|${itemId}`] ?? 0;
  if (excludeMoveId) {
    const existing = await prisma.move.findUnique({ where: { id: excludeMoveId } });
    if (existing && existing.wh === wh && existing.item === itemId) {
      h -= existing.qty;
    }
  }
  const free = freeQtyOf(h, reservedQty(itemId));
  if (qtyAbs > free) {
    throw badRequest("بیشتر از موجودی آزاد است (بخشی رزرو سفارش‌هاست).");
  }
}

/**
 * POST /api/moves — ثبت حرکت دستی.
 *
 * `use` سیستمی است ولی این متد فقط kinds دستی را می‌پذیرد (اسکیما)؛
 * حرکت‌های سیستمی توسط order/job services ساخته می‌شوند.
 */
export async function createMove(input: CreateMoveInput, actor: Actor): Promise<MoveRow> {
  await assertItemExists(input.wh, input.itemId);
  if (input.kind === "out") {
    await assertFreeQty(input.wh, input.itemId, Math.abs(input.qty));
  }
  const now = Date.now();
  const move = await prisma.move.create({
    data: {
      id: newMoveId(),
      wh: input.wh,
      item: input.itemId,
      qty: signedQty(input.kind, input.qty),
      kind: input.kind,
      ref: null,
      at: BigInt(now),
      byUserId: actor.userId,
      note: input.note,
    },
  });
  const info = await itemInfoFor(input.wh, input.itemId);
  return toRow({ ...move, ref: move.ref ?? null }, new Map([[info.id, info]]));
}

/** GET /api/moves/[id] — خواندن یک حرکت (برای تست و یکپارچگی). */
export async function getMove(id: string): Promise<MoveRow> {
  const move = await prisma.move.findUnique({ where: { id } });
  if (!move) throw notFound("حرکت پیدا نشد.");
  const info = await itemInfoFor(move.wh as "raw" | "depot", move.item);
  return toRow({ ...move, ref: move.ref ?? null }, new Map([[info.id, info]]));
}

/**
 * PATCH /api/moves/[id] — ویرایش حرکت دستی.
 *
 * فقط حرکت‌های `open`/`out`/`adj` قابل ویرایش‌اند (PHASE_05 §۸)؛
 * حرکت‌های سیستمی (ارائه‌شده به سفارش/خرید/تولید) تغییر نمی‌خورند.
 */
export async function updateMove(id: string, input: UpdateMoveInput, _actor: Actor): Promise<MoveRow> {
  const move = await prisma.move.findUnique({ where: { id } });
  if (!move) throw notFound("حرکت پیدا نشد.");
  if (isSystemKind(move.kind as never) || !["open", "out", "adj"].includes(move.kind)) {
    throw badRequest("این حرکت سیستمی است و قابل ویرایش نیست.");
  }
  if (input.qty !== undefined) {
    // اعتبارسنجی علامت بر اساس kind (PHASE_05 §۱۲): kinds با جهت ثابت
    // فقط مقدار مثبت می‌پذیرند؛ `adj` علامت‌دار است (core.js:۲۰۶).
    if (move.kind !== "adj" && input.qty <= 0) {
      throw badRequest("مقدار باید بیشتر از صفر باشد.");
    }
    const qty = move.kind === "adj" ? input.qty : Math.abs(input.qty);
    if (move.kind === "out") {
      await assertFreeQty(move.wh as "raw" | "depot", move.item, qty, id);
    }
    move.qty = signedQty(move.kind as never, qty);
  }
  if (input.note !== undefined) move.note = input.note;
  const updated = await prisma.move.update({
    where: { id },
    data: { qty: move.qty, note: move.note },
  });
  const info = await itemInfoFor(updated.wh as "raw" | "depot", updated.item);
  return toRow({ ...updated, ref: updated.ref ?? null }, new Map([[info.id, info]]));
}

/** DELETE /api/moves/[id] — حذف حرکت دستی (همان محدودیت ویرایش). */
export async function deleteMove(id: string): Promise<void> {
  const move = await prisma.move.findUnique({ where: { id } });
  if (!move) throw notFound("حرکت پیدا نشد.");
  if (isSystemKind(move.kind as never) || !["open", "out", "adj"].includes(move.kind)) {
    throw badRequest("این حرکت سیستمی است و قابل حذف نیست.");
  }
  await prisma.move.delete({ where: { id } });
}
