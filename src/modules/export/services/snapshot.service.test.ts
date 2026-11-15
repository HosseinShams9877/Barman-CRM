/**
 * آزمون سازنده snapshot — PHASE_07 §۱۲ / دروازه خروج ۷.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@core/database/client", () => ({
  prisma: {
    user: { findMany: vi.fn() },
    role: { findMany: vi.fn() },
    setting: { findMany: vi.fn() },
    list: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    material: { findMany: vi.fn() },
    supplier: { findMany: vi.fn() },
    account: { findMany: vi.fn() },
    lead: { findMany: vi.fn() },
    order: { findMany: vi.fn() },
    job: { findMany: vi.fn() },
    move: { findMany: vi.fn() },
    buy: { findMany: vi.fn() },
    txn: { findMany: vi.fn() },
  },
}));

import { prisma } from "@core/database/client";
import { buildSnapshot } from "./snapshot.service";

type FindMany = { findMany: ReturnType<typeof vi.fn> };

const mocked = {
  user: vi.mocked(prisma).user as unknown as FindMany,
  role: vi.mocked(prisma).role as unknown as FindMany,
  setting: vi.mocked(prisma).setting as unknown as FindMany,
  list: vi.mocked(prisma).list as unknown as FindMany,
  product: vi.mocked(prisma).product as unknown as FindMany,
  material: vi.mocked(prisma).material as unknown as FindMany,
  supplier: vi.mocked(prisma).supplier as unknown as FindMany,
  account: vi.mocked(prisma).account as unknown as FindMany,
  lead: vi.mocked(prisma).lead as unknown as FindMany,
  order: vi.mocked(prisma).order as unknown as FindMany,
  job: vi.mocked(prisma).job as unknown as FindMany,
  move: vi.mocked(prisma).move as unknown as FindMany,
  buy: vi.mocked(prisma).buy as unknown as FindMany,
  txn: vi.mocked(prisma).txn as unknown as FindMany,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocked.user.findMany.mockResolvedValue([
    { id: "u1", name: "admin", title: "ادمین", off: false, roles: [{ roleKey: "admin" }] },
  ]);
  mocked.role.findMany.mockResolvedValue([{ key: "admin", name: "ادمین" }]);
  mocked.setting.findMany.mockResolvedValue([{ id: 0, vat: 10 }]);
  mocked.list.findMany.mockResolvedValue([{ key: "sources", items: ["تماس"] }]);
  mocked.product.findMany.mockResolvedValue([
    { id: "p1", code: "BR-101", bom: [{ materialId: "m1", qty: 2 }] },
  ]);
  mocked.material.findMany.mockResolvedValue([{ id: "m1", code: "RM-1" }]);
  mocked.supplier.findMany.mockResolvedValue([]);
  mocked.account.findMany.mockResolvedValue([{ id: "AC-110", createdAt: 100n }]);
  mocked.lead.findMany.mockResolvedValue([{ id: "LD-1001", createdAt: 100n }]);
  mocked.order.findMany.mockResolvedValue([{ id: "PF-1201", createdAt: 100n, items: [], payments: [], cheques: [], stageLog: [] }]);
  mocked.job.findMany.mockResolvedValue([{ id: "PJ-501", createdAt: 100n }]);
  mocked.move.findMany.mockResolvedValue([{ id: "MV-1", createdAt: 100n }]);
  mocked.buy.findMany.mockResolvedValue([{ id: "BY-101", createdAt: 100n }]);
  mocked.txn.findMany.mockResolvedValue([]);
});

describe("buildSnapshot — ساختار معادل پوشه data (server/export.js:39)", () => {
  it("meta + orders + docs + seq کامل", async () => {
    const snap = await buildSnapshot();

    expect(Object.keys(snap)).toEqual(["meta", "orders", "docs", "seq"]);
    expect(snap.orders).toHaveLength(1);
    expect(Object.keys(snap.docs).sort()).toEqual(
      ["accounts", "buys", "jobs", "leads", "moves", "txns"].sort(),
    );

    // meta: کاربران با نقش تک‌نقشی Demo-like
    expect(snap.meta.users).toEqual([
      { id: "u1", name: "admin", title: "ادمین", off: false, role: "admin" },
    ]);

    // meta.cat: فرمول محصول به ساختار Demo (m/q)
    const cat = snap.meta.cat as { products: { bom: { m: string; q: number }[] }[] };
    expect(cat.products[0]).toMatchObject({
      bom: [{ m: "m1", q: 2 }],
    });
  });

  it("seq از شناسه‌های موجود استخراج می‌شود", async () => {
    const snap = await buildSnapshot();
    const seq = Object.fromEntries(snap.seq.map((s) => [s.kind, s.n]));
    expect(seq).toEqual({ PF: 1201, LD: 1001, AC: 110, BY: 101, PJ: 501, MV: 1 });
  });

  it("BigInt → number (JSON-safe — CD-07)", async () => {
    const snap = await buildSnapshot();
    const accounts = snap.docs.accounts ?? [];
    expect(accounts[0]).toMatchObject({ id: "AC-110", createdAt: 100 });
    expect(typeof accounts[0]?.["createdAt"]).toBe("number");
  });

  it(".seq خالی وقتی شناسه‌ای پیشوند ندارد", async () => {
    mocked.order.findMany.mockResolvedValue([{ id: "none", createdAt: 0n }]);
    mocked.lead.findMany.mockResolvedValue([{ id: "none", createdAt: 0n }]);
    mocked.account.findMany.mockResolvedValue([{ id: "none", createdAt: 0n }]);
    mocked.job.findMany.mockResolvedValue([{ id: "none", createdAt: 0n }]);
    mocked.move.findMany.mockResolvedValue([{ id: "none", createdAt: 0n }]);
    mocked.buy.findMany.mockResolvedValue([{ id: "none", createdAt: 0n }]);

    const snap = await buildSnapshot();
    expect(snap.seq).toEqual([]);
  });
});
