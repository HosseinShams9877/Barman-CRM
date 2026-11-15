/**
 * سرویس مطالبات — تجمیع چک‌های دریافتی و نسیه سفارش‌ها بر اساس حساب
 * (PHASE_06 §۵ — «بخش دریافتنی‌ها»).
 *
 * منبع قوانین (CLAUDE.md §۱۳ — هیچ قانونی اختراع نمی‌شود):
 *  - چک‌های دریافتی از `order_cheques` فاز ۴ خوانده می‌شوند
 *    (PHASE_06 §۵: «تجمیع چک‌های دریافتی (از order_cheques فاز ۴)»).
 *  - نسیه = `max(0, total − paid)` سفارش — `total` با calcOrder و
 *    `settings.vat` محاسبه می‌شود (CD-29)، `paid` مطابق paidOf
 *    (core.js:245-250: پرداخت‌های باطل‌نشده + چک‌های clear).
 *  - چک‌های clear واریز شده‌اند و جزو مطالبات نیستند؛ چک‌های
 *    hand/bank/bounce همچنان مطالبات‌اند (bounce = برگشتی).
 *  - فقط سفارش‌های لغو‌نشده در مرحله ۵ به بعد (تأیید مشتری و پرداخت —
 *    orderStage.ts:58) یا سفارش‌های done لحاظ می‌شوند؛ پیش‌فاکتورهای
 *    ابتدایی هنوز مطالبات حساب نمی‌شوند (تفسیر — DECISION_LOG).
 *
 * noMoney (R-32): تمام فیلدهای پولی در پاسخ حذف می‌شوند.
 */
import { prisma } from "@core/database/client";
import { calcOrder } from "@modules/orders/services/order.service";
import { paidOf } from "@modules/orders/services/payment.service";
import { getSettings } from "@modules/settings";
import type { Prisma } from "@prisma/client";
import type {
  ReceivableGroup,
  ReceivableGroupNoMoney,
  ReceivableRow,
  ReceivableRowNoMoney,
  ReceivablesResult,
  ReceivablesResultNoMoney,
} from "../types/finance.types";

/** مرحله شروع قطعی شدن سفارش — «pay» (orderStage.ts:58). */
const CONFIRMED_STAGE = 5;

type OrderRow = Prisma.OrderGetPayload<{
  include: {
    account: { select: { name: true } };
    items: true;
    payments: true;
    cheques: true;
  };
}>;

/**
 * GET /api/finance/receivables — مطالبات تجمیع‌شده بر اساس حساب.
 *
 * هر حساب: فهرست چک‌های باز + یک ردیف نسیه (در صورت وجود) و جمع‌ها.
 * سفارش‌های بدون حساب زیر کلید شناسه سفارش تجمیع می‌شوند.
 */
export async function listReceivables(
  hideMoney: boolean,
): Promise<ReceivablesResult | ReceivablesResultNoMoney> {
  const settings = await getSettings();

  const orders = await prisma.order.findMany({
    where: {
      status: { not: "cancelled" },
      OR: [{ stage: { gte: CONFIRMED_STAGE } }, { status: "done" }],
    },
    include: {
      account: { select: { name: true } },
      items: true,
      payments: true,
      cheques: true,
    },
    orderBy: [{ id: "asc" }],
  });

  const rows: ReceivableRow[] = [];
  for (const order of orders) {
    const total = calcOrder(order.items, {
      discPct: order.discPct,
      discAmt: order.discAmt,
      ship: order.ship,
      install: order.install,
      noVat: order.noVat,
      vat: settings.vat,
    }).total;
    const paid = paidOf(order);

    const groupId = order.accountId ?? order.id;
    const groupName = order.account?.name ?? `سفارش ${order.id}`;

    for (const chq of order.cheques) {
      // چک clear واریز شده است — مطالبات نیست (core.js:245-250)
      if (chq.status === "clear") continue;
      rows.push({
        accountId: groupId,
        accountName: groupName,
        orderId: order.id,
        kind: "cheque",
        amount: chq.amount,
        due: chq.due,
      });
    }

    const balance = Math.max(0, total - paid);
    if (balance > 0) {
      rows.push({
        accountId: groupId,
        accountName: groupName,
        orderId: order.id,
        kind: "balance",
        amount: balance,
        due: null,
      });
    }
  }

  const byGroup = new Map<string, ReceivableGroup>();
  for (const row of rows) {
    let group = byGroup.get(row.accountId);
    if (!group) {
      group = {
        accountId: row.accountId,
        accountName: row.accountName,
        rows: [],
        chequeAmount: 0,
        balanceAmount: 0,
        total: 0,
      };
      byGroup.set(row.accountId, group);
    }
    group.rows.push(row);
    if (row.kind === "cheque") group.chequeAmount += row.amount;
    else group.balanceAmount += row.amount;
    group.total += row.amount;
  }

  const groups = [...byGroup.values()].sort((a, b) => b.total - a.total);
  const total = groups.reduce((sum, g) => sum + g.total, 0);

  if (hideMoney) return stripReceivables(groups);
  return { groups, total };
}

/** حذف فیلدهای پولی برای نقش‌های noMoney (R-32) — تخریب واقعی. */
function stripReceivables(groups: ReceivableGroup[]): ReceivablesResultNoMoney {
  return {
    groups: groups.map((g) => ({
      accountId: g.accountId,
      accountName: g.accountName,
      rows: g.rows.map(stripRow),
    })),
  };
}

function stripRow(row: ReceivableRow): ReceivableRowNoMoney {
  const { amount, ...rest } = row;
  void amount;
  return rest;
}
