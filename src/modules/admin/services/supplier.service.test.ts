/**
 * آزمون سرویس مدیریت تأمین‌کنندگان — PHASE_07 §۱۲.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@core/database/client", () => ({
  prisma: {
    supplier: { findMany: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@core/formatting", () => ({
  normalizePhone: vi.fn((p: string) => (p ? "0" + p.replace(/\D/g, "").slice(-10) : "")),
}));

import { prisma } from "@core/database/client";
import { createSupplier, listAllSuppliers, updateSupplier } from "./supplier.service";

const mocked = vi.mocked(prisma) as unknown as {
  supplier: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listAllSuppliers", () => {
  it("همه تأمین‌کنندگان هر دو نوع — مرتب بر نام", async () => {
    mocked.supplier.findMany.mockResolvedValue([
      { id: "s1", name: "آریا", kind: "raw", phone: "09120000000", terms: "چک ۳۰", items: ["m1"] },
      { id: "s2", name: "نمایندگی", kind: "agency", phone: "", terms: "", items: [] },
    ]);

    const rows = await listAllSuppliers();
    expect(rows).toHaveLength(2);
    expect(rows[0]!.kind).toBe("raw");
    expect(rows[1]!.items).toEqual([]);
  });
});

describe("createSupplier", () => {
  it("نام اجباری است — تلفن نرمال می‌شود (admin.js:110-112)", async () => {
    mocked.supplier.create.mockImplementation(async (a: never) => ({ ...(a as { data: object }).data, id: "s9" }));
    mocked.supplier.findUniqueOrThrow.mockResolvedValue({
      id: "s9",
      name: "آریا",
      kind: "raw",
      phone: "09120000000",
      terms: "چک",
      items: [],
    });

    await createSupplier({ name: "آریا", kind: "raw", phone: "9120000000", terms: "چک" });
    const call = mocked.supplier.create.mock.calls[0]![0] as { data: { phone: string; kind: string } };
    expect(call.data.phone).toBe("09120000000");
    expect(call.data.kind).toBe("raw");
  });
});

describe("updateSupplier", () => {
  it("تأمین‌کننده غایب → notFound", async () => {
    mocked.supplier.findUnique.mockResolvedValue(null);
    await expect(
      updateSupplier("s9", { name: "x", kind: "raw" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("ویرایش — rev یک واحد افزایش می‌یابد (R-06)", async () => {
    mocked.supplier.findUnique.mockResolvedValue({ id: "s1", name: "آریا" });
    mocked.supplier.findUniqueOrThrow.mockResolvedValue({
      id: "s1",
      name: "آریا ۲",
      kind: "agency",
      phone: "",
      terms: "",
      items: [],
    });
    mocked.supplier.update.mockImplementation(async (a: never) => (a as { data: object }).data as never);

    await updateSupplier("s1", { name: "آریا ۲", kind: "agency" });
    const call = mocked.supplier.update.mock.calls[0]![0] as {
      data: { name: string; kind: string; rev: { increment: number } };
    };
    expect(call.data.name).toBe("آریا ۲");
    expect(call.data.rev).toEqual({ increment: 1 });
  });
});
