/**
 * آزمون سرویس گزارش سرنخ‌ها — PHASE_07 §۱۲.
 *
 * نقشه قوانین Demo (reports.js:12-27):
 *  - فیلتر بازه روزها + خط محصول
 *  - شمارش مرحله‌ای (opp/pf/won/lost)
 *  - فروش سرنخ won از سفارش مرتبط
 *  - scoping: sales فقط سرنخ‌های خودش (PHASE_07 §۸)
 *  - noMoney: حذف rev (R-32)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@core/database/client", () => ({
  prisma: {
    lead: { findMany: vi.fn() },
    leadFollowup: { findMany: vi.fn() },
  },
}));

vi.mock("@modules/settings/services/settings.service", () => ({
  getSettings: vi.fn(async () => ({ vat: 10 })),
}));

vi.mock("@modules/orders/services/order.service", () => ({
  calcOrder: vi.fn((items: { qty: number; price: number }[], opts: { discPct: number }) => {
    const sub = items.reduce((s, i) => s + i.qty * i.price, 0);
    const total = Math.round(sub * (1 - opts.discPct / 100));
    return { sub, total };
  }),
}));

import { prisma } from "@core/database/client";
import { leadsReport } from "./leads.report";

const mocked = vi.mocked(prisma) as unknown as {
  lead: { findMany: ReturnType<typeof vi.fn> };
  leadFollowup: { findMany: ReturnType<typeof vi.fn> };
};

const LEADS = [
  {
    id: "LD-1",
    stage: "won",
    source: "اینستاگرام",
    line: "prod",
    ownerId: "u1",
    owner: { name: "نگار" },
    lostReason: null,
    createdAt: 1n,
    orders: [
      {
        status: "open",
        discPct: 0,
        discAmt: 0,
        ship: 0,
        install: 0,
        noVat: false,
        items: [{ qty: 10, price: 100000, discount: 0 }],
      },
    ],
  },
  {
    id: "LD-2",
    stage: "lost",
    source: "تماس مستقیم",
    line: "prod",
    ownerId: "u2",
    owner: { name: "علی" },
    lostReason: "قیمت",
    createdAt: 2n,
    orders: [],
  },
  {
    id: "LD-3",
    stage: "opp",
    source: "اینستاگرام",
    line: "agency",
    ownerId: "u1",
    owner: { name: "نگار" },
    lostReason: null,
    createdAt: 3n,
    orders: [],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocked.lead.findMany.mockResolvedValue(LEADS as never);
  mocked.leadFollowup.findMany.mockResolvedValue([
    { leadId: "LD-3", nextAt: "1405/08/19" },
  ] as never);
});

describe("leadsReport — تجمیع (reports.js:15-26)", () => {
  it("تجمیع بر اساس منبع با شمارش مرحله‌ای", async () => {
    const report = await leadsReport({
      days: 90,
      line: null,
      scope: { restrictToOwner: false, userId: "u1" },
      hideMoney: false,
    });

    const ig = report.bySource.find((r) => r.source === "اینستاگرام")!;
    expect(ig.n).toBe(2);
    expect(ig.opp).toBe(2);
    expect(ig.pf).toBe(1);
    expect(ig.won).toBe(1);
    expect(ig.rev).toBe(1000000);

    const call = report.bySource.find((r) => r.source === "تماس مستقیم")!;
    expect(call.lost).toBe(1);
  });

  it("فیلتر خط محصول در کوئری اعمال می‌شود (reports.js:14)", async () => {
    await leadsReport({
      days: 90,
      line: "agency",
      scope: { restrictToOwner: false, userId: "u1" },
      hideMoney: false,
    });
    const arg = mocked.lead.findMany.mock.calls[0]![0] as { where: { line?: string } };
    expect(arg.where.line).toBe("agency");
  });

  it("دلایل از دست رفتن با نامشخص پیش‌فرض (reports.js:22)", async () => {
    const report = await leadsReport({
      days: 90,
      line: null,
      scope: { restrictToOwner: false, userId: "u1" },
      hideMoney: false,
    });
    expect(report.lostReasons).toEqual([{ reason: "قیمت", n: 1 }]);
  });

  it("scoping: sales فقط سرنخ‌های خودش (PHASE_07 §۸)", async () => {
    await leadsReport({
      days: 90,
      line: null,
      scope: { restrictToOwner: true, userId: "u1" },
      hideMoney: false,
    });
    const arg = mocked.lead.findMany.mock.calls[0]![0] as { where: { ownerId?: string } };
    expect(arg.where.ownerId).toBe("u1");
  });

  it("noMoney (R-32): حذف فیلد rev", async () => {
    const report = await leadsReport({
      days: 90,
      line: null,
      scope: { restrictToOwner: false, userId: "u1" },
      hideMoney: true,
    });
    expect(report.bySource[0]).not.toHaveProperty("rev");
    expect(report.byOwner[0]).not.toHaveProperty("rev");
    expect(report.byOwner[0]!.due).toBe(1); // shut up unused
  });

  it("پیگیری معوق در ستون کارشناس شمارش می‌شود (reports.js:19)", async () => {
    const report = await leadsReport({
      days: 90,
      line: null,
      scope: { restrictToOwner: false, userId: "u1" },
      hideMoney: false,
    });
    const negar = report.byOwner.find((o) => o.ownerName === "نگار")!;
    expect(negar.due).toBe(1);
  });
});
