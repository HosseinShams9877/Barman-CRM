/**
 * آزمون سرویس گزارش فروش — PHASE_07 §۱۲ / دروازه خروج ۵ (R-11).
 *
 * نقشه قوانین Demo (reports.js:28-38):
 *  - فقط سفارش‌های قطعی (stage >= 6 یا done) و لغو‌نشده
 *  - bucketing ماهانه با JDN — رفع slice(0,7)
 *  - تجمیع به تفکیک محصول با فیلتر خط
 *  - scoping و noMoney
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@core/database/client", () => ({
  prisma: {
    order: { findMany: vi.fn(), count: vi.fn() },
  },
}));

vi.mock("@modules/settings/services/settings.service", () => ({
  getSettings: vi.fn(async () => ({ vat: 10 })),
}));

vi.mock("@modules/orders/services/order.service", () => ({
  calcOrder: vi.fn((items: { qty: number; price: number }[]) => ({
    total: items.reduce((s, i) => s + i.qty * i.price, 0),
  })),
}));

import { prisma } from "@core/database/client";
import { salesReport } from "./sales.report";
import { MS_PER_DAY, monthKeyOf } from "./bucketing";

const mocked = vi.mocked(prisma) as unknown as {
  order: { findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
};

const NOW = 1763300000000;

/** سفارش قطعی در ماه ۱۴۰۵/۰۸ با دو قلم. */
function orderFixture(id: string, productId: string, line: string, times: Record<string, number>) {
  return {
    id,
    status: "open",
    stage: 6,
    discPct: 0,
    discAmt: 0,
    ship: 0,
    install: 0,
    noVat: false,
    times,
    createdAt: 1n,
    ownerId: "u1",
    items: [
      {
        productId,
        qty: 10,
        price: 100000,
        discount: 0,
        product: { name: "پنل", code: "BR-101", unit: "مترمربع", line },
      },
    ],
    payments: [],
    cheques: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  mocked.order.count.mockResolvedValue(5);
});

afterEach(() => {
  vi.useRealTimers();
});

import { afterEach } from "vitest";

describe("salesReport — تجمیع (reports.js:28-38)", () => {
  it("فقط سفارش‌های در بازه شمارش می‌شوند (reports.js:30-32)", async () => {
    mocked.order.findMany.mockResolvedValue([
      orderFixture("PF-1", "p1", "prod", { 6: NOW - 10 * MS_PER_DAY }),
      orderFixture("PF-2", "p1", "prod", { 6: NOW - 400 * MS_PER_DAY }), // خارج از بازه ۹۰ روزه
    ]);

    const report = await salesReport({
      days: 90,
      line: null,
      scope: { restrictToOwner: false, userId: "u1" },
      hideMoney: false,
    });

    expect(report.tiles.orders).toBe(1);
    expect(report.tiles.total).toBe(1000000);
    expect(report.tiles.conversion).toBe(20); // 1 / 5
  });

  it("bucketing ماهانه با JDN — نه slice(0,7) (دروازه خروج ۵)", async () => {
    mocked.order.findMany.mockResolvedValue([
      orderFixture("PF-1", "p1", "prod", { 6: NOW - 10 * MS_PER_DAY }),
      orderFixture("PF-2", "p1", "prod", { 6: NOW - 50 * MS_PER_DAY }),
    ]);

    const report = await salesReport({
      days: 90,
      line: null,
      scope: { restrictToOwner: false, userId: "u1" },
      hideMoney: false,
    });

    // کلید هر ماه باید با محاسبه مستقیم JDN یکسان باشد و مرتب صعودی.
    const expected = [NOW - 50 * MS_PER_DAY, NOW - 10 * MS_PER_DAY]
      .map((t) => monthKeyOf(t))
      .sort((a, b) => a.localeCompare(b));
    expect(report.byMonth.map((r) => r.month)).toEqual(expected);
    for (const row of report.byMonth) {
      expect(row.month).toMatch(/^\d{4}\/\d{2}$/);
      expect(row.total).toBeGreaterThan(0);
    }
  });

  it("فیلتر خط محصول روی اقلام اعمال می‌شود (reports.js:32-33)", async () => {
    mocked.order.findMany.mockResolvedValue([
      orderFixture("PF-1", "p1", "prod", { 6: NOW }),
      orderFixture("PF-2", "p2", "agency", { 6: NOW }),
    ]);

    const report = await salesReport({
      days: 90,
      line: "agency",
      scope: { restrictToOwner: false, userId: "u1" },
      hideMoney: false,
    });

    expect(report.byProduct).toHaveLength(1);
    expect(report.byProduct[0]!.productId).toBe("p2");
  });

  it("scoping: sales فقط سفارش‌های خودش (PHASE_07 §۸)", async () => {
    mocked.order.findMany.mockResolvedValue([]);

    await salesReport({
      days: 90,
      line: null,
      scope: { restrictToOwner: true, userId: "u9" },
      hideMoney: false,
    });

    const arg = mocked.order.findMany.mock.calls[0]![0] as { where: { ownerId?: string } };
    expect(arg.where.ownerId).toBe("u9");
    const countArg = mocked.order.count.mock.calls[0]![0] as { where: { ownerId?: string } };
    expect(countArg.where.ownerId).toBe("u9");
  });

  it("noMoney (R-32): مبالغ حذف می‌شوند", async () => {
    mocked.order.findMany.mockResolvedValue([orderFixture("PF-1", "p1", "prod", { 6: NOW })]);

    const report = await salesReport({
      days: 90,
      line: null,
      scope: { restrictToOwner: false, userId: "u1" },
      hideMoney: true,
    });

    expect(report.tiles.total).toBeUndefined();
    expect(report.byMonth).toEqual([]);
    expect(report.byProduct[0]).not.toHaveProperty("amount");
  });

  it("بدون سفارش — تبدیل صفر", async () => {
    mocked.order.findMany.mockResolvedValue([]);
    mocked.order.count.mockResolvedValue(0);

    const report = await salesReport({
      days: 90,
      line: null,
      scope: { restrictToOwner: false, userId: "u1" },
      hideMoney: false,
    });
    expect(report.tiles.orders).toBe(0);
    expect(report.tiles.conversion).toBe(0);
  });
});
