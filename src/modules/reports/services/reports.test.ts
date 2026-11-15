/**
 * آزمون گزارش تولید و مالی — PHASE_07 §۱۲.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@core/database/client", () => ({
  prisma: {
    job: { findMany: vi.fn() },
    order: { findMany: vi.fn() },
    material: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    txn: { findMany: vi.fn() },
  },
}));

vi.mock("@modules/inventory/services/stock.service", () => ({
  computeOnHand: vi.fn(async () => ({ "raw|m1": 10, "depot|p1": 5 })),
}));

vi.mock("@modules/finance/services/payable.service", () => ({
  listPayables: vi.fn(async () => ({ groups: [{ total: 400 }, { total: 600 }], total: 1000 })),
}));

vi.mock("@modules/finance/services/receivable.service", () => ({
  listReceivables: vi.fn(async () => ({ groups: [{ total: 300 }], total: 300 })),
}));

vi.mock("@modules/finance/constants", () => ({
  toDisplayKind: vi.fn((kind: string) => kind.replace(" COST", "هزینه")),
}));

import { prisma } from "@core/database/client";
import { prodReport } from "./prod.report";
import { finReport } from "./fin.report";

const mocked = vi.mocked(prisma) as unknown as {
  job: { findMany: ReturnType<typeof vi.fn> };
  order: { findMany: ReturnType<typeof vi.fn> };
  material: { findMany: ReturnType<typeof vi.fn> };
  product: { findMany: ReturnType<typeof vi.fn> };
  txn: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("prodReport — تولید و مواد (reports.js:39-47)", () => {
  it("تولید سالم و نرخ ضایعات از QC کارها", async () => {
    mocked.job.findMany.mockResolvedValue([
      { good: 90, waste: 5 },
      { good: 10, waste: 5 },
    ]);
    mocked.order.findMany.mockResolvedValue([]);
    mocked.material.findMany.mockResolvedValue([{ id: "m1", price: 1000 }]);
    mocked.product.findMany.mockResolvedValue([{ id: "p1", price: 500000 }]);

    const report = await prodReport(false);
    expect(report.tiles.good).toBe(100);
    expect(report.tiles.wastePct).toBe(9); // 10 ضایعات از 110 کل
    expect(report.tiles.rawValue).toBe(10000); // 10 × 1000
    expect(report.tiles.depotValue).toBe(2500000); // 5 × 500000
  });

  it("سفارش‌های عقب از برنامه — prod.end گذشته و stage <= ۸", async () => {
    mocked.job.findMany.mockResolvedValue([]);
    mocked.order.findMany.mockResolvedValue([
      { id: "PF-1", prod: { end: Date.now() - 1000 } }, // عقب
      { id: "PF-2", prod: { end: Date.now() + 100000 } }, // سر وقت
      { id: "PF-3", prod: {} }, // بدون برنامه
    ]);
    mocked.material.findMany.mockResolvedValue([]);
    mocked.product.findMany.mockResolvedValue([]);

    const report = await prodReport(false);
    expect(report.late).toEqual([{ id: "PF-1", end: expect.any(Number) }]);
  });

  it("noMoney (R-32): ارزش انبارها حذف می‌شوند", async () => {
    mocked.job.findMany.mockResolvedValue([{ good: 10, waste: 0 }]);
    mocked.order.findMany.mockResolvedValue([]);
    mocked.material.findMany.mockResolvedValue([{ id: "m1", price: 1000 }]);
    mocked.product.findMany.mockResolvedValue([{ id: "p1", price: 500000 }]);

    const report = await prodReport(true);
    expect(report.tiles.rawValue).toBeUndefined();
    expect(report.tiles.depotValue).toBeUndefined();
    expect(report.tiles.good).toBe(10);
  });
});

describe("finReport — مالی (reports.js:48-55)", () => {
  it("دریافتنی/پرداختنی و جریان پول در بازه", async () => {
    mocked.txn.findMany.mockResolvedValue([
      { direction: "income", amount: 500000, kind: "دریافت متفرقه" },
      { direction: "expense", amount: 200000, kind: "هزینه: حمل و بارگیری" },
      { direction: "expense", amount: 300000, kind: "هزینه: سایر" },
    ]);

    const report = await finReport({ days: 90, hideMoney: false });
    expect(report.tiles.receivable).toBe(300);
    expect(report.tiles.payable).toBe(1000);
    expect(report.tiles.income).toBe(500000);
    expect(report.tiles.expense).toBe(500000);
    expect(report.expensesByKind).toHaveLength(2);
    expect(report.expensesByKind[0]!.amount).toBe(300000); // نزولی
  });

  it("noMoney (R-32): بدون مبالغ", async () => {
    const report = await finReport({ days: 90, hideMoney: true });
    expect(report.tiles).toEqual({});
    expect(report.expensesByKind).toEqual([]);
  });

  it("بازه در کوئری txns اعمال می‌شود (CD-06 — مقایسه رشتهای تاریخ)", async () => {
    mocked.txn.findMany.mockResolvedValue([]);
    await finReport({ days: 30, hideMoney: false });
    const arg = mocked.txn.findMany.mock.calls[0]![0] as { where?: { at?: { gte?: string } } };
    const from = arg?.where?.at?.gte ?? "";
    expect(from).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });
});
