/**
 * آزمون سرویس پیگیری سرنخ‌ها — PHASE_3 درگاه خروج ۳ + رفت‌وبرگشت تقویمی.
 *
 * سهام کلیدی:
 *  - هر پیگیری رویداد kind="note" با مهر زمان UTC ms ثبت می‌شود (lead-core.js:72).
 *  - nextAt ورودی (فارسی‌رقم، بدون صفر پیشوند) → قالب قرارداد `YYYY/MM/DD`
 *    ارقام ASCII (CD-06 — رفت‌وبرگشت تقویم).
 *  - سرنخ ناموجود → ۴۰۴.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@core/database/client", () => {
  const tx = {
    lead: { update: vi.fn() },
    leadFollowup: { create: vi.fn() },
  };
  return {
    prisma: {
      account: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
      accountPhone: { findFirst: vi.fn(), findMany: vi.fn() },
      lead: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
      leadFollowup: { findMany: vi.fn(), create: vi.fn() },
      // مورد نیاز برای side-effect.seed که از طریق @core/database اجرا می‌شود
      role: { upsert: vi.fn() },
      user: { findMany: vi.fn(), upsert: vi.fn(), count: vi.fn() },
      setting: { upsert: vi.fn() },
      rev: { upsert: vi.fn() },
      list: { upsert: vi.fn() },
      product: { count: vi.fn() },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
      $disconnect: vi.fn(),
      __tx: tx,
    },
  };
});

import { prisma } from "@core/database/client";
import { addFollowup, listFollowups } from "./followup.service";

const mocked = vi.mocked(prisma) as unknown as {
  lead: { findUnique: ReturnType<typeof vi.fn> };
  leadFollowup: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  user: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
  __tx: {
    lead: { update: ReturnType<typeof vi.fn> };
    leadFollowup: { create: ReturnType<typeof vi.fn> };
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listFollowups", () => {
  it("سرنخ پیدا نشد → ۴۰۴", async () => {
    mocked.lead.findUnique.mockResolvedValue(null);
    await expect(listFollowups("LD-999")).rejects.toMatchObject({ status: 404 });
    expect(mocked.leadFollowup.findMany).not.toHaveBeenCalled();
  });

  it("ردیف‌ها به ترتیب جدیدترین و byName از user.findMany حل می‌شود", async () => {
    mocked.lead.findUnique.mockResolvedValue({ id: "LD-1001" });
    mocked.leadFollowup.findMany.mockResolvedValue([
      { id: "f2", at: 2000n, kind: "note", result: "", note: "دوم", nextAt: null, byUserId: "u1", byName: null },
      { id: "f1", at: 1000n, kind: "note", result: "پاسخ نداد", note: "", nextAt: "1405/08/19", byUserId: null, byName: null },
    ]);
    mocked.user.findMany.mockResolvedValue([{ id: "u1", name: "ali" }]);

    const rows = await listFollowups("LD-1001");
    expect(rows.length).toBe(2);
    expect(rows[0]?.id).toBe("f2");
    // مهر زمان bigint → number (CD-07)
    expect(rows[0]?.at).toBe(2000);
    expect(rows[0]?.byName).toBe("ali");
    expect(rows[1]?.byName).toBeNull();
    expect(rows[1]?.nextAt).toBe("1405/08/19");

    const args = mocked.leadFollowup.findMany.mock.calls[0]?.[0] as { where: { leadId: string }; orderBy: unknown };
    expect(args.where.leadId).toBe("LD-1001");
  });
});

describe("addFollowup — مسیر خوش", () => {
  it("رویداد kind=note با مهر زمان ثبت و updatedAt سرنخ به‌روزرسانی می‌شود", async () => {
    mocked.lead.findUnique.mockResolvedValue({ id: "LD-1001" });
    mocked.user.findMany.mockResolvedValue([{ id: "u1", name: "ali" }]);
    mocked.__tx.leadFollowup.create.mockResolvedValue({
      id: "f9",
      at: 5000n,
      kind: "note",
      result: "",
      note: "تماس گرفته شد",
      nextAt: null,
      byUserId: "u1",
      byName: null,
    });

    const row = await addFollowup("LD-1001", { result: "", note: "تماس گرفته شد", nextAt: undefined }, "u1");

    expect(row.kind).toBe("note");
    expect(row.note).toBe("تماس گرفته شد");
    expect(row.byName).toBe("ali");

    const leadUpdate = mocked.__tx.lead.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { updatedAt: number };
    };
    expect(leadUpdate.where.id).toBe("LD-1001");
    expect(typeof leadUpdate.data.updatedAt).toBe("number");

    const created = mocked.__tx.leadFollowup.create.mock.calls[0]?.[0] as {
      data: { leadId: string; kind: string; byUserId: string };
    };
    expect(created.data.leadId).toBe("LD-1001");
    expect(created.data.kind).toBe("note");
    expect(created.data.byUserId).toBe("u1");
  });

  it("nextAt بدون مقدار → null ذخیره می‌شود", async () => {
    mocked.lead.findUnique.mockResolvedValue({ id: "LD-1001" });
    mocked.user.findMany.mockResolvedValue([]);
    mocked.__tx.leadFollowup.create.mockResolvedValue({
      id: "f8",
      at: 1n,
      kind: "note",
      result: "پاسخ نداد",
      note: "",
      nextAt: null,
      byUserId: "u1",
      byName: null,
    });
    await addFollowup("LD-1001", { result: "پاسخ نداد", note: "" }, "u1");
    const created = mocked.__tx.leadFollowup.create.mock.calls[0]?.[0] as { data: { nextAt: string | null } };
    expect(created.data.nextAt).toBeNull();
  });
});

describe("addFollowup — رفت‌وبرگشت تقویمی (CD-06)", () => {
  it("nextAt فارسی‌رقم و بدون صفر پیشوند → `YYYY/MM/DD` ارقام ASCII", async () => {
    mocked.lead.findUnique.mockResolvedValue({ id: "LD-1001" });
    mocked.user.findMany.mockResolvedValue([]);
    mocked.__tx.leadFollowup.create.mockResolvedValue({
      id: "f7",
      at: 1n,
      kind: "note",
      result: "",
      note: "x",
      nextAt: "1405/08/09",
      byUserId: "u1",
      byName: null,
    });

    await addFollowup("LD-1001", { result: "", note: "x", nextAt: "۱۴۰۵/۸/۹" }, "u1");

    const created = mocked.__tx.leadFollowup.create.mock.calls[0]?.[0] as { data: { nextAt: string | null } };
    expect(created.data.nextAt).toBe("1405/08/09");
    // فقط ارقام ASCII در قرارداد ذخیره‌سازی
    expect(created.data.nextAt).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });

  it("nextAt با ارقام انگلیسی و صفر پیشوند دست‌نخورده نگه‌داشته می‌شود", async () => {
    mocked.lead.findUnique.mockResolvedValue({ id: "LD-1001" });
    mocked.user.findMany.mockResolvedValue([]);
    mocked.__tx.leadFollowup.create.mockResolvedValue({
      id: "f6",
      at: 1n,
      kind: "note",
      result: "",
      note: "x",
      nextAt: "1405/08/19",
      byUserId: "u1",
      byName: null,
    });

    await addFollowup("LD-1001", { result: "", note: "x", nextAt: "1405/08/19" }, "u1");

    const created = mocked.__tx.leadFollowup.create.mock.calls[0]?.[0] as { data: { nextAt: string | null } };
    expect(created.data.nextAt).toBe("1405/08/19");
  });
});

describe("addFollowup — سرنخ ناموجود", () => {
  it("→ ۴۰۴ بدون اجرای تراکنش", async () => {
    mocked.lead.findUnique.mockResolvedValue(null);
    await expect(
      addFollowup("LD-999", { result: "", note: "x" }, "u1"),
    ).rejects.toMatchObject({ status: 404 });
    expect(mocked.$transaction).not.toHaveBeenCalled();
  });
});
