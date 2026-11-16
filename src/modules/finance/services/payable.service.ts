/**
 * سرویس پرداختنی‌ها — چک‌های صادره خرید + مطالبات تأمین‌کنندگان
 * (PHASE_06 §۵/§۶ — «بخش پرداختنی‌ها»).
 *
 * منبع قوانین (CLAUDE.md §۱۳):
 *  - چک‌های صادره خرید با وضعیت `issued` (پرداخت‌نشده) جزو پرداختنی‌ها
 *    هستند؛ چک `paid` پرداخت شده و از پرداختنی‌ها خارج می‌شود
 *    (PHASE_06 §۶: «چک‌های صادره (issued/paid)» — paid تأیید می‌کند
 *    که چک پاس‌شده دیگر پرداختنی نیست — خروج از گزارش).
 *  - مطالبات تأمین‌کننده = مجموع خریدهای `BY` تأییدشده (ok/fin/recv) و
 *    پرداخت‌نشده (PHASE_06 §۶: «مجموع BY تأییدشده و پرداخت‌نشده»).
 *  - `paid` خرید = جمع چک‌های پاس‌شده (fin-core.js:23 — تفسیر دروازه
 *    خروج ۴ PHASE_06).
 *
 * تفسیر ثبت‌شده در DECISION_LOG: برای جلوگیری از دوبار شمارش، نسیه هر
 * خرید برابر `max(0, total − paid − جمع چک‌های issued)` است — یعنی
 * بخشی از بدهی که هنوز چک صادرنشده پوشش نمی‌دهد. جمع کل هر تأمین‌کننده
 * = چک‌های صادره باز + نسیه باقی‌مانده.
 *
 * noMoney (R-32): تمام فیلدهای پولی در پاسخ حذف می‌شوند.
 */
import { prisma } from "@core/database/client";
import type { Prisma } from "@prisma/client";
import type {
  PayableGroup,
  PayableGroupNoMoney,
  PayableRow,
  PayableRowNoMoney,
  PayablesResult,
  PayablesResultNoMoney,
} from "../types/finance.types";
import type { BuyStatus } from "@modules/purchasing/constants";

/** وضعیت‌های خرید تأییدشده — req هنوز تأیید نشده و پرداختنی نیست. */
const APPROVED_BUY_STATUSES: BuyStatus[] = ["ok", "fin", "recv"];

type BuyRow = Prisma.BuyGetPayload<{
  include: {
    supplier: { select: { name: true } };
    cheques: true;
  };
}>;

/**
 * GET /api/finance/payables — پرداختنی‌ها تجمیع‌شده بر اساس تأمین‌کننده.
 *
 * خریدهای بدون تأمین‌کننده تحت کلید `null` تجمیع می‌شوند.
 */
export async function listPayables(
  hideMoney: boolean,
): Promise<PayablesResult | PayablesResultNoMoney> {
  const buys = await prisma.buy.findMany({
    where: { status: { in: APPROVED_BUY_STATUSES } },
    include: {
      supplier: { select: { name: true } },
      cheques: true,
    },
    orderBy: [{ id: "asc" }],
  });

  const rows: PayableRow[] = [];
  for (const buy of buys) {
    const paid = buy.cheques
      .filter((c) => c.status === "paid")
      .reduce((a, c) => a + c.amount, 0);
    const issuedSum = buy.cheques
      .filter((c) => c.status === "issued")
      .reduce((a, c) => a + c.amount, 0);

    const groupId = buy.supplierId ?? "__no-supplier__";
    const groupName = buy.supplier?.name ?? "بدون تأمین‌کننده";

    for (const chq of buy.cheques) {
      if (chq.status !== "issued") continue;
      rows.push({
        supplierId: buy.supplierId,
        supplierName: groupName,
        buyId: buy.id,
        kind: "cheque",
        chequeId: chq.id, sayad: chq.sayad ?? "", status: chq.status,
        amount: chq.amount,
        due: chq.due,
      });
    }

    const balance = Math.max(0, buy.total - paid - issuedSum);
    if (balance > 0) {
      rows.push({
        supplierId: buy.supplierId,
        supplierName: groupName,
        buyId: buy.id,
        kind: "balance",
        amount: balance,
        due: null,
      });
    }
  }

  const byGroup = new Map<string, PayableGroup>();
  for (const row of rows) {
    const key = row.supplierId ?? "__no-supplier__";
    let group = byGroup.get(key);
    if (!group) {
      group = {
        supplierId: key,
        supplierName: row.supplierName ?? "بدون تأمین‌کننده",
        rows: [],
        chequeAmount: 0,
        balanceAmount: 0,
        total: 0,
      };
      byGroup.set(key, group);
    }
    group.rows.push(row);
    if (row.kind === "cheque") group.chequeAmount += row.amount;
    else group.balanceAmount += row.amount;
    group.total += row.amount;
  }

  const groups = [...byGroup.values()].sort((a, b) => b.total - a.total);
  const total = groups.reduce((sum, g) => sum + g.total, 0);

  if (hideMoney) return stripPayables(groups);
  return { groups, total };
}

/** حذف فیلدهای پولی برای نقش‌های noMoney (R-32) — تخریب واقعی. */
function stripPayables(groups: PayableGroup[]): PayablesResultNoMoney {
  return {
    groups: groups.map((g) => ({
      supplierId: g.supplierId,
      supplierName: g.supplierName,
      rows: g.rows.map(stripRow),
    })),
  };
}

function stripRow(row: PayableRow): PayableRowNoMoney {
  const { amount, ...rest } = row;
  void amount;
  return rest;
}
