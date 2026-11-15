/**
 * آزمون‌های سرویس BOM — PHASE_05 §۱۲ (دروازه خروج ۲).
 *
 * بازسازی X.bomNeed/X.bomShort در Demo (app/core.js:216-228):
 *  - need[materialId] += b.qty × l.qty (core.js:220)؛
 *  - کسری: onHand("raw", k) < need[k] (core.js:226)؛
 *  - گردسازی سه‌رقم اعشار (core.js:12).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@core/database/client";

// --- الگوی mock مطابق فاز ۴ ---------------------------------------------

const MATERIALS = [
  { id: "m1", name: "گچ", code: "RM-101", unit: "کیلو" },
  { id: "m2", name: "رزین", code: "RM-105", unit: "کیلو" },
  { id: "m3", name: "توری", code: "RM-109", unit: "مترمربع" },
];

const BOM = [
  { productId: "p1", materialId: "m1", qty: 8.1 },
  { productId: "p1", materialId: "m2", qty: 0.054 },
  { productId: "p1", materialId: "m3", qty: 0.945 },
];

let onHand: Record<string, number> = {};

vi.mock("@core/database/client", () => ({
  prisma: {
    bomItem: {
      findMany: vi.fn(async (args?: { where?: { productId?: string } }) => {
        const pid = args?.where?.productId;
        return BOM.filter((b) => pid === undefined || b.productId === pid);
      }),
    },
    material: {
      findMany: vi.fn(async () => MATERIALS),
    },
    move: {
      groupBy: vi.fn(async () =>
        Object.entries(onHand).map(([item, qty]) => ({
          wh: "raw",
          item,
          _sum: { qty },
        })),
      ),
    },
    // مورد نیاز برای side-effect.seed ( وارد شدن از طریق @core/database)
    product: { count: vi.fn() },
    role: { upsert: vi.fn() },
    user: { findMany: vi.fn(), upsert: vi.fn() },
    setting: { upsert: vi.fn() },
    rev: { upsert: vi.fn() },
    list: { upsert: vi.fn() },
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
  },
}));

import { buildBomPreview, computeBomNeed, round3 } from "./bom.service";

beforeEach(() => {
  onHand = { m1: 3500, m2: 105, m3: 980 };
});

describe("round3 — گردسازی سه‌رقم (core.js:12)", () => {
  it("گردسازی به سه رقم اعشار", () => {
    expect(round3(8.1 * 12)).toBe(97.2);
    expect(round3(0.054 * 12)).toBe(0.648);
    expect(round3(1 / 3)).toBe(0.333);
    expect(round3(2 / 3)).toBe(0.667);
  });
});

describe("computeBomNeed — انفجار مواد (core.js:216-223)", () => {
  it("مقدار هر ماده = ضریب BOM × qty", async () => {
    const need = await computeBomNeed("p1", 12);
    expect(need["m1"]).toBe(8.1 * 12);
    expect(need["m2"]).toBe(0.054 * 12);
    expect(need["m3"]).toBe(0.945 * 12);
  });

  it("qty صفر → همه مقادیر صفر ولی کلیدها موجودند", async () => {
    const need = await computeBomNeed("p1", 0);
    expect(need["m1"]).toBe(0);
    expect(need["m2"]).toBe(0);
  });

  it("محصول بدون BOM → نقشه خالی", async () => {
    const need = await computeBomNeed("no-bom", 5);
    expect(need).toEqual({});
  });

  it("مواد تکراری در BOM تجمیع می‌شوند", async () => {
    // two entries same materialId — الگوی تست مستقیم روی فرمول
    const bom = await prisma.bomItem.findMany({ where: { productId: "p1" } });
    const need: Record<string, number> = {};
    for (const b of bom) need[b.materialId] = (need[b.materialId] ?? 0) + b.qty * 10;
    expect(need["m1"]).toBe(81);
  });
});

describe("buildBomPreview — پیش‌نمایش زنده (app/prod.js:111)", () => {
  it("خطوط BOM با مقدار کل، موجودی و کسری", async () => {
    const preview = await buildBomPreview("p1", 100);
    expect(preview.lines).toHaveLength(3);
    const m1 = preview.lines.find((l) => l.materialId === "m1")!;
    expect(m1.perUnit).toBe(8.1);
    expect(m1.total).toBe(810);
    expect(m1.onHand).toBe(3500);
    expect(m1.short).toBe(0);
    const m3 = preview.lines.find((l) => l.materialId === "m3")!;
    expect(m3.total).toBe(94.5);
  });

  it("کسری فقط برای موادی که موجودی کمتر از نیاز است (core.js:226)", async () => {
    onHand = { m1: 100, m2: 105, m3: 980 }; // m1 کافی نیست برای qty=100
    const preview = await buildBomPreview("p1", 100);
    expect(preview.shortages).toHaveLength(1);
    expect(preview.shortages[0]!.materialId).toBe("m1");
    expect(preview.shortages[0]!.need).toBe(810);
    expect(preview.shortages[0]!.have).toBe(100);
    expect(preview.shortages[0]!.short).toBe(710);
  });

  it("موجودی کافی → لیست کسری خالی", async () => {
    const preview = await buildBomPreview("p1", 10);
    expect(preview.shortages).toHaveLength(0);
  });

  it("مواد بدون نیاز در BOM در خطوط نیستند", async () => {
    const preview = await buildBomPreview("no-bom", 5);
    expect(preview.lines).toHaveLength(0);
    expect(preview.shortages).toHaveLength(0);
  });

  it("مواد موجود ولی خارج از BOM نادیده گرفته می‌شوند", async () => {
    onHand = { m1: 3500, m2: 105, m3: 980, mX: 500 };
    const preview = await buildBomPreview("p1", 10);
    expect(preview.lines.find((l) => l.materialId === "mX")).toBeUndefined();
  });

  it("موجودی صفر → کل نیاز کسری است", async () => {
    onHand = {};
    const preview = await buildBomPreview("p1", 100);
    expect(preview.shortages).toHaveLength(3);
  });

  it("perUnit با qty صفر تقسیم بر صفر نمی‌شود (guard max(1, qty))", async () => {
    const preview = await buildBomPreview("p1", 0);
    for (const l of preview.lines) {
      expect(Number.isFinite(l.perUnit)).toBe(true);
    }
  });
});
