/**
 * آزمون خلاصه داشبورد — PHASE_07 §۱۲ / A-7.3.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@core/database/client", () => ({
  prisma: {
    lead: { count: vi.fn() },
    order: { count: vi.fn(), groupBy: vi.fn(async () => [{ stage: 3, _count: { _all: 2 } }]) },
    orderCheque: { findMany: vi.fn() },
  },
}));

vi.mock("@modules/inventory/services/stock.service", () => ({
  getStockAlerts: vi.fn(async () => [
    { itemId: "m1", name: "رزین", code: "RM-1", unit: "کیلو", onHand: 1, min: 10, shortfall: 9 },
  ]),
}));

import { prisma } from "@core/database/client";
import { getDashboardSummary } from "./summary.service";

const mocked = vi.mocked(prisma) as unknown as {
  lead: { count: ReturnType<typeof vi.fn> };
  order: { count: ReturnType<typeof vi.fn> };
  orderCheque: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocked.lead.count.mockResolvedValue(7);
  mocked.order.count.mockResolvedValue(4);
  mocked.orderCheque.findMany.mockResolvedValue([{ amount: 500000 }, { amount: 300000 }]);
});

describe("getDashboardSummary — چهار کارت (PHASE_07 §۱)", () => {
  it("سرنخ باز، سفارش جاری، هشدار موجودی، چک سررسید", async () => {
    const s = await getDashboardSummary({ restrictToOwner: false, userId: "u1" }, false);

    expect(s.openLeads).toBe(7);
    expect(s.activeOrders).toBe(4);
    expect(s.stockAlerts).toBe(1);
    expect(s.dueCheques).toBe(2);
    expect(s.dueChequesAmount).toBe(800000);
  });

  it("scoping: محدود به مالک — فیلتر در کوئری سرور (PHASE_07 §۸)", async () => {
    await getDashboardSummary({ restrictToOwner: true, userId: "u9" }, false);

    const leadArgs = mocked.lead.count.mock.calls[0]![0] as { where: { ownerId?: string } };
    expect(leadArgs.where.ownerId).toBe("u9");
    const orderArgs = mocked.order.count.mock.calls[0]![0] as { where: { ownerId?: string } };
    expect(orderArgs.where.ownerId).toBe("u9");
  });

  it("noMoney (R-32): مبلغ چک‌ها حذف می‌شود", async () => {
    const s = await getDashboardSummary({ restrictToOwner: false, userId: "u1" }, true);
    expect(s.dueCheques).toBe(2);
    expect(s.dueChequesAmount).toBeUndefined();
  });

  it("چک‌های سررسید با مقایسه رشتهای تاریخ شمسی (CD-06)", async () => {
    await getDashboardSummary({ restrictToOwner: false, userId: "u1" }, false);

    const args = mocked.orderCheque.findMany.mock.calls[0]![0] as {
      where: { due: { gte: string; lte: string }; status: { not: string } };
    };
    expect(args.where.due.gte).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    expect(args.where.due.lte).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    expect(args.where.status).toEqual({ not: "clear" });
  });
});
