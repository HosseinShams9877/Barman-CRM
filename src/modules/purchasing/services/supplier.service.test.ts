/**
 * آزمون سرویس تأمین‌کننده — PHASE_06 §۵ (فقط‌خواندن).
 *
 * قوانین بحرانی:
 *  - فیلتر پیش‌فرض `kind: "raw"` (خرید این فاز فقط مواد اولیه — PHASE_06 §۳.۴)؛
 *  - مرتب‌سازی بر اساس نام صعودی.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@core/database/client";
import { listSuppliers } from "./supplier.service";

vi.mock("@core/database/client", () => ({
  prisma: {
    supplier: {
      findMany: vi.fn(),
    },
  },
}));

const supplier = vi.mocked(prisma.supplier);

const RAW_SUPPLIERS = [
  { id: "sup-2", name: "پخش نگین", kind: "raw" },
  { id: "sup-1", name: "تأمین‌کننده آریا", kind: "raw" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listSuppliers", () => {
  it("فقط تأمین‌کنندگان مواد خام را برمی‌گرداند (PHASE_06 §۳.۴)", async () => {
    supplier.findMany.mockResolvedValue(RAW_SUPPLIERS as never);

    const rows = await listSuppliers();

    expect(rows).toEqual(RAW_SUPPLIERS);
    expect(supplier.findMany.mock.calls[0]?.[0]?.where).toEqual({ kind: "raw" });
    expect(supplier.findMany.mock.calls[0]?.[0]?.orderBy).toEqual({ name: "asc" });
    // فیلدهای انتخاب‌شده — فقط شناسه، نام و نوع
    expect(supplier.findMany.mock.calls[0]?.[0]?.select).toEqual({
      id: true,
      name: true,
      kind: true,
    });
  });

  it("بدون تأمین‌کننده لیست خالی است", async () => {
    supplier.findMany.mockResolvedValue([] as never);
    expect(await listSuppliers()).toEqual([]);
  });

  it("خطای پایگاه داده منتشر می‌شود", async () => {
    supplier.findMany.mockRejectedValue(new Error("db down") as never);
    await expect(listSuppliers()).rejects.toThrow("db down");
  });
});
