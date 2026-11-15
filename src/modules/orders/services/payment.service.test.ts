/**
 * تست‌های یکپارچه سرویس پرداخت‌ها و چک‌ها (PHASE_04 §۱۲).
 *
 * پوشش:
 *  - ماشین وضعیت چک: hand → bank → clear (core.js:245-250)
 *  - چک جدید همیشه «hand» است و جزو دریافتی‌ها حساب نمی‌شود
 *  - وصول چک (clear) فقط با ظرفیت کافی (PHASE_04 §۶)
 *  - باطل‌کردن پرداخت (p.void — Demo)
 *  - تجاوز جمع دریافتی‌ها از مبلغ کل → ۴۰۰ (order.js:147 ok4)
 *  - paidOf: جمع پرداخت‌های باطل‌نشده + چک‌های clear
 *
 * پراسیا به‌صورت کامل mock می‌شود (الگوی lead.service.test.ts).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@core/database/client";
import { ApiError } from "@core/errors";
import {
  createCheque,
  createPayment,
  paidOf,
  updateCheque,
  updatePayment,
} from "./payment.service";

vi.mock("@core/database/client", () => {
  const paymentCreate = vi.fn();
  const paymentUpdate = vi.fn();
  const chequeCreate = vi.fn();
  const chequeUpdate = vi.fn();
  const stageLogCreate = vi.fn();
  const orderUpdate = vi.fn();
  const orderCreate = vi.fn();
  const findUnique = vi.fn();
  const findMany = vi.fn();
  const count = vi.fn();
  const settingFindUnique = vi.fn();
  const userFindMany = vi.fn();
  const productFindMany = vi.fn();
  const tx = {
    order: { create: orderCreate, update: orderUpdate },
    orderStageLog: { create: stageLogCreate },
    orderPayment: { create: paymentCreate, update: paymentUpdate },
    orderCheque: { create: chequeCreate, update: chequeUpdate },
    orderHandoff: { create: vi.fn() },
  };
  return {
    prisma: {
      order: { findUnique, findMany, count, update: orderUpdate, create: orderCreate },
      orderPayment: { create: paymentCreate, update: paymentUpdate },
      orderCheque: { create: chequeCreate, update: chequeUpdate },
      orderStageLog: { create: stageLogCreate },
      orderHandoff: { create: vi.fn() },
      // مورد نیاز برای side-effect.seed که از طریق @core/database اجرا می‌شود
      product: { findMany: productFindMany, count: vi.fn() },
      user: { findMany: userFindMany, upsert: vi.fn(), count: vi.fn() },
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
  orderPayment: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  orderCheque: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  orderStageLog: { create: ReturnType<typeof vi.fn> };
};

/** ردیف کامل سفارش — total = ۱٬۱۰۰٬۰۰۰ با یک قلم ۱۰۰۰٬۰۰۰ و مالیات ۱۰٪. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "PF-1201",
    accountId: "acc-1",
    contactId: null,
    leadId: null,
    line: "prod",
    stage: 6,
    status: "open",
    discPct: 0,
    discAmt: 0,
    ship: 0,
    install: 0,
    noVat: false,
    validDays: 3,
    note: "",
    preset: "half",
    planBuilder: null,
    ownerId: "u-sales",
    createdById: "u-sales",
    due: 1_758_000_000_000,
    stageAt: 1_758_000_000_000,
    times: { draft: 1_758_000_000_000 },
    skipped: [],
    smOk: null,
    mgrOk: null,
    backNote: null,
    sent: null,
    prod: null,
    prep: null,
    delivered: null,
    agreed: null,
    cancelReason: null,
    createdAt: 1_758_000_000_000,
    updatedAt: 1_758_000_000_000,
    items: [
      {
        id: "i1",
        productId: "P1",
        qty: 1,
        price: 1_000_000,
        discount: 0,
        color: "",
        product: { name: "محصول ۱", code: "P1", unit: "عدد" },
      },
    ],
    payments: [],
    cheques: [],
    stageLog: [],
    handoffs: [],
    account: { name: "شرخت" },
    contact: null,
    owner: { name: "کارشناس" },
    ...overrides,
  };
}

const ACTOR = { userId: "u-fin", roles: ["finance"] };

beforeEach(() => {
  vi.clearAllMocks();
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

// --- paidOf ----------------------------------------------------------------

describe("paidOf — جمع دریافتی‌ها (core.js:245-250)", () => {
  it("پرداخت باطل‌شده حساب نمی‌شود", () => {
    const sum = paidOf({
      payments: [
        { void: false, amount: 100 },
        { void: true, amount: 200 },
      ],
      cheques: [],
    });
    expect(sum).toBe(100);
  });

  it("فقط چک‌های clear حساب می‌شوند", () => {
    const sum = paidOf({
      payments: [],
      cheques: [
        { status: "hand", amount: 100 },
        { status: "bank", amount: 200 },
        { status: "clear", amount: 300 },
        { status: "bounce", amount: 400 },
      ],
    });
    expect(sum).toBe(300);
  });

  it("ترکیب پرداخت و چک clear", () => {
    expect(
      paidOf({
        payments: [{ void: false, amount: 250 }],
        cheques: [{ status: "clear", amount: 750 }],
      }),
    ).toBe(1000);
  });
});

// --- createPayment -----------------------------------------------------------

describe("createPayment — ثبت پرداخت دریافتی", () => {
  it("پرداخت معتبر ثبت و در تاریخچه نوشته می‌شود", async () => {
    await createPayment(
      "PF-1201",
      { kind: "cash", amount: 1_000_000, date: "1405/09/01", note: "" },
      ACTOR,
      false,
    );
    const data = p.orderPayment.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.amount).toBe(1_000_000);
    expect(data.kind).toBe("cash");
    const log = p.orderStageLog.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(log.toStage).toBe(0);
    expect(String(log.note)).toContain("نقدی");
  });

  it("پرداخت کارتی برچسب کارتی دارد", async () => {
    await createPayment(
      "PF-1201",
      { kind: "card", amount: 500_000, date: "1405/09/01", note: "" },
      ACTOR,
      false,
    );
    const log = p.orderStageLog.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(String(log.note)).toContain("کارتی");
  });

  it("تجاوز از مبلغ کل → ۴۰۰ (order.js:147 ok4)", async () => {
    // total = ۱٬۱۰۰٬۰۰۰ → پرداخت ۱٬۲۰۰٬۰۰۰ رد
    await expectApiError(
      () =>
        createPayment(
          "PF-1201",
          { kind: "cash", amount: 1_200_000, date: "1405/09/01", note: "" },
          ACTOR,
          false,
        ),
      400,
      "بیشتر است",
    );
    expect(p.orderPayment.create).not.toHaveBeenCalled();
  });

  it("پرداخت تا سقف کل + تلورانس ۱ ریال مجاز است", async () => {
    await createPayment(
      "PF-1201",
      { kind: "cash", amount: 1_100_001, date: "1405/09/01", note: "" },
      ACTOR,
      false,
    );
    expect(p.orderPayment.create).toHaveBeenCalledTimes(1);
  });

  it("پرداخت‌های قبلی در جمع لحاظ می‌شوند", async () => {
    p.order.findUnique.mockResolvedValue(
      row({
        payments: [{ id: "pay1", void: false, amount: 600_000, kind: "cash", date: "1405/09/01", note: "", byUserId: "u", createdAt: 1 }],
      }),
    );
    // ۶۰۰٬۰۰۰ + ۶۰۰٬۰۰۰ = ۱٬۲۰۰٬۰۰۰ > ۱٬۱۰۰٬۰۰۱ → رد
    await expectApiError(
      () =>
        createPayment(
          "PF-1201",
          { kind: "cash", amount: 600_000, date: "1405/09/01", note: "" },
          ACTOR,
          false,
        ),
      400,
    );
  });

  it("سفارش لغوشده → ۴۰۰", async () => {
    p.order.findUnique.mockResolvedValue(row({ status: "cancelled" }));
    await expectApiError(
      () =>
        createPayment(
          "PF-1201",
          { kind: "cash", amount: 100, date: "1405/09/01", note: "" },
          ACTOR,
          false,
        ),
      400,
      "لغو",
    );
  });

  it("سفارش ناموجود → ۴۰۴", async () => {
    p.order.findUnique.mockResolvedValue(null);
    await expectApiError(
      () =>
        createPayment(
          "PF-1201",
          { kind: "cash", amount: 100, date: "1405/09/01", note: "" },
          ACTOR,
          false,
        ),
      404,
    );
  });
});

// --- updatePayment ------------------------------------------------------------

describe("updatePayment — باطل‌کردن (p.void)", () => {
  it("باطل‌کردن جمع را کم می‌کند و در تاریخچه نوشته می‌شود", async () => {
    p.order.findUnique.mockResolvedValue(
      row({
        payments: [{ id: "pay1", void: false, amount: 600_000, kind: "cash", date: "1405/09/01", note: "", byUserId: "u", createdAt: 1 }],
      }),
    );
    await updatePayment("PF-1201", "pay1", { void: true }, ACTOR, false);
    const data = p.orderPayment.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.void).toBe(true);
    const log = p.orderStageLog.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(String(log.note)).toContain("باطل");
  });

  it("برگشت‌زدن باطل‌کردن مجاز است", async () => {
    p.order.findUnique.mockResolvedValue(
      row({
        payments: [{ id: "pay1", void: true, amount: 600_000, kind: "cash", date: "1405/09/01", note: "", byUserId: "u", createdAt: 1 }],
      }),
    );
    await updatePayment("PF-1201", "pay1", { void: false }, ACTOR, false);
    const data = p.orderPayment.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.void).toBe(false);
  });

  it("یادداشت پرداخت به‌روزرسانی می‌شود", async () => {
    p.order.findUnique.mockResolvedValue(
      row({
        payments: [{ id: "pay1", void: false, amount: 600_000, kind: "cash", date: "1405/09/01", note: "", byUserId: "u", createdAt: 1 }],
      }),
    );
    await updatePayment("PF-1201", "pay1", { note: "واریز شد" }, ACTOR, false);
    const data = p.orderPayment.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.note).toBe("واریز شد");
    expect(data.void).toBeUndefined();
  });

  it("پرداخت ناموجود → ۴۰۴", async () => {
    await expectApiError(() => updatePayment("PF-1201", "nope", { void: true }, ACTOR, false), 404);
  });
});

// --- createCheque -------------------------------------------------------------

describe("createCheque — چک جدید همیشه «hand» است", () => {
  it("چک با وضعیت hand ثبت می‌شود (جزو دریافتی‌ها نیست)", async () => {
    await createCheque(
      "PF-1201",
      { sayad: "1234567890123456", amount: 500_000, due: "1405/09/15", bank: "ملت", owner: "حسن", note: "" },
      ACTOR,
      false,
    );
    const data = p.orderCheque.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.status).toBe("hand");
    expect(data.sayad).toBe("1234567890123456");
    expect(data.amount).toBe(500_000);
    const log = p.orderStageLog.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(String(log.note)).toContain("چک");
  });

  it("چک با شماره صیادی خالی مجاز است (Q-06)", async () => {
    await createCheque(
      "PF-1201",
      { sayad: "", amount: 500_000, due: "1405/09/15", bank: "", owner: "", note: "" },
      ACTOR,
      false,
    );
    expect(p.orderCheque.create).toHaveBeenCalledTimes(1);
  });

  it("چک hand ظرفیت را اشغال نمی‌کند — حتی معادل کل", async () => {
  // total = ۱٬۱۰۰٬۰۰۰؛ چک ۵۰۰٬۰۰۰ hand → از سقف کمتر است
    await createCheque(
      "PF-1201",
      { sayad: "", amount: 1_100_000, due: "1405/09/15", bank: "", owner: "", note: "" },
      ACTOR,
      false,
    );
    expect(p.orderCheque.create).toHaveBeenCalledTimes(1);
  });
});

// --- updateCheque -------------------------------------------------------------

describe("updateCheque — ماشین وضعیت چک (hand → bank → clear)", () => {
  const CHQ = {
    id: "chq1",
    sayad: "1234567890123456",
    amount: 600_000,
    due: "1405/09/15",
    status: "hand",
    bank: "ملت",
    owner: "حسن",
    note: "",
    createdAt: 1,
    updatedAt: 1,
  };

  it("hand → bank: وضعیت عوض می‌شود ولی «وصول» ثبت نمی‌شود", async () => {
    p.order.findUnique.mockResolvedValue(row({ cheques: [{ ...CHQ }] }));
    await updateCheque("PF-1201", "chq1", { status: "bank" }, ACTOR, false);
    const data = p.orderCheque.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.status).toBe("bank");
    expect(p.orderStageLog.create).not.toHaveBeenCalled();
  });

  it("hand → clear: وصول در تاریخچه نوشته می‌شود", async () => {
    p.order.findUnique.mockResolvedValue(row({ cheques: [{ ...CHQ }] }));
    await updateCheque("PF-1201", "chq1", { status: "clear" }, ACTOR, false);
    const data = p.orderCheque.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.status).toBe("clear");
    const log = p.orderStageLog.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(String(log.note)).toBe("چک وصول شد.");
  });

  it("clear → clear: برشی مجدد لاگ نمی‌کند", async () => {
    p.order.findUnique.mockResolvedValue(row({ cheques: [{ ...CHQ, status: "clear" }] }));
    await updateCheque("PF-1201", "chq1", { status: "clear" }, ACTOR, false);
    expect(p.orderStageLog.create).not.toHaveBeenCalled();
  });

  it("وصول چک که از کل بیشتر می‌شود → ۴۰۰ (PHASE_04 §۶)", async () => {
    // ۶۰۰٬۰۰۰ پرداخت + ۶۰۰٬۰۰۰ چک = ۱٬۲۰۰٬۰۰۰ > ۱٬۱۰۰٬۰۰۱
    p.order.findUnique.mockResolvedValue(
      row({
        payments: [{ id: "pay1", void: false, amount: 600_000, kind: "cash", date: "1405/09/01", note: "", byUserId: "u", createdAt: 1 }],
        cheques: [{ ...CHQ }],
      }),
    );
    await expectApiError(
      () => updateCheque("PF-1201", "chq1", { status: "clear" }, ACTOR, false),
      400,
      "بیشتر است",
    );
    expect(p.orderCheque.update).not.toHaveBeenCalled();
  });

  it("bounce: چک برگشتی جزو دریافتی‌ها نیست", async () => {
    p.order.findUnique.mockResolvedValue(row({ cheques: [{ ...CHQ, status: "bank" }] }));
    await updateCheque("PF-1201", "chq1", { status: "bounce" }, ACTOR, false);
    const data = p.orderCheque.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.status).toBe("bounce");
  });

  it("چک ناموجود → ۴۰۴", async () => {
    await expectApiError(
      () => updateCheque("PF-1201", "nope", { status: "bank" }, ACTOR, false),
      404,
    );
  });

  it("اطلاعات بانکی چک به‌روزرسانی می‌شود", async () => {
    p.order.findUnique.mockResolvedValue(row({ cheques: [{ ...CHQ }] }));
    await updateCheque("PF-1201", "chq1", { bank: "صادرات", owner: "علی" }, ACTOR, false);
    const data = p.orderCheque.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.bank).toBe("صادرات");
    expect(data.owner).toBe("علی");
    expect(data.status).toBeUndefined();
  });
});
