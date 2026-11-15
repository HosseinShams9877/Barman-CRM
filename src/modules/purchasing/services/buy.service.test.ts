/**
 * آزمون سرویس خرید — ماشین حالت و اتصال تراکنشی به انبار (PHASE_06 §۷/§۱۲).
 *
 * سهام کلیدی (یک نقض حداقل برای هر قانون حیاتی):
 *  - جریان مراحل req → ok → fin → recv؛
 *  - گذار غیرمجاز → ۴۰۰ (app/fin.js:140)؛
 *  - عدم تطابق rev → ۴۰۹ (R-06)؛
 *  - جمع چک‌ها > مبلغ خرید → ۴۰۰ (PHASE_06 §۱۲)؛
 *  - رسیدن خرید → حرکت‌های kind:"buy" در انبار raw با ref = شناسه خرید،
 *    همه در یک تراکنش (درخواست مالک: بدون حرکت یتیم)؛
 *  - محافظ تکرار رسید → ۴۰۹؛
 *  - چک: issued → paid مجاز، پرداخت مجدد → ۴۰۹؛
 *  - noMoney: حذف فیلدهای پولی برای نقش‌های فاقد money.view (R-32).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@core/database/client", () => {
  const tx = {
    buy: { create: vi.fn(), update: vi.fn() },
    buyStatusLog: { create: vi.fn() },
    buyCheque: { createMany: vi.fn(), update: vi.fn() },
    move: { create: vi.fn() },
  };
  return {
    prisma: {
      buy: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
      buyStatusLog: { create: vi.fn() },
      buyCheque: { findUnique: vi.fn(), createMany: vi.fn(), update: vi.fn() },
      material: { findMany: vi.fn() },
      supplier: { findUnique: vi.fn() },
      move: { findFirst: vi.fn() },
      // مورد نیاز برای side-effect.seed اجرای @core/database/index
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
import {
  approveBuy,
  calcBuyTotal,
  calcDue,
  createBuy,
  financeBuy,
  listBuys,
  payBuyCheque,
  receiveBuy,
  updateBuy,
} from "./buy.service";

const mocked = vi.mocked(prisma) as unknown as {
  buy: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  buyStatusLog: { create: ReturnType<typeof vi.fn> };
  buyCheque: { findUnique: ReturnType<typeof vi.fn> };
  material: { findMany: ReturnType<typeof vi.fn> };
  supplier: { findUnique: ReturnType<typeof vi.fn> };
  move: { findFirst: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
  __tx: {
    buy: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    buyStatusLog: { create: ReturnType<typeof vi.fn> };
    buyCheque: { createMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    move: { create: ReturnType<typeof vi.fn> };
  };
};

const ACTOR = { userId: "u1", roles: ["admin"] as never };

/** رکورد خرید پر شده مطابق BUY_INCLUDE سرویس. */
function buyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "BY-101",
    supplierId: "sup-1",
    status: "req",
    total: 170000,
    note: null,
    createdBy: "u1",
    createdAt: 1800000000000,
    updatedAt: 1800000000000,
    rev: 0,
    supplier: { name: "تأمین‌کننده نمونه" },
    creator: { name: "علی" },
    items: [
      {
        id: "bi1",
        materialId: "mat-1",
        qty: 10,
        price: 12000,
        material: { name: "ماده ۱", code: "M1", unit: "کیلوگرم" },
      },
      {
        id: "bi2",
        materialId: "mat-2",
        qty: 2.5,
        price: 20000,
        material: { name: "ماده ۲", code: "M2", unit: "مترمربع" },
      },
    ],
    cheques: [],
    statusLog: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("calcBuyTotal / calcDue — fin-core.js:22-24", () => {
  it("جمع هر قلم گرد شده سپس جمع می‌شود (CD-13)", () => {
    expect(calcBuyTotal([{ qty: 10, price: 12000 }, { qty: 2.5, price: 20000 }])).toBe(170000);
    expect(calcBuyTotal([{ qty: 1.005, price: 100 }])).toBe(100);
  });

  it("due در وضعیت req صفر است", () => {
    expect(calcDue("req", 170000, 0)).toBe(0);
  });

  it("due = max(0, total − paid) در سایر وضعیت‌ها", () => {
    expect(calcDue("ok", 170000, 70000)).toBe(100000);
    expect(calcDue("recv", 170000, 200000)).toBe(0);
  });
});

describe("listBuys", () => {
  it("فیلتر وضعیت/تأمین‌کننده و صفحه‌بندی اعمال می‌شود", async () => {
    mocked.buy.count.mockResolvedValue(1);
    mocked.buy.findMany.mockResolvedValue([buyRow()]);
    const result = await listBuys(
      { status: "req", supplierId: "sup-1", q: "", page: 1, pageSize: 50 },
      false,
    );
    const args = mocked.buy.findMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      skip: number;
      take: number;
    };
    expect(args.where).toEqual({ status: "req", supplierId: "sup-1" });
    expect(args.skip).toBe(0);
    expect(args.take).toBe(50);
    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe("BY-101");
  });

  it("جستجو روی شناسه و نام تأمین‌کننده (OR)", async () => {
    mocked.buy.count.mockResolvedValue(0);
    mocked.buy.findMany.mockResolvedValue([]);
    await listBuys({ status: null, supplierId: null, q: "BY-1", page: 1, pageSize: 50 }, false);
    const args = mocked.buy.findMany.mock.calls[0]?.[0] as { where: { OR: unknown[] } };
    expect(args.where.OR).toHaveLength(2);
  });

  it("noMoney: فیلد calc از ردیف لیست حذف می‌شود (R-32)", async () => {
    mocked.buy.count.mockResolvedValue(1);
    mocked.buy.findMany.mockResolvedValue([buyRow()]);
    const result = (await listBuys(
      { status: null, supplierId: null, q: "", page: 1, pageSize: 50 },
      true,
    )) as { items: Record<string, unknown>[] };
    expect("calc" in result.items[0]!).toBe(false);
    expect(result.items[0]?.id).toBe("BY-101");
  });
});

describe("createBuy", () => {
  it("خرید با وضعیت req و شناسه BY- ساخته می‌شود + رکورد تاریخچه", async () => {
    mocked.material.findMany.mockResolvedValue([{ id: "mat-1" }]);
    mocked.supplier.findUnique.mockResolvedValue({ id: "sup-1" });
    mocked.buy.findMany.mockResolvedValue([{ id: "BY-101" }]);
    mocked.buy.findUnique.mockResolvedValue(buyRow({ id: "BY-102", rev: 0 }));

    const detail = await createBuy(
      {
        supplierId: "sup-1",
        items: [{ materialId: "mat-1", qty: 10, price: 12000 }],
        note: "یادداشت",
      },
      ACTOR,
    );

    expect(detail.id).toBe("BY-102");
    const createArgs = mocked.__tx.buy.create.mock.calls as unknown[][];
    expect(createArgs).toHaveLength(1);
    const data = (createArgs[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.status).toBe("req");
    expect(data.rev).toBe(0);
    expect((data as { total: number }).total).toBe(120000);

    const logArgs = mocked.__tx.buyStatusLog.create.mock.calls as unknown[][];
    const logData = (logArgs[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(logData.toStatus).toBe("req");
    expect(logData.fromStatus).toBeNull();
  });

  it("ماده ناموجود → ۴۰۰", async () => {
    mocked.material.findMany.mockResolvedValue([]);
    await expect(
      createBuy({ items: [{ materialId: "mat-x", qty: 1, price: 10 }] }, ACTOR),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("تأمین‌کننده ناموجود → ۴۰۰", async () => {
    mocked.material.findMany.mockResolvedValue([{ id: "mat-1" }]);
    mocked.supplier.findUnique.mockResolvedValue(null);
    await expect(
      createBuy(
        { supplierId: "sup-x", items: [{ materialId: "mat-1", qty: 1, price: 10 }] },
        ACTOR,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("updateBuy — فقط در وضعیت req (PHASE_06 §۷)", () => {
  it("ویرایش مجاز و rev یک واحد افزایش می‌یابد", async () => {
    mocked.buy.findUnique
      .mockResolvedValueOnce(buyRow())
      .mockResolvedValueOnce(buyRow({ rev: 1 }));
    mocked.buy.update.mockResolvedValue(buyRow({ rev: 1 }));
    const detail = await updateBuy("BY-101", { rev: 0, note: " جدید" }, ACTOR, false);
    expect(detail.id).toBe("BY-101");
    const args = mocked.buy.update.mock.calls[0]?.[0] as { data: { rev: number; note?: string } };
    expect(args.data.rev).toBe(1);
    expect(args.data.note).toBe(" جدید");
  });

  it("عدم تطابق rev → ۴۰۹ (R-06)", async () => {
    mocked.buy.findUnique.mockResolvedValue(buyRow({ rev: 3 }));
    await expect(updateBuy("BY-101", { rev: 0 }, ACTOR, false)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("ویرایش در وضعیت ok → ۴۰۰", async () => {
    mocked.buy.findUnique.mockResolvedValue(buyRow({ status: "ok" }));
    await expect(updateBuy("BY-101", { rev: 0 }, ACTOR, false)).rejects.toMatchObject({
      status: 400,
    });
  });

  it("خرید ناموجود → ۴۰۴", async () => {
    mocked.buy.findUnique.mockResolvedValue(null);
    await expect(updateBuy("BY-404", { rev: 0 }, ACTOR, false)).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("approveBuy — req → ok", () => {
  it("گذار مجاز در تراکنش", async () => {
    mocked.buy.findUnique
      .mockResolvedValueOnce(buyRow())
      .mockResolvedValueOnce(buyRow({ status: "ok", rev: 1 }));
    const detail = await approveBuy("BY-101", { rev: 0 }, ACTOR, false);
    expect(detail.id).toBe("BY-101");
    const updateArgs = mocked.__tx.buy.update.mock.calls[0]?.[0] as {
      data: { status: string; rev: number };
    };
    expect(updateArgs.data.status).toBe("ok");
    expect(updateArgs.data.rev).toBe(1);
    const logData = (mocked.__tx.buyStatusLog.create.mock.calls[0]?.[0] as {
      data: { fromStatus: string; toStatus: string };
    }).data;
    expect(logData).toMatchObject({ fromStatus: "req", toStatus: "ok" });
  });

  it("گذار غیرمجاز ok → ok → ۴۰۰ (app/fin.js:140)", async () => {
    mocked.buy.findUnique.mockResolvedValue(buyRow({ status: "ok" }));
    await expect(approveBuy("BY-101", { rev: 0 }, ACTOR, false)).rejects.toMatchObject({
      status: 400,
    });
  });

  it("rev نامطباق → ۴۰۹ حتی اگر وضعیت درست باشد", async () => {
    mocked.buy.findUnique.mockResolvedValue(buyRow({ rev: 5 }));
    await expect(approveBuy("BY-101", { rev: 0 }, ACTOR, false)).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe("financeBuy — ok → fin + چک‌های صادره", () => {
  it("چک‌ها با وضعیت issued ثبت می‌شوند (app/buy.js:231)", async () => {
    mocked.buy.findUnique
      .mockResolvedValueOnce(buyRow({ status: "ok" }))
      .mockResolvedValueOnce(buyRow({ status: "fin", rev: 1, cheques: [] }));
    await financeBuy(
      "BY-101",
      {
        rev: 0,
        cheques: [
          { amount: 100000, due: "1405/09/01", sayad: "1234567890" },
          { amount: 70000, due: "1405/10/01" },
        ],
      },
      ACTOR,
      false,
    );
    const args = mocked.__tx.buyCheque.createMany.mock.calls[0]?.[0] as {
      data: Array<Record<string, unknown>>;
    };
    expect(args.data).toHaveLength(2);
    expect(args.data[0]).toMatchObject({ amount: 100000, status: "issued", sayad: "1234567890" });
    expect(args.data[1]?.sayad).toBeNull();
    const logNote = (mocked.__tx.buyStatusLog.create.mock.calls[0]?.[0] as {
      data: { note: string };
    }).data.note;
    expect(logNote).toContain("2 چک");
  });

  it("جمع چک‌ها بیشتر از مبلغ خرید → ۴۰۰ (PHASE_06 §۱۲)", async () => {
    mocked.buy.findUnique.mockResolvedValue(buyRow({ status: "ok", total: 100000 }));
    await expect(
      financeBuy(
        "BY-101",
        { rev: 0, cheques: [{ amount: 150000, due: "1405/09/01" }] },
        ACTOR,
        false,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("گذار غیرمجاز req → fin → ۴۰۰", async () => {
    mocked.buy.findUnique.mockResolvedValue(buyRow({ status: "req" }));
    await expect(financeBuy("BY-101", { rev: 0 }, ACTOR, false)).rejects.toMatchObject({
      status: 400,
    });
  });

  it("بدون چک هم مجاز است (خرید نقدی)", async () => {
    mocked.buy.findUnique
      .mockResolvedValueOnce(buyRow({ status: "ok" }))
      .mockResolvedValueOnce(buyRow({ status: "fin", rev: 1 }));
    await financeBuy("BY-101", { rev: 0 }, ACTOR, false);
    expect(mocked.__tx.buyCheque.createMany.mock.calls).toHaveLength(0);
    expect(mocked.__tx.buy.update.mock.calls).toHaveLength(1);
  });
});

describe("receiveBuy — fin → recv + حرکت‌های انبار (تراکنشی)", () => {
  it("برای هر قلم یک حرکت buy در انبار raw با ref خرید ایجاد می‌شود", async () => {
    mocked.buy.findUnique
      .mockResolvedValueOnce(buyRow({ status: "fin" }))
      .mockResolvedValueOnce(buyRow({ status: "recv", rev: 1 }));
    mocked.move.findFirst.mockResolvedValue(null);

    await receiveBuy("BY-101", { rev: 0 }, ACTOR, false);

    expect(mocked.$transaction).toHaveBeenCalledTimes(1);
    const moveCalls = mocked.__tx.move.create.mock.calls as unknown[][];
    expect(moveCalls).toHaveLength(2);
    for (const call of moveCalls) {
      const data = (call[0] as { data: Record<string, unknown> }).data;
      expect(data.wh).toBe("raw");
      expect(data.kind).toBe("buy");
      expect(data.ref).toBe("BY-101");
      expect(data.note).toBe("ورود خرید BY-101");
      expect(typeof data.id).toBe("string");
      expect(data.at).toBeTypeOf("bigint");
    }
    const first = (moveCalls[0]?.[0] as { data: { item: string; qty: number } }).data;
    expect(first.item).toBe("mat-1");
    expect(first.qty).toBe(10);
    const second = (moveCalls[1]?.[0] as { data: { item: string; qty: number } }).data;
    expect(second.qty).toBe(2.5);

    const updateArgs = mocked.__tx.buy.update.mock.calls[0]?.[0] as {
      data: { status: string; rev: number };
    };
    expect(updateArgs.data.status).toBe("recv");
    const logData = (mocked.__tx.buyStatusLog.create.mock.calls[0]?.[0] as {
      data: { toStatus: string };
    }).data;
    expect(logData.toStatus).toBe("recv");
  });

  it("حرکت‌ها و انتقال وضعیت در یک تراکنش هستند — بدون حرکت یتیم", async () => {
    mocked.buy.findUnique
      .mockResolvedValueOnce(buyRow({ status: "fin" }))
      .mockResolvedValueOnce(buyRow({ status: "recv", rev: 1 }));
    mocked.move.findFirst.mockResolvedValue(null);
    await receiveBuy("BY-101", { rev: 0 }, ACTOR, false);
    // همه writeها داخل callback یک $transaction بودند
    expect(mocked.$transaction).toHaveBeenCalledTimes(1);
    expect(mocked.__tx.move.create.mock.calls).toHaveLength(2);
    expect(mocked.__tx.buy.update.mock.calls).toHaveLength(1);
    expect(mocked.__tx.buyStatusLog.create.mock.calls).toHaveLength(1);
  });

  it("رسید دوم → ۴۰۹ (محافظ تکرار — جلوگیری از دوبار شمارش)", async () => {
    mocked.buy.findUnique.mockResolvedValue(buyRow({ status: "fin" }));
    mocked.move.findFirst.mockResolvedValue({ id: "mv1" });
    await expect(receiveBuy("BY-101", { rev: 0 }, ACTOR, false)).rejects.toMatchObject({
      status: 409,
    });
    expect(mocked.__tx.move.create.mock.calls).toHaveLength(0);
  });

  it("گذار غیرمجاز req → recv → ۴۰۰", async () => {
    mocked.buy.findUnique.mockResolvedValue(buyRow({ status: "req" }));
    await expect(receiveBuy("BY-101", { rev: 0 }, ACTOR, false)).rejects.toMatchObject({
      status: 400,
    });
    expect(mocked.__tx.move.create.mock.calls).toHaveLength(0);
  });

  it("قلم با qty صفر → حرکت ساخته نمی‌شود", async () => {
    mocked.buy.findUnique
      .mockResolvedValueOnce(
        buyRow({
          status: "fin",
          items: [
            { id: "bi1", materialId: "mat-1", qty: 0, price: 100, material: { name: "م", code: "M", unit: "کیلوگرم" } },
          ],
        }),
      )
      .mockResolvedValueOnce(buyRow({ status: "recv", rev: 1 }));
    mocked.move.findFirst.mockResolvedValue(null);
    await receiveBuy("BY-101", { rev: 0 }, ACTOR, false);
    expect(mocked.__tx.move.create.mock.calls).toHaveLength(0);
  });

  it("noMoney: detail بدون فیلدهای پولی برمی‌گردد (R-32)", async () => {
    mocked.buy.findUnique
      .mockResolvedValueOnce(buyRow({ status: "fin" }))
      .mockResolvedValueOnce(buyRow({ status: "recv", rev: 1 }));
    mocked.move.findFirst.mockResolvedValue(null);
    const detail = (await receiveBuy("BY-101", { rev: 0 }, ACTOR, true)) as Record<string, unknown>;
    expect("calc" in detail).toBe(false);
    const items = detail.items as Array<Record<string, unknown>>;
    expect("price" in items[0]!).toBe(false);
    expect(items[0]?.materialName).toBe("ماده ۱");
  });
});

describe("payBuyCheque — issued → paid (app/fin.js:143)", () => {
  it("چک صادرشده پاس می‌شود و رکورد تاریخچه نوشته می‌شود", async () => {
    mocked.buy.findUnique
      .mockResolvedValueOnce(buyRow({ status: "fin" }))
      .mockResolvedValueOnce(buyRow({ status: "fin" }));
    mocked.buyCheque.findUnique.mockResolvedValue({
      id: "chq1",
      buyId: "BY-101",
      amount: 100000,
      due: "1405/09/01",
      sayad: null,
      status: "issued",
    });
    await payBuyCheque("BY-101", "chq1", ACTOR, false);
    const args = mocked.__tx.buyCheque.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { status: string };
    };
    expect(args.where.id).toBe("chq1");
    expect(args.data.status).toBe("paid");
    const logNote = (mocked.__tx.buyStatusLog.create.mock.calls[0]?.[0] as {
      data: { note: string };
    }).data.note;
    expect(logNote).toBe("پاس شدن چک صادره");
  });

  it("چک قبلاً پاس‌شده → ۴۰۹", async () => {
    mocked.buy.findUnique.mockResolvedValue(buyRow({ status: "fin" }));
    mocked.buyCheque.findUnique.mockResolvedValue({
      id: "chq1",
      buyId: "BY-101",
      status: "paid",
    });
    await expect(payBuyCheque("BY-101", "chq1", ACTOR, false)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("چک متعلق به خرید دیگر → ۴۰۴", async () => {
    mocked.buy.findUnique.mockResolvedValue(buyRow({ status: "fin" }));
    mocked.buyCheque.findUnique.mockResolvedValue({
      id: "chq9",
      buyId: "BY-999",
      status: "issued",
    });
    await expect(payBuyCheque("BY-101", "chq9", ACTOR, false)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("چک ناموجود → ۴۰۴", async () => {
    mocked.buy.findUnique.mockResolvedValue(buyRow({ status: "fin" }));
    mocked.buyCheque.findUnique.mockResolvedValue(null);
    await expect(payBuyCheque("BY-101", "chq-x", ACTOR, false)).rejects.toMatchObject({
      status: 404,
    });
  });
});

// --- پوشش farther — PHASE_08 Part A ----------------------------------

describe("payBuyCheque — حالت‌های خطا (app/fin.js:143)", () => {
  it("چک با وضعیت غیر issued (مثلاً unknown) → ۴۰۰", async () => {
    mocked.buy.findUnique.mockResolvedValue(buyRow({ status: "fin" }));
    mocked.buyCheque.findUnique.mockResolvedValue({
      id: "chq1",
      buyId: "BY-101",
      amount: 100000,
      status: "unknown",
      due: "1405/09/01",
      sayad: "",
    });
    await expect(payBuyCheque("BY-101", "chq1", ACTOR, false)).rejects.toMatchObject({
      status: 400,
    });
  });
});

// --- پوشش farther — PHASE_08 Part A (updateBuy) ------------------------

describe("updateBuy — جایگزینی اقلام و تأمین‌کننده", () => {
  it("جایگزینی اقلام با محاسبه total و deleteMany/create", async () => {
    mocked.buy.findUnique.mockResolvedValue(buyRow());
    await updateBuy(
      "BY-101",
      { rev: 0, items: [{ materialId: "m1", qty: 2, price: 5000 }] },
      ACTOR,
      false,
    );
    const args = mocked.buy.update.mock.calls[0]?.[0] as {
      data: { total: number; items: { deleteMany: object; create: unknown[] } };
    };
    expect(args.data.total).toBe(10000);
    expect(args.data.items.deleteMany).toEqual({});
    expect(args.data.items.create).toHaveLength(1);
  });

  it("ماده ناموجود در ویرایش → ۴۰۰", async () => {
    mocked.buy.findUnique.mockResolvedValue(buyRow());
    mocked.material.findMany.mockResolvedValue([]);
    await expect(
      updateBuy("BY-101", { rev: 0, items: [{ materialId: "mX", qty: 1, price: 10 }] }, ACTOR, false),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("تغییر تأمین‌کننده معتبر", async () => {
    mocked.buy.findUnique.mockResolvedValue(buyRow());
    mocked.supplier.findUnique.mockResolvedValue({ id: "s2" });
    await updateBuy("BY-101", { rev: 0, supplierId: "s2" }, ACTOR, false);
    const args = mocked.buy.update.mock.calls[0]?.[0] as {
      data: { supplier: { connect: { id: string } } };
    };
    expect(args.data.supplier).toEqual({ connect: { id: "s2" } });
  });

  it("جداسازی تأمین‌کننده با null", async () => {
    mocked.buy.findUnique.mockResolvedValue(buyRow());
    await updateBuy("BY-101", { rev: 0, supplierId: null }, ACTOR, false);
    const args = mocked.buy.update.mock.calls[0]?.[0] as {
      data: { supplier: { disconnect: boolean } };
    };
    expect(args.data.supplier).toEqual({ disconnect: true });
  });

  it("تأمین‌کننده ناموجود در ویرایش → ۴۰۰", async () => {
    mocked.buy.findUnique.mockResolvedValue(buyRow());
    mocked.supplier.findUnique.mockResolvedValue(null);
    await expect(updateBuy("BY-101", { rev: 0, supplierId: "sX" }, ACTOR, false)).rejects.toMatchObject({
      status: 400,
    });
  });
});
