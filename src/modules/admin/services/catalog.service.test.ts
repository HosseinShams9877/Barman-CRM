/**
 * آزمون سرویس کاتالوگ — PHASE_07 §۱۲.
 *
 * نقشه قوانین Demo (admin.js):
 *  - کد تکراری → ۴۰۹ (admin.js:43/62)
 *  - رکورد غایب → ۴۰۴
 *  - noMoney: حذف price/bomCost (R-32)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@core/database/client", () => ({
  prisma: {
    product: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    material: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from "@core/database/client";
import {
  createMaterial,
  createProduct,
  listMaterials,
  listProducts,
  updateMaterial,
  updateProduct,
} from "./catalog.service";

const mocked = vi.mocked(prisma) as unknown as {
  product: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  material: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const PRODUCT_INPUT = {
  code: "BR-139",
  name: "پنل سه‌بعدی",
  line: "prod" as const,
  category: "دیوارپوش",
  unit: "مترمربع" as const,
  price: 250000,
  colors: ["سفید", "کرم"],
  days: 2,
  active: true,
};

const MATERIAL_INPUT = {
  code: "RM-117",
  name: "رزین",
  unit: "کیلو" as const,
  price: 80000,
  min: 50,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listProducts — فهرست مدیریت (admin.js:24)", () => {
  it("همه محصولات (فعال و غیرفعال) با هزینه مواد", async () => {
    mocked.product.findMany.mockResolvedValue([
      {
        id: "p1",
        code: "BR-101",
        name: "پنل",
        line: "prod",
        category: "",
        unit: "مترمربع",
        days: 2,
        active: false,
        supplierId: null,
        colors: ["سفید"],
        price: 100000,
        bom: [{ materialId: "m1", qty: 2 }],
      },
    ]);
    mocked.material.findMany.mockResolvedValue([{ id: "m1", price: 5000 }]);

    const rows = await listProducts(false);
    expect(rows).toHaveLength(1);
    const first = rows[0]!;
    expect(first.active).toBe(false);
    expect(first.price).toBe(100000);
    expect(first.bomCost).toBe(10000);
  });

  it("noMoney (R-32): price و bomCost حذف می‌شوند", async () => {
    mocked.product.findMany.mockResolvedValue([
      { id: "p1", bom: [], price: 100000, colors: [] },
    ]);
    mocked.material.findMany.mockResolvedValue([]);

    const rows = await listProducts(true);
    expect(rows[0]!.price).toBeUndefined();
    expect(rows[0]!.bomCost).toBeUndefined();
  });
});

describe("listMaterials", () => {
  it("همه مواد — قیمت فقط برای نقش‌های دارای money.view", async () => {
    mocked.material.findMany.mockResolvedValue([
      { id: "m1", code: "RM-1", name: "رزین", unit: "کیلو", price: 5000, min: 10 },
    ]);

    const rows = await listMaterials(false);
    expect(rows[0]!.price).toBe(5000);

    const hidden = await listMaterials(true);
    expect(hidden[0]!.price).toBeUndefined();
  });
});

describe("createProduct / updateProduct", () => {
  it("کد تکراری → conflict", async () => {
    mocked.product.findUnique.mockResolvedValue({ id: "other", code: "BR-139" });
    await expect(createProduct(PRODUCT_INPUT)).rejects.toMatchObject({ status: 409 });
  });

  it("ایجاد محصول — فیلدها همانند ورودی نوشته می‌شوند (uppercase در Zod)", async () => {
    mocked.product.findUnique.mockResolvedValue(null);
    mocked.product.create.mockImplementation(async (a: never) => a as never);

    await createProduct(PRODUCT_INPUT);
    const call = mocked.product.create.mock.calls[0]![0] as {
      data: { code: string; colors: string[] };
    };
    expect(call.data.code).toBe("BR-139");
    expect(call.data.colors).toEqual(["سفید", "کرم"]);
  });

  it("ویرایش محصول غایب → notFound", async () => {
    mocked.product.findUnique.mockResolvedValue(null);
    await expect(updateProduct("p9", PRODUCT_INPUT)).rejects.toMatchObject({ status: 404 });
  });

  it("ویرایش محصول — rev یک واحد افزایش می‌یابد (R-06)", async () => {
    mocked.product.findUnique
      .mockResolvedValueOnce({ id: "p1", code: "BR-101" })
      .mockResolvedValueOnce(null); // بررسی کد جدید
    mocked.product.update.mockImplementation(async (a: never) => a as never);

    await updateProduct("p1", { ...PRODUCT_INPUT, code: "BR-139" });
    const call = mocked.product.update.mock.calls[0]![0] as {
      where: { id: string };
      data: { rev: { increment: number } };
    };
    expect(call.where.id).toBe("p1");
    expect(call.data.rev).toEqual({ increment: 1 });
  });
});

describe("createMaterial / updateMaterial", () => {
  it("کد تکراری → conflict", async () => {
    mocked.material.findUnique.mockResolvedValue({ id: "m9", code: "RM-117" });
    await expect(createMaterial(MATERIAL_INPUT)).rejects.toMatchObject({ status: 409 });
  });

  it("ایجاد ماده — قیمت صفر مجاز است (admin.js:64)", async () => {
    mocked.material.findUnique.mockResolvedValue(null);
    mocked.material.create.mockImplementation(async (a: never) => a as never);

    await createMaterial({ ...MATERIAL_INPUT, price: 0 });
    const call = mocked.material.create.mock.calls[0]![0] as { data: { price: number } };
    expect(call.data.price).toBe(0);
  });

  it("ویرایش ماده غایب → notFound", async () => {
    mocked.material.findUnique.mockResolvedValue(null);
    await expect(updateMaterial("m9", MATERIAL_INPUT)).rejects.toMatchObject({ status: 404 });
  });
});
