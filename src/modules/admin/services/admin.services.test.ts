/**
 * آزمون سرویس ۷ فهرست و تنظیمات — PHASE_07 §۱۲.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@core/database/client", () => ({
  prisma: {
    list: { findMany: vi.fn(), upsert: vi.fn() },
    setting: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

import { prisma } from "@core/database/client";
import { listLists, saveLists } from "./lists.service";
import { saveSettings } from "./settings.service";

const mocked = vi.mocked(prisma) as unknown as {
  list: {
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  setting: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listLists — ۷ فهرست", () => {
  it("همه ۷ کلید برمی‌گردند — حتی ردیف‌های غایب با فهرست خالی", async () => {
    mocked.list.findMany.mockResolvedValue([
      { key: "sources", items: ["اینستاگرام", "تماس مستقیم"] },
    ]);

    const rows = await listLists();
    expect(rows).toHaveLength(7);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r])) as Record<string, { items: string[]; label: string }>;
    expect(byKey["sources"]!.items).toEqual(["اینستاگرام", "تماس مستقیم"]);
    expect(byKey["waste"]!.items).toEqual([]);
    expect(byKey["lost"]!.label).toBe("دلیل از دست رفتن");
  });
});

describe("saveLists", () => {
  it("هر کلید upsert می‌شود و rev افزایش می‌یابد", async () => {
    mocked.list.upsert.mockImplementation(async (a: never) => a as never);

    await saveLists({ lists: { sources: ["تماس"], lost: ["قیمت"] } });
    expect(mocked.list.upsert).toHaveBeenCalledTimes(2);
    const call = mocked.list.upsert.mock.calls[0]![0] as {
      where: { key: string };
      update: { items: string[]; rev: { increment: number } };
    };
    expect(call.where.key).toBe("sources");
    expect(call.update.rev).toEqual({ increment: 1 });
  });
});

describe("saveSettings", () => {
  const ROW = {
    id: 0,
    vat: 10,
    validDays: 3,
    rate: 3,
    discountCap: { sales: 3, salesManager: 8, management: 100, finance: 0 },
    company: { name: "بارمان", en: "", tagline: "", phone: "", address: "", bale: "" },
    updatedAt: 0,
    rev: 0,
  };

  it("validDays همان مقدار ارسالی نوشته می‌شود (تبدیل ۰→۳ در لایه Zod — admin.js:177)", async () => {
    mocked.setting.findUnique.mockResolvedValue(ROW);
    mocked.setting.update.mockResolvedValue({ ...ROW, validDays: 5 });

    const res = await saveSettings({ vat: 10, validDays: 5, company: ROW.company });
    expect(res.validDays).toBe(5);
    const call = mocked.setting.update.mock.calls[0]![0] as { data: { validDays: number } };
    expect(call.data.validDays).toBe(5);
  });

  it("سقف تخفیف فقط نقش‌های فرم را بازنویسی می‌کند (admin.js:145)", async () => {
    mocked.setting.findUnique.mockResolvedValue(ROW);
    mocked.setting.update.mockResolvedValue({ ...ROW, vat: 9 });

    await saveSettings({
      vat: 9,
      validDays: 5,
      company: ROW.company,
      discountCap: { sales: 5 },
    });

    const call = mocked.setting.update.mock.calls[0]![0] as {
      data: { discountCap: Record<string, number> };
    };
    expect(call.data.discountCap).toMatchObject({
      sales: 5,
      salesManager: 8,
      management: 100,
      finance: 0,
    });
  });

  it("rate هرگز تغییر نمی‌کند (Q-01 معوق)", async () => {
    mocked.setting.findUnique.mockResolvedValue(ROW);
    mocked.setting.update.mockResolvedValue(ROW);

    await saveSettings({ vat: 10, validDays: 3, company: ROW.company });
    const call = mocked.setting.update.mock.calls[0]![0] as { data: { rate?: number } };
    expect(call.data.rate).toBeUndefined();
  });

  it("ردیف تنظیمات غایب → notFound", async () => {
    mocked.setting.findUnique.mockResolvedValue(null);
    await expect(
      saveSettings({ vat: 10, validDays: 3, company: ROW.company }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
