/**
 * آزمون سرویس BOM — PHASE_07 §۱۲ / دروازه خروج ۲.
 *
 * نقشه قوانین Demo (admin.js:68-79):
 *  - ذخیره کامل: ردیف‌های قبلی حذف، فهرست جدید نوشته می‌شود
 *  - ماده تکراری در یک فرمول → ۴۰۹
 *  - ماده غایب → ۴۰۴
 *  - محصول غایب → ۴۰۴
 *  - noMoney: حذف cost/totalCost (R-32)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@core/database/client", () => ({
  prisma: {
    product: { findUnique: vi.fn(), update: vi.fn() },
    bomItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    material: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@core/database/client";
import { getBom, saveBom } from "./bom.service";

const mocked = vi.mocked(prisma) as unknown as {
  product: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  bomItem: {
    deleteMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
  material: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const PRODUCT = {
  id: "p1",
  name: "پنل سه‌بعدی",
  unit: "مترمربع",
  bom: [
    {
      materialId: "m1",
      qty: 2.5,
      material: { id: "m1", code: "RM-101", name: "رزین", unit: "کیلو", price: 5000 },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocked.material.findMany.mockResolvedValue([{ id: "m1" }, { id: "m2" }]);
  mocked.$transaction.mockResolvedValue([]);
});

describe("getBom", () => {
  it("فرمول با هزینه مواد هر ردیف", async () => {
    mocked.product.findUnique.mockResolvedValue(PRODUCT);

    const bom = await getBom("p1", false);
    expect(bom.items).toHaveLength(1);
    expect(bom.items[0]!.cost).toBe(12500);
    expect(bom.totalCost).toBe(12500);
  });

  it("noMoney (R-32): cost و totalCost حذف می‌شوند", async () => {
    mocked.product.findUnique.mockResolvedValue(PRODUCT);

    const bom = await getBom("p1", true);
    expect(bom.items[0]!.cost).toBeUndefined();
    expect(bom.totalCost).toBeUndefined();
    expect(bom.items[0]!.qty).toBe(2.5);
  });

  it("محصول غایب → notFound", async () => {
    mocked.product.findUnique.mockResolvedValue(null);
    await expect(getBom("p9", false)).rejects.toMatchObject({ status: 404 });
  });
});

describe("saveBom", () => {
  it("ذخیره کامل: حذف ردیف‌های قبلی + ایجاد جدید در یک تراکنش", async () => {
    mocked.product.findUnique.mockResolvedValue(PRODUCT);
    mocked.bomItem.createMany.mockImplementation(async (a: never) => a as never);
    mocked.bomItem.deleteMany.mockResolvedValue({ count: 1 });

    await saveBom("p1", {
      items: [
        { materialId: "m1", qty: 3 },
        { materialId: "m2", qty: 1.5 },
      ],
    });

    expect(mocked.$transaction).toHaveBeenCalledTimes(1);
    const steps = mocked.$transaction.mock.calls[0]![0] as unknown[];
    expect(steps).toHaveLength(3);
    expect(mocked.bomItem.deleteMany).toHaveBeenCalledWith({ where: { productId: "p1" } });
    const createArgs = mocked.bomItem.createMany.mock.calls[0]![0] as {
      data: { productId: string; materialId: string; qty: number }[];
    };
    expect(createArgs.data).toEqual([
      { productId: "p1", materialId: "m1", qty: 3 },
      { productId: "p1", materialId: "m2", qty: 1.5 },
    ]);
  });

  it("ماده تکراری → conflict", async () => {
    mocked.product.findUnique.mockResolvedValue(PRODUCT);
    await expect(
      saveBom("p1", {
        items: [
          { materialId: "m1", qty: 1 },
          { materialId: "m1", qty: 2 },
        ],
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("ماده غایب → notFound", async () => {
    mocked.product.findUnique.mockResolvedValue(PRODUCT);
    await expect(saveBom("p1", { items: [{ materialId: "mx", qty: 1 }] })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("محصول غایب → notFound", async () => {
    mocked.product.findUnique.mockResolvedValue(null);
    await expect(saveBom("p9", { items: [] })).rejects.toMatchObject({ status: 404 });
  });
});
