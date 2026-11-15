/**
 * آزمون سرویس برنامه پرداخت — PHASE_04 §۱۲ («جمع برنامه»).
 *
 * برنامه پرداخت **محاسبه خالص سمت سرور** است (§۳.۵) و مبلغ کل آن از
 * محاسبهٔ اقلام با تنظیمات جاری به‌دست می‌آید (CD-29 — هیچ فیلد total
 * ذخیره‌شده‌ای وجود ندارد).
 *
 * پوشش:
 *  - fallback پیش‌تنظیم اول وقتی نه preset و نه builder داده شود (Demo).
 *  - preset: نقد کامل / نصف نقد + چک / پیش‌پرداخت + ۳ چک.
 *  - builder دلخواه (aided خالص بدون rounding ۱۰۰٬۰۰۰ در مبلغ کل).
 *  - جمع مبالغ برنامه ≤ ۱ ریال اختلاف با total (تلورانس §۱۲).
 *  - مبلغ total از تنظیمات جاری (vat) محاسبه می‌شود نه از فیلد ذخیره‌شده.
 *  - سفارش ناموجود → ۴۰۴.
 *  - availablePresets — کلید و برچسب فارسی.
 *
 * پراسیا به‌صورت کامل mock می‌شود (الگوی payment.service.test.ts).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@core/database/client";
import { ApiError } from "@core/errors";
import { availablePresets, generateOrderPlan } from "./plan.service";

vi.mock("@core/database/client", () => {
  const findUnique = vi.fn();
  const settingFindUnique = vi.fn();
  const tx = {
    order: { create: vi.fn(), update: vi.fn() },
    orderStageLog: { create: vi.fn() },
    orderPayment: { create: vi.fn(), update: vi.fn() },
    orderCheque: { create: vi.fn(), update: vi.fn() },
    orderHandoff: { create: vi.fn() },
  };
  return {
    prisma: {
      order: { findUnique, findMany: vi.fn(), count: vi.fn(), update: vi.fn(), create: vi.fn() },
      orderPayment: { create: vi.fn(), update: vi.fn() },
      orderCheque: { create: vi.fn(), update: vi.fn() },
      orderStageLog: { create: vi.fn() },
      orderHandoff: { create: vi.fn() },
      // مورد نیاز برای side-effect.seed که از طریق @core/database اجرا می‌شود
      product: { findMany: vi.fn(), count: vi.fn() },
      user: { findMany: vi.fn(), upsert: vi.fn(), count: vi.fn() },
      role: { upsert: vi.fn() },
      setting: { findUnique: settingFindUnique, upsert: vi.fn() },
      rev: { upsert: vi.fn() },
      list: { upsert: vi.fn() },
      $disconnect: vi.fn(),
      $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
      __tx: tx,
    },
  };
});

const p = vi.mocked(prisma) as unknown as {
  order: { findUnique: ReturnType<typeof vi.fn> };
  setting: { findUnique: ReturnType<typeof vi.fn> };
};

/**
 * ردیف سفارش — یک قلم ۱٬۰۰۰٬۰۰۰ ریال.
 * total محاسبه‌شده با مالیات پیش‌فرض ۱۰٪ = ۱٬۱۰۰٬۰۰۰ ریال.
 */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "PF-1201",
    line: "prod",
    stage: 5,
    status: "open",
    discPct: 0,
    discAmt: 0,
    ship: 0,
    install: 0,
    noVat: false,
    preset: "",
    planBuilder: null,
    items: [
      { id: "i1", productId: "P1", qty: 1, price: 1_000_000, discount: 0, color: "" },
    ],
    ...overrides,
  };
}

/** ردیف تنظیمات — vat٪ و اعتبار. */
function settingsRow(vat: number) {
  return { id: 0, vat, validDays: 3, rate: 3, discountCap: null, company: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  p.setting.findUnique.mockResolvedValue(settingsRow(10));
  p.order.findUnique.mockResolvedValue(row());
});

async function expectApiError(fn: () => Promise<unknown>, status: number, messageFragment?: string) {
  try {
    await fn();
    expect.fail("باید خطا پرتاب می‌شد");
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    if (e instanceof ApiError) {
      expect(e.status).toBe(status);
      if (messageFragment !== undefined) {
        expect(e.message).toContain(messageFragment);
      }
    }
  }
}

describe("generateOrderPlan — منبع مبلغ کل (CD-29)", () => {
  it("total از اقلام + تنظیمات جاری محاسبه می‌شود، نه فیلد ذخیره‌شده", async () => {
    // ردیف سفارش هیچ فیلد total ذخیره‌شده‌ای ندارد (CD-29)
    const plan = await generateOrderPlan("PF-1201", {});
    expect(plan.sum).toBe(1_100_000);
  });

  it("vat صفر در تنظیمات → total بدون مالیات", async () => {
    p.setting.findUnique.mockResolvedValue(settingsRow(0));
    const plan = await generateOrderPlan("PF-1201", {});
    expect(plan.sum).toBe(1_000_000);
  });

  it("noVat در سفارش → total بدون مالیات بدون توجه به تنظیمات", async () => {
    p.order.findUnique.mockResolvedValue(row({ noVat: true }));
    const plan = await generateOrderPlan("PF-1201", {});
    expect(plan.sum).toBe(1_000_000);
  });

  it("تخفیف و هزینه‌های سفارش در مبلغ کل منعکس می‌شوند", async () => {
    p.order.findUnique.mockResolvedValue(
      row({ discPct: 10, ship: 100_000, install: 100_000 }),
    );
    // sub = ۱٬۰۰۰٬۰۰۰ → disc = ۱۰۰٬۰۰۰ → net = ۹۰۰٬۰۰۰ + ۲۰۰٬۰۰۰ = ۱٬۱۰۰٬۰۰۰
    // vat ۱۰٪ = ۱۱۰٬۰۰۰ → total = ۱٬۲۱۰٬۰۰۰
    const plan = await generateOrderPlan("PF-1201", {});
    expect(plan.sum).toBe(1_210_000);
  });

  it("سفارش ناموجود → ۴۰۴", async () => {
    p.order.findUnique.mockResolvedValue(null);
    await expectApiError(() => generateOrderPlan("PF-9999", {}), 404, "پیدا نشد");
  });
});

describe("generateOrderPlan — پیش‌تنظیم‌ها (order.js:109-114)", () => {
  it("بدون preset و builder → پیش‌تنظیم پیش‌فرض planBuilder (pre=۰، یک چک)", async () => {
    const plan = await generateOrderPlan("PF-1201", {});
    // planBuilderSchema.parse({}) پیش‌فرض‌ها: pre 0، rest cheque، n 1
    expect(plan.preset).toBe("");
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]!.kind).toBe("cheque");
    expect(plan.rows[0]!.amount).toBe(1_100_000);
    expect(plan.sum).toBe(1_100_000);
  });

  it("presetfull → پیش‌پرداخت ۱۰۰٪ نقدی", async () => {
    const plan = await generateOrderPlan("PF-1201", { preset: "full" });
    expect(plan.preset).toBe("full");
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]!.kind).toBe("cash");
    expect(plan.sum).toBe(1_100_000);
  });

  it("preset half → ۵۰٪ نقد + ۵۰٪ چک (گردکردن R-08: ۵۵۰→۶۰۰ و ۵۵۰→۵۰۰)", async () => {
    const plan = await generateOrderPlan("PF-1201", { preset: "half" });
    expect(plan.preset).toBe("half");
    expect(plan.rows).toHaveLength(2);
    expect(plan.rows[0]!.kind).toBe("cash");
    // rnd(half of ۱٬۱۰۰٬۰۰۰ = ۵۵۰٬۰۰۰) → ۶۰۰٬۰۰۰؛ باقی‌مانده ۵۰۰٬۰۰۰
    expect(plan.rows[0]!.amount).toBe(600_000);
    expect(plan.rows[1]!.kind).toBe("cheque");
    expect(plan.rows[1]!.amount).toBe(500_000);
    expect(plan.sum).toBe(1_100_000);
  });

  it("preset 3chq → پیش‌پرداخت ۳۰٪ + ۳ چک — جمع دقیقاً total (§۱۲ تلورانس ۱)", async () => {
    const plan = await generateOrderPlan("PF-1201", { preset: "3chq" });
    expect(plan.preset).toBe("3chq");
    expect(plan.rows).toHaveLength(4);
    expect(plan.rows[0]!.kind).toBe("cash");
    // rnd(۳۳۰٬۰۰۰) → ۳۰۰٬۰۰۰؛ باقی‌مانده ۸۰۰٬۰۰۰ روی ۳ چک
    expect(plan.rows[0]!.amount).toBe(300_000);
    const cheques = plan.rows.slice(1);
    expect(cheques.every((r) => r.kind === "cheque")).toBe(true);
    // ردیف آخر اختلاف گردکردن را جبران می‌کند (order.js:126)
    expect(cheques.map((r) => r.amount)).toEqual([300_000, 300_000, 200_000]);
    expect(plan.sum).toBe(1_100_000);
  });

  it("preset deliv → پیش‌پرداخت نقدی + باقی‌مانده اعتباری (credit)", async () => {
    const plan = await generateOrderPlan("PF-1201", { preset: "deliv" });
    expect(plan.preset).toBe("deliv");
    expect(plan.rows[0]!.kind).toBe("cash");
    expect(plan.rows[1]!.kind).toBe("credit");
    expect(plan.rows[1]!.due).toBeNull();
    expect(plan.sum).toBe(1_100_000);
  });

  it("preset ناشناخته → برنامه خالی (رفتار امن، بدون خطا)", async () => {
    const plan = await generateOrderPlan("PF-1201", { preset: "xyz" });
    expect(plan.preset).toBe("xyz");
    expect(plan.rows).toEqual([]);
    expect(plan.sum).toBe(0);
  });
});

describe("generateOrderPlan — builder دلخواه", () => {
  it("builder با مبلغ ثابت پیش‌پرداخت", async () => {
    const plan = await generateOrderPlan("PF-1201", {
      builder: {
        pre: 0,
        preMode: "amt",
        preAmt: 200_000,
        rest: "cash",
        n: 1,
        gap: "1m",
        first: "1m",
      },
    });
    expect(plan.preset).toBe("");
    expect(plan.rows[0]!.kind).toBe("cash");
    expect(plan.rows[0]!.amount).toBe(200_000);
    // باقی‌مانده ۹۰۰٬۰۰۰ نقدی با سررسید
    expect(plan.rows).toHaveLength(2);
    expect(plan.sum).toBe(1_100_000);
  });

  it("builder cheque با n=2 و gap ۲ ماه — سررسیدهای متوالی", async () => {
    const plan = await generateOrderPlan("PF-1201", {
      builder: { pre: 50, preMode: "pct", preAmt: 0, rest: "cheque", n: 2, gap: "2m", first: "1m" },
    });
    const cheques = plan.rows.filter((r) => r.kind === "cheque");
    expect(cheques).toHaveLength(2);
    expect(cheques[0]!.due).not.toBeNull();
    expect(cheques[1]!.due).not.toBeNull();
    expect(Math.abs(plan.sum - 1_100_000)).toBeLessThanOrEqual(1);
  });

  it("مبلغ کل صفر → برنامه خالی، جمع صفر", async () => {
    p.order.findUnique.mockResolvedValue(
      row({ items: [{ id: "i1", productId: "P1", qty: 0, price: 1_000_000, discount: 0, color: "" }] }),
    );
    const plan = await generateOrderPlan("PF-1201", {});
    expect(plan.sum).toBe(0);
  });
});

describe("availablePresets", () => {
  it("همهٔ پیش‌تنظیم‌ها با برچسب فارسی", () => {
    const list = availablePresets();
    expect(list.map((p) => p.key)).toEqual(["full", "half", "3chq", "deliv"]);
    expect(list.map((p) => p.label)).toEqual([
      "نقد کامل",
      "نصف نقد، نصف چک",
      "پیش‌پرداخت + ۳ چک",
      "نصف الان، نصف تحویل",
    ]);
  });
});
