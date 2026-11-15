/**
 * آزمون سرویس تراکنش مالی — ۸ نوع ثابت + جهت استنتاج‌شده (PHASE_06 §۶).
 *
 * سهام کلیدی (یک نقض حداقل برای هر قانون حیاتی):
 *  - هر ۸ نوع Demo → کلید ذخیره‌شده و جهت درست (app/fin.js:145/147)؛
 *  - «دریافت متفرقه» = income، ۷ نوع «هزینه: …» = expense؛
 *  - نوع خارج از فهرست → ۴۰۰؛
 *  - جستجو روی who/note و فیلتر نوع/جهت؛
 *  - noMoney: حذف مبلغ در پاسخ (R-32).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@core/database/client", () => {
  return {
    prisma: {
      txn: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
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

import { prisma } from "@core/database/client";
import { createTxn, listTxns } from "./txn.service";
import { EXPENSE_KIND_LABELS, toStoredKind } from "../constants";

const mocked = vi.mocked(prisma) as unknown as {
  txn: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

/** رکورد تراکنش مطابق TXN_INCLUDE سرویس. */
function txnRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tx1",
    kind: "هزینه — اجاره",
    direction: "expense",
    amount: 50000000,
    at: "1405/09/01",
    who: "مالک",
    note: "اجاره مهر",
    byUserId: "u1",
    createdAt: 1800000000000,
    by: { name: "علی" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createTxn — ۸ نوع ثابت Demo (app/fin.js:145)", () => {
  it("۷ نوع هزینه با جهت expense و کلید ذخیره‌شده «هزینه — …» ثبت می‌شوند", async () => {
    const expenseKinds = EXPENSE_KIND_LABELS.filter((k) => k !== "دریافت متفرقه");
    expect(expenseKinds).toHaveLength(7);
    for (const kind of expenseKinds) {
      mocked.txn.create.mockResolvedValue(
        txnRow({ kind: toStoredKind(kind), direction: "expense" }),
      );
      const row = (await createTxn(
        { kind, amount: 1000, at: "1405/09/01" },
        "u1",
        false,
      )) as Record<string, unknown>;
      const data = (mocked.txn.create.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> })
        .data;
      expect(data.kind, `kind=${kind}`).toBe(toStoredKind(kind));
      expect(data.direction, `kind=${kind}`).toBe("expense");
      expect(row.direction).toBe("expense");
    }
  });

  it("«دریافت متفرقه» با جهت income ثبت می‌شود (app/fin.js:147)", async () => {
    mocked.txn.create.mockResolvedValue(
      txnRow({ kind: "دریافت متفرقه", direction: "income", amount: 1200000 }),
    );
    const row = (await createTxn(
      { kind: "دریافت متفرقه", amount: 1200000, at: "1405/09/10", who: "شخص" },
      "u1",
      false,
    )) as Record<string, unknown>;
    const data = (mocked.txn.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.kind).toBe("دریافت متفرقه");
    expect(data.direction).toBe("income");
    expect(row.direction).toBe("income");
  });

  it("مبلغ و تاریخ خالص به همان صورت ذخیره می‌شوند (CD-13/CD-06)", async () => {
    mocked.txn.create.mockResolvedValue(txnRow());
    await createTxn(
      { kind: "هزینه: اجاره", amount: 50000000, at: "1405/09/01" },
      "u1",
      false,
    );
    const data = (mocked.txn.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.amount).toBe(50000000);
    expect(data.at).toBe("1405/09/01");
    expect(data.who).toBeNull();
    expect(data.byUserId).toBe("u1");
    expect(data.createdAt).toBeTypeOf("bigint");
  });

  it("نوع خارج از فهرست ثابت → ۴۰۰", async () => {
    await expect(
      createTxn(
        // از مسیر زدن Zod با کلید از پیش تبدیل‌شده — سرویس محافظ یکپارچگی دارد
        { kind: "هزینه: اختراعی" as never, amount: 1000, at: "1405/09/01" },
        "u1",
        false,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(mocked.txn.create.mock.calls).toHaveLength(0);
  });

  it("noMoney: مبلغ از پاسخ حذف می‌شود (R-32)", async () => {
    mocked.txn.create.mockResolvedValue(txnRow());
    const row = (await createTxn(
      { kind: "هزینه: اجاره", amount: 50000000, at: "1405/09/01" },
      "u1",
      true,
    )) as Record<string, unknown>;
    expect("amount" in row).toBe(false);
    expect(row.kind).toBe("هزینه — اجاره");
    expect(row.byName).toBe("علی");
  });
});

describe("listTxns — فیلتر و جستجو", () => {
  it("فیلتر نوع و جهت اعمال می‌شود", async () => {
    mocked.txn.count.mockResolvedValue(1);
    mocked.txn.findMany.mockResolvedValue([txnRow()]);
    await listTxns(
      { kind: "هزینه — اجاره", direction: "expense", q: "", page: 1, pageSize: 20 },
      false,
    );
    const args = mocked.txn.findMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      skip: number;
      take: number;
    };
    expect(args.where).toEqual({ kind: "هزینه — اجاره", direction: "expense" });
    expect(args.skip).toBe(0);
    expect(args.take).toBe(20);
  });

  it("جستجو روی who و note (OR)", async () => {
    mocked.txn.count.mockResolvedValue(0);
    mocked.txn.findMany.mockResolvedValue([]);
    await listTxns({ kind: null, direction: null, q: "اجاره", page: 1, pageSize: 20 }, false);
    const args = mocked.txn.findMany.mock.calls[0]?.[0] as { where: { OR: unknown[] } };
    expect(args.where.OR).toHaveLength(2);
  });

  it("ترتیب بر اساس تاریخ تراکنش نزولی", async () => {
    mocked.txn.count.mockResolvedValue(0);
    mocked.txn.findMany.mockResolvedValue([]);
    await listTxns({ kind: null, direction: null, q: "", page: 2, pageSize: 20 }, false);
    const args = mocked.txn.findMany.mock.calls[0]?.[0] as {
      orderBy: Array<Record<string, string>>;
      skip: number;
    };
    expect(args.orderBy[0]).toEqual({ at: "desc" });
    expect(args.skip).toBe(20);
  });

  it("noMoney: ردیف‌های لیست بدون مبلغ برمی‌گردند (R-32)", async () => {
    mocked.txn.count.mockResolvedValue(1);
    mocked.txn.findMany.mockResolvedValue([txnRow()]);
    const result = (await listTxns(
      { kind: null, direction: null, q: "", page: 1, pageSize: 20 },
      true,
    )) as { items: Array<Record<string, unknown>>; total: number };
    expect("amount" in result.items[0]!).toBe(false);
    expect(result.items[0]?.kind).toBe("هزینه — اجاره");
    expect(result.total).toBe(1);
  });
});
