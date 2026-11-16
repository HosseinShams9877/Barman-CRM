/**
 * سرویس خلاصه داشبورد خانه — PHASE_07 §۱۰ (A-7.3).
 *
 * چهار کارت خلاصه طبق PHASE_07 §۱:
 *  - سرنخ‌های باز (raw/opp/pf)
 *  - سفارش‌های در جریان (status = open)
 *  - هشدار موجودی مواد (کمتر از حداقل — app/stock.js:27)
 *  - چک‌های نزد سررسید (۷ روز آینده — home.js:64)
 *
 * برای سایدبار (پریتی دمو): تعداد سفارش در هر مرحله (stageCounts) و
 * تعداد چک‌های ناقص (incompleteCheques) هم برگردانده می‌شود.
 *
 * قوانین:
 *  - scoping در سرور: نقش‌های با leads.view بدون leads.viewAll (sales)
 *    فقط سرنخ‌ها و سفارش‌های خودشان را می‌بینند (PHASE_07 §۸).
 *  - noMoney (R-32): مبلغ چک‌ها فقط برای نقش‌های دارای money.view.
 *  - موجودی همیشه تجمع لحظه‌ای از حرکت‌هاست (CD-08).
 */
import { prisma } from "@core/database/client";
import { instantToJalaliIso } from "@core/calendar";
import { getStockAlerts } from "@modules/inventory/services/stock.service";
import { MS_PER_DAY } from "../../reports/services/bucketing";
import { toEnDigits } from "@core/formatting";
import type { DashboardWorkspace } from "./workspace.service";

/** محدوده دید داشبورد — ساخته‌شده در Route Handler از مجوزها (CD-05). */
export type DashboardScope = {
  restrictToOwner: boolean;
  userId: string;
};

export type DashboardSummary = {
  /** سرنخ‌های باز (raw/opp/pf). */
  openLeads: number;
  /** سفارش‌های در جریان (status = open). */
  activeOrders: number;
  /** تعداد مواد زیر حداقل موجودی. */
  stockAlerts: number;
  /** چک‌های دریافتی سررسید در ۷ روز آینده — home.js:64. */
  dueCheques: number;
  /** مبلغ چک‌های نزد سررسید — فقط برای نقش‌های دارای money.view. */
  dueChequesAmount?: number;
  /** تعداد سفارش‌های باز در هر مرحله (کلید = شماره مرحله ۱..۱۱) — برای badge سایدبار. */
  stageCounts: Record<number, number>;
  /** تعداد چک‌های ناقص (بدون sayad کامل) — برای badge سایدبار (home.js TASKS.nochq). */
  incompleteCheques: number;
  workspace?: DashboardWorkspace;
};

/** مرحله‌های باز سرنخ — won/lost بسته هستند. */
const OPEN_LEAD_STAGES = ["raw", "opp", "pf"];

/**
 * خلاصه داشبورد — تجمع سمت سرور (PHASE_07 §۱۳: تجمیع در سرور).
 */
export async function getDashboardSummary(
  scope: DashboardScope,
  hideMoney: boolean,
): Promise<DashboardSummary> {
  const leadWhere = { stage: { in: OPEN_LEAD_STAGES } } as const;
  const orderWhere = { status: "open" } as const;
  const ownerFilter = scope.restrictToOwner ? { ownerId: scope.userId } : {};

  const [openLeads, activeOrders, alerts, stageGroups] = await Promise.all([
    prisma.lead.count({
      where: scope.restrictToOwner ? { ...leadWhere, ownerId: scope.userId } : leadWhere,
    }),
    prisma.order.count({
      where: scope.restrictToOwner ? { ...orderWhere, ownerId: scope.userId } : orderWhere,
    }),
    getStockAlerts(),
    prisma.order.groupBy({
      by: ["stage"],
      where: { status: "open", ...ownerFilter },
      _count: { _all: true },
    }),
  ]);

  // نرمال‌سازی stageCounts به یک شیء با کلید همه ۱۱ مرحله (۰ پیش‌فرض)
  const stageCounts: Record<number, number> = {};
  for (let s = 1; s <= 11; s++) stageCounts[s] = 0;
  for (const g of stageGroups) {
    stageCounts[g.stage] = g._count._all;
  }

  // چک‌های دریافتی با سررسید ۷ روز آینده (home.js:64) — چک clear واریز شده.
  const now = Date.now();
  const fromIso = instantToJalaliIso(now);
  const toIso = instantToJalaliIso(now + 7 * MS_PER_DAY);

  const cheques = await prisma.orderCheque.findMany({
    where: { status: { not: "clear" }, due: { gte: fromIso, lte: toIso }, ...(scope.restrictToOwner ? { order: { ownerId: scope.userId } } : {}) },
    select: { amount: true, sayad: true, status: true },
  });

  // چک ناقص: sayad خالی یا کمتر از ۱۶ رقم (home.js chqDone/chqIncomplete)
  const openCheques = await prisma.orderCheque.findMany({
    where: { order: { status: "open", stage: { gte: 6 }, ...ownerFilter } },
    select: { sayad: true, due: true, bank: true, owner: true },
  });
  const incompleteCheques = openCheques.filter((c) => toEnDigits(c.sayad ?? "").replace(/\D/g, "").length !== 16 || !c.due || !c.bank || !c.owner).length;

  return {
    openLeads,
    activeOrders,
    stockAlerts: alerts.length,
    dueCheques: cheques.length,
    ...(hideMoney ? {} : { dueChequesAmount: cheques.reduce((s, c) => s + c.amount, 0) }),
    stageCounts,
    incompleteCheques,
  };
}
