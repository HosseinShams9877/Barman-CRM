/**
 * آزمون سرویس‌های گزارش مالی — مطالبات، پرداختنی‌ها، جریان نقدی
 * (PHASE_06 §۵ — fin-core.js:46-57).
 *
 * سهام کلیدی (یک نقض حداقل برای هر قانون حیاتی):
 *  - چک clear واریز شده → مطالبات نیست (core.js:245-250)؛
 *  - فقط سفارش‌های مرحله ۵ به بعد یا done → مطالبات (orderStage.ts:58)؛
 *  - چک paid خرید → پرداخت‌شده، از پرداختنی‌ها خارج (PHASE_06 §۶)؛
 *  - نسیه خرید = max(0, total − paid − issued) (جلوگیری از دوبار شمارش)؛
 *  - جریان نقدی: ۴ منبع رویداد + bucketing ماهانه با JDN (R-11)؛
 *  - noMoney: حذف همه فیلدهای پولی (R-32).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@core/database/client", () => {
  return {
    prisma: {
      order: { findMany: vi.fn() },
      buy: { findMany: vi.fn() },
      txn: { findMany: vi.fn() },
      // مورد نیاز برای side-effect.seed اجرای @core/database/index
      role: { upsert: vi.fn() },
      user: { findMany: vi.fn(), upsert: vi.fn(), count: vi.fn() },
      setting: { upsert: vi.fn() },
      rev: { upsert: vi.fn() },
      list: { upsert: vi.fn() },
      product: { count: vi.fn() },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb({})),
      $disconnect: vi.fn(),
    },
  };
});

vi.mock("@modules/settings", () => ({
  getSettings: vi.fn(async () => ({ vat: 0.09 })),
}));
vi.mock("@modules/orders/services/order.service", () => ({
  calcOrder: vi.fn(() => ({ total: 100000 })),
}));
vi.mock("@modules/orders/services/payment.service", () => ({
  paidOf: vi.fn(() => 20000),
}));

import { prisma } from "@core/database/client";
import { listReceivables } from "./receivable.service";
import { listPayables } from "./payable.service";
import { getCashflow } from "./cashflow.service";

const mocked = vi.mocked(prisma) as unknown as {
  order: { findMany: ReturnType<typeof vi.fn> };
  buy: { findMany: ReturnType<typeof vi.fn> };
  txn: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

// --- مطالبات ------------------------------------------------------------------

describe("listReceivables", () => {
  it("چک‌های باز + نسیه تجمیع می‌شوند و چک clear مستثنی است (core.js:245-250)", async () => {
    mocked.order.findMany.mockResolvedValue([
      {
        id: "OR-1",
        accountId: "acc-1",
        account: { name: "حساب ۱" },
        stage: 5,
        status: "open",
        discPct: 0,
        discAmt: 0,
        ship: 0,
        install: 0,
        noVat: false,
        items: [],
        payments: [],
        cheques: [
          { amount: 50000, due: "1405/09/01", status: "issued" },
          { amount: 30000, due: "1405/09/02", status: "clear" },
        ],
      },
    ]);

    const result = (await listReceivables(false)) as {
      groups: Array<{
        accountId: string;
        accountName: string;
        chequeAmount: number;
        balanceAmount: number;
        total: number;
        rows: Array<{ kind: string; amount: number }>;
      }>;
      total: number;
    };

    const group = result.groups[0];
    expect(group?.accountId).toBe("acc-1");
    expect(group?.rows).toHaveLength(2);
    expect(group?.chequeAmount).toBe(50000);
    expect(group?.balanceAmount).toBe(80000);
    expect(group?.total).toBe(130000);
    expect(result.total).toBe(130000);
    // چک clear در فهرست نیست
    expect(group?.rows.every((r) => r.amount !== 30000)).toBe(true);
  });

  it("فقط سفارش‌های مرحله ۵ به بعد یا done پرسیده می‌شوند (orderStage.ts:58)", async () => {
    mocked.order.findMany.mockResolvedValue([]);
    await listReceivables(false);
    const where = (mocked.order.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> })
      .where;
    expect(where).toEqual({
      status: { not: "cancelled" },
      OR: [{ stage: { gte: 5 } }, { status: "done" }],
    });
  });

  it("سفارش بدون حساب زیر کلید شناسه سفارش تجمیع می‌شود", async () => {
    mocked.order.findMany.mockResolvedValue([
      {
        id: "OR-7",
        accountId: null,
        account: null,
        stage: 6,
        status: "open",
        discPct: 0,
        discAmt: 0,
        ship: 0,
        install: 0,
        noVat: false,
        items: [],
        payments: [],
        cheques: [],
      },
    ]);
    const result = (await listReceivables(false)) as {
      groups: Array<{ accountId: string; accountName: string }>;
    };
    expect(result.groups[0]?.accountId).toBe("OR-7");
    expect(result.groups[0]?.accountName).toBe("سفارش OR-7");
  });

  it("noMoney: فیلدهای پولی حذف می‌شوند (R-32)", async () => {
    mocked.order.findMany.mockResolvedValue([
      {
        id: "OR-1",
        accountId: "acc-1",
        account: { name: "حساب ۱" },
        stage: 5,
        status: "open",
        discPct: 0,
        discAmt: 0,
        ship: 0,
        install: 0,
        noVat: false,
        items: [],
        payments: [],
        cheques: [{ amount: 50000, due: "1405/09/01", status: "issued" }],
      },
    ]);
    const result = (await listReceivables(true)) as Record<string, unknown>;
    expect("total" in result).toBe(false);
    const group = (result.groups as Array<Record<string, unknown>>)[0]!;
    expect("total" in group).toBe(false);
    expect("chequeAmount" in group).toBe(false);
    expect("amount" in (group.rows as Array<Record<string, unknown>>)[0]!).toBe(false);
  });
});

// --- پرداختنی‌ها ----------------------------------------------------------------

describe("listPayables", () => {
  it("چک صادره باز + نسیه باقی‌مانده بدون دوبار شمارش", async () => {
    mocked.buy.findMany.mockResolvedValue([
      {
        id: "BY-1",
        supplierId: "sup-1",
        supplier: { name: "تأمین‌کننده ۱" },
        status: "fin",
        total: 120000,
        cheques: [
          { amount: 40000, due: "1405/09/01", status: "paid" },
          { amount: 50000, due: "1405/10/01", status: "issued" },
        ],
      },
    ]);

    const result = (await listPayables(false)) as {
      groups: Array<{
        chequeAmount: number;
        balanceAmount: number;
        total: number;
        rows: Array<{ kind: string; amount: number }>;
      }>;
      total: number;
    };

    const group = result.groups[0];
    // چک paid پرداخت شده و در فهرست نیست؛ نسیه = ۱۲۰۰۰۰ − ۴۰۰۰۰ − ۵۰۰۰۰
    expect(group?.rows).toHaveLength(2);
    expect(group?.chequeAmount).toBe(50000);
    expect(group?.balanceAmount).toBe(30000);
    expect(group?.total).toBe(80000);
    expect(result.total).toBe(80000);
    expect(group?.rows.every((r) => r.amount !== 40000)).toBe(true);
  });

  it("فقط خریدهای تأییدشده ok/fin/recv پرسیده می‌شوند", async () => {
    mocked.buy.findMany.mockResolvedValue([]);
    await listPayables(false);
    const where = (mocked.buy.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> })
      .where;
    expect(where).toEqual({ status: { in: ["ok", "fin", "recv"] } });
  });

  it("خرید بدون تأمین‌کننده زیر کلید «بدون تأمین‌کننده»", async () => {
    mocked.buy.findMany.mockResolvedValue([
      {
        id: "BY-2",
        supplierId: null,
        supplier: null,
        status: "ok",
        total: 60000,
        cheques: [{ amount: 60000, due: "1405/09/05", status: "issued" }],
      },
    ]);
    const result = (await listPayables(false)) as {
      groups: Array<{ supplierId: string; supplierName: string }>;
    };
    expect(result.groups[0]?.supplierId).toBe("__no-supplier__");
    expect(result.groups[0]?.supplierName).toBe("بدون تأمین‌کننده");
  });

  it("noMoney: فیلدهای پولی حذف می‌شوند (R-32)", async () => {
    mocked.buy.findMany.mockResolvedValue([
      {
        id: "BY-1",
        supplierId: "sup-1",
        supplier: { name: "تأمین‌کننده ۱" },
        status: "fin",
        total: 120000,
        cheques: [{ amount: 50000, due: "1405/10/01", status: "issued" }],
      },
    ]);
    const result = (await listPayables(true)) as Record<string, unknown>;
    expect("total" in result).toBe(false);
    const group = (result.groups as Array<Record<string, unknown>>)[0]!;
    expect("total" in group).toBe(false);
    expect("amount" in (group.rows as Array<Record<string, unknown>>)[0]!).toBe(false);
  });
});

// --- جریان نقدی ------------------------------------------------------------------

describe("getCashflow", () => {
  function seedOnce() {
    mocked.order.findMany.mockResolvedValue([
      {
        id: "OR-1",
        account: { name: "حساب ۱" },
        payments: [
          { amount: 100000, date: "1405/09/05", void: false },
          { amount: 50000, date: "1405/09/06", void: true },
        ],
        cheques: [
          { amount: 70000, due: "1405/08/15", status: "clear" },
          { amount: 20000, due: "1405/09/02", status: "bounce" },
        ],
      },
    ]);
    mocked.buy.findMany.mockResolvedValue([
      {
        id: "BY-1",
        supplier: { name: "تأمین‌کننده ۱" },
        cheques: [
          { amount: 60000, due: "1405/09/10", status: "paid" },
          { amount: 30000, due: "1405/09/11", status: "issued" },
        ],
      },
    ]);
    mocked.txn.findMany.mockResolvedValue([
      { kind: "هزینه — اجاره", direction: "expense", amount: 40000, at: "1405/09/01" },
      { kind: "دریافت متفرقه", direction: "income", amount: 25000, at: "1405/08/20" },
    ]);
  }

  it("چهار منبع رویداد پولی با bucketing ماهانه JDN (fin-core.js:46-57)", async () => {
    seedOnce();
    const result = (await getCashflow(false, null)) as {
      months: Array<{ month: string; income: number; expense: number; net: number }>;
      rows: Array<{ month: string; label: string; direction: string; amount: number; at: string }>;
      totalIncome: number;
      totalExpense: number;
      totalNet: number;
    };

    // ۱۴۰۵/۰۸: وصول چک ۷۰ هزار + دریافت متفرقه ۲۵ هزار = ۹۵ هزار درآمد
    // ۱۴۰۵/۰۹: واریز ۱۰۰ هزار درآمد − چک صادره ۶۰ هزار − اجاره ۴۰ هزار = صفر
    expect(result.months).toHaveLength(2);
    expect(result.months[0]?.month).toBe("1405/08");
    expect(result.months[0]?.income).toBe(95000);
    expect(result.months[1]?.month).toBe("1405/09");
    expect(result.months[1]?.income).toBe(100000);
    expect(result.months[1]?.expense).toBe(100000);
    expect(result.months[1]?.net).toBe(0);
    expect(result.totalIncome).toBe(195000);
    expect(result.totalExpense).toBe(100000);
    expect(result.totalNet).toBe(95000);

    const labels = result.rows.map((r) => r.label);
    expect(labels).toContain("واریز مشتری");
    expect(labels).toContain("وصول چک مشتری");
    expect(labels).toContain("چک صادره خرید");
    expect(labels).toContain("هزینه: اجاره"); // toDisplayKind
    // رویدادهای مستثنی‌شده: پرداخت باطل، چک bounce، چک issued خرید
    expect(labels.filter((l) => l === "واریز مشتری")).toHaveLength(1);
    expect(labels.filter((l) => l === "چک صادره خرید")).toHaveLength(1);
  });

  it("ردیف‌ها بر اساس JDN صعودی مرتب می‌شوند (R-11)", async () => {
    seedOnce();
    const result = (await getCashflow(false, null)) as {
      rows: Array<{ at: string }>;
    };
    const ats = result.rows.map((r) => r.at);
    expect(ats[0]).toBe("1405/08/15");
    expect(ats.at(-1)).toBe("1405/09/10");
  });

  it("فیلتر ماه: فقط همان ماه برمی‌گردد", async () => {
    seedOnce();
    const result = (await getCashflow(false, "1405/09")) as {
      months: Array<{ month: string }>;
      rows: Array<{ month: string }>;
    };
    expect(result.months).toHaveLength(1);
    expect(result.months[0]?.month).toBe("1405/09");
    expect(result.rows.every((r) => r.month === "1405/09")).toBe(true);
  });

  it("noMoney: فیلدهای پولی حذف می‌شوند (R-32)", async () => {
    seedOnce();
    const result = (await getCashflow(true, null)) as Record<string, unknown>;
    expect("totalIncome" in result).toBe(false);
    const months = result.months as Array<Record<string, unknown>>;
    expect("income" in months[0]!).toBe(false);
    expect("net" in months[0]!).toBe(false);
    expect("amount" in (result.rows as Array<Record<string, unknown>>)[0]!).toBe(false);
  });
});
