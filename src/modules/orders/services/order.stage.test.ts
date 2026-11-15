/**
 * تست‌های ماشین حالت سفارش — PHASE_08 Part A (پوشش ≥ ۹۰٪ منطق کسب‌وکار).
 *
 * پوشش (PHASE_04 §۶ + نقشه تست):
 *  - updateOrder: فیلدهای اختیاری، محصولات ناموجود، ویرایش در مرحله بالای ۵
 *  - مرحله‌های تولید: made (۷→۸)، qc (۸→۹ + سند TR-)، receive (۹ با
 *    مغایرت و idempotency)، daccept (۹→۱۰)، prep (۱۰→۱۱)، deliver (۱۱→done
 *    + حرکت‌های sale)
 *  - cancelOrder: نیازمندی دلیل، نقش مجاز، مرحله ≤ ۵
 *  - getOrder: حالت noMoney (stripDetail)
 *  - canActOnStage: سفارش بسته/لغو‌شده
 *  - انتقال‌های نامجاز → ۴۰۰
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@core/database/client";
import { ApiError } from "@core/errors";
import type { Role } from "@core/permissions";
import {
  applyStageAction,
  canActOnStage,
  cancelOrder,
  getOrder,
  updateOrder,
  type Actor,
} from "./order.service";

vi.mock("@modules/inventory/services/stock.service", () => ({
  computeOnHand: vi.fn(async () => ({ "raw|m1": 1000 })),
}));

vi.mock("@core/database/client", () => {
  const orderUpdate = vi.fn();
  const orderCreate = vi.fn();
  const stageLogCreate = vi.fn();
  const paymentCreate = vi.fn();
  const paymentUpdate = vi.fn();
  const chequeCreate = vi.fn();
  const chequeUpdate = vi.fn();
  const handoffCreate = vi.fn();
  const moveCreate = vi.fn();
  const tx = {
    order: { create: orderCreate, update: orderUpdate },
    orderStageLog: { create: stageLogCreate },
    orderPayment: { create: paymentCreate, update: paymentUpdate },
    orderCheque: { create: chequeCreate, update: chequeUpdate },
    orderHandoff: { create: handoffCreate },
    move: { create: moveCreate },
  };
  return {
    prisma: {
      order: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: orderUpdate,
        create: orderCreate,
      },
      product: { findMany: vi.fn(), count: vi.fn() },
      bomItem: { findMany: vi.fn() },
      material: { findMany: vi.fn() },
      move: { findFirst: vi.fn() },
      orderHandoff: { findUnique: vi.fn() },
      setting: { findUnique: vi.fn(), upsert: vi.fn() },
      role: { upsert: vi.fn() },
      user: { findMany: vi.fn(), upsert: vi.fn() },
      rev: { upsert: vi.fn() },
      list: { upsert: vi.fn() },
      $disconnect: vi.fn(),
      $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
      __tx: tx,
    },
  };
});

const p = vi.mocked(prisma) as unknown as {
  order: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  product: { findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
  bomItem: { findMany: ReturnType<typeof vi.fn> };
  user: { findMany: ReturnType<typeof vi.fn> };
  material: { findMany: ReturnType<typeof vi.fn> };
  move: { findFirst: ReturnType<typeof vi.fn> };
  orderHandoff: { findUnique: ReturnType<typeof vi.fn> };
  setting: { findUnique: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
  __tx: {
    order: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    orderStageLog: { create: ReturnType<typeof vi.fn> };
    orderPayment: { create: ReturnType<typeof vi.fn> };
    orderCheque: { create: ReturnType<typeof vi.fn> };
    orderHandoff: { create: ReturnType<typeof vi.fn> };
    move: { create: ReturnType<typeof vi.fn> };
  };
};

const tx = p.__tx;

function rowFn(overrides: Record<string, unknown> = {}) {
  return {
    id: "PF-1201",
    accountId: "acc-1",
    contactId: null,
    leadId: null,
    line: "prod",
    stage: 1,
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
        qty: 10,
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
    account: { name: "شرکت" },
    contact: null,
    owner: { name: "کارشناس" },
    ...overrides,
  };
}

const ACTOR: Actor = { userId: "u7", roles: ["production"] };
const DEPOT: Actor = { userId: "u8", roles: ["depot"] };
const MGR: Actor = { userId: "u1", roles: ["management"] };

beforeEach(() => {
  vi.clearAllMocks();
  p.setting.findUnique.mockResolvedValue({
    id: 0,
    vat: 10,
    validDays: 3,
    rate: 3,
    discountCap: { sales: 3, salesManager: 8, management: 100, finance: 0 },
    company: { name: "بارمان", en: "", tagline: "", phone: "", address: "", bale: "" },
  });
  p.order.findUnique.mockResolvedValue(rowFn());
  p.product.findMany.mockResolvedValue([{ id: "P1", line: "prod", name: "محصول ۱" }]);
  p.bomItem.findMany.mockResolvedValue([{ materialId: "m1", qty: 2 }]);
  p.material.findMany.mockResolvedValue([{ id: "m1", name: "گچ" }]);
});

async function expectApiError(fn: () => Promise<unknown>, status: number, fragment?: string) {
  try {
    await fn();
    expect.fail("باید خطا پرتاب می‌شد");
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    if (e instanceof ApiError) {
      expect(e.status).toBe(status);
      if (fragment !== undefined) expect(e.message).toContain(fragment);
    }
  }
}

describe("updateOrder — ویرایش (PHASE_04 §۶)", () => {
  it("فیلدهای اختیاری فقط همانهایی که ارسال شده‌اند را تغییر می‌دهند", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 2 }));

    await updateOrder(
      "PF-1201",
      { note: "یادداشت جدید", ship: 50000 },
      MGR,
      false,
    );
    const data = tx.order.update.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data.data["note"]).toBe("یادداشت جدید");
    expect(data.data["ship"]).toBe(50000);
    expect(data.data["discPct"]).toBeUndefined();
  });

  it("برش حساب با null → disconnect", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 1 }));
    await updateOrder("PF-1201", { accountId: null }, MGR, false);
    const data = tx.order.update.mock.calls[0]![0] as { data: { account: unknown } };
    expect(data.data["account"]).toEqual({ disconnect: true });
  });

  it("اقلام ناموجود → ۴۰۰", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 1 }));
    p.product.findMany.mockResolvedValue([]);
    await expectApiError(
      () => updateOrder("PF-1201", { items: [{ id: "i1", productId: "PX", qty: 1, price: 100, discount: 0, color: "" }] }, MGR, false),
      400,
      "یک یا چند محصول",
    );
  });

  it("مرحله بالای ۵ → ۴۰۰", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 6 }));
    await expectApiError(
      () => updateOrder("PF-1201", { note: "x" }, MGR, false),
      400,
      "در این مرحله ویرایش",
    );
  });

  it("سفارش بسته → ۴۰۰", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ status: "done" }));
    await expectApiError(() => updateOrder("PF-1201", { note: "x" }, MGR, false), 400);
  });

  it("غیرفعال‌سازی noVat", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 1 }));
    await updateOrder("PF-1201", { noVat: true }, MGR, false);
    const data = tx.order.update.mock.calls[0]![0] as { data: { noVat: boolean } };
    expect(data.data["noVat"]).toBe(true);
  });
});

describe("مرحله‌های تولید — made / qc / receive", () => {
  it("made: ۷→۸", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 7 }));
    await applyStageAction("PF-1201", { action: "made", note: "تمام" }, ACTOR, false);
    const data = tx.order.update.mock.calls[0]![0] as {
      data: { stage: number; times: Record<string, unknown> };
    };
    expect(data.data["stage"]).toBe(8);
    expect(data.data["times"]).toHaveProperty("make");
  });

  it("made در مرحله اشتباه → ۴۰۰", async () => {
    // production در مرحله ۶ مجاز است ولی made فقط در ۷ کار می‌کند
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 6 }));
    await expectApiError(
      () => applyStageAction("PF-1201", { action: "made" }, ACTOR, false),
      400,
      "پایان تولید",
    );
  });

  it("qc: ۸→۹ + سند تحویل TR-", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 8, prod: { start: "", end: "", qc: null } }));
    await applyStageAction(
      "PF-1201",
      { action: "qc", good: 10, waste: 0, why: "", checks: [] },
      ACTOR,
      false,
    );
    const data = tx.order.update.mock.calls[0]![0] as { data: { stage: number } };
    expect(data.data["stage"]).toBe(9);
    const handoff = tx.orderHandoff.create.mock.calls[0]![0] as {
      data: { id: string; orderId: string };
    };
    expect(handoff.data["id"]).toBe("TR-1201");
  });

  it("qc در مرحله اشتباه → ۴۰۰", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 7 }));
    await expectApiError(
      () => applyStageAction("PF-1201", { action: "qc", good: 10, waste: 0, why: "", checks: [] }, ACTOR, false),
      400,
      "کنترل کیفیت",
    );
  });
});

describe("receive — دریافت بار در دپو (order.js:748-757)", () => {
  it("ثبت بار با سند مطابق → حرکت prod در دپو", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 9 }));
    p.orderHandoff.findUnique.mockResolvedValue({
      id: "TR-1201",
      orderId: "PF-1201",
      lines: [{ productId: "P1", qty: 10, color: "" }],
      at: 0,
      byUserId: "u7",
      note: "",
    });
    p.move.findFirst.mockResolvedValue(null);

    await applyStageAction("PF-1201", { action: "receive" }, DEPOT, false);
    const move = tx.move.create.mock.calls[0]![0] as {
      data: { wh: string; kind: string; qty: number; ref: string };
    };
    expect(move.data["wh"]).toBe("depot");
    expect(move.data["kind"]).toBe("prod");
    expect(move.data["qty"]).toBeGreaterThan(0);
    expect(move.data["ref"]).toBe("PF-1201");
  });

  it("مغایرت بدون توضیح → ۴۰۰", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 9 }));
    p.orderHandoff.findUnique.mockResolvedValue({
      id: "TR-1201",
      orderId: "PF-1201",
      lines: [{ productId: "P1", qty: 10, color: "" }],
      at: 0,
      byUserId: "u7",
      note: "",
    });
    p.move.findFirst.mockResolvedValue(null);

    await expectApiError(
      () =>
        applyStageAction(
          "PF-1201",
          { action: "receive", lines: [{ productId: "P1", qty: 8 }] },
          DEPOT,
          false,
        ),
      400,
      "مغایرت",
    );
  });

  it("مغایرت با توضیح پذیرفته می‌شود", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 9 }));
    p.orderHandoff.findUnique.mockResolvedValue({
      id: "TR-1201",
      orderId: "PF-1201",
      lines: [{ productId: "P1", qty: 10, color: "" }],
      at: 0,
      byUserId: "u7",
      note: "",
    });
    p.move.findFirst.mockResolvedValue(null);
    await applyStageAction(
      "PF-1201",
      { action: "receive", lines: [{ productId: "P1", qty: 8 }], note: "نقص بسته‌بندی" },
      DEPOT,
      false,
    );
    expect(tx.move.create).toHaveBeenCalled();
  });

  it("ثبت دوگانه → ۴۰۹ (idempotency)", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 9 }));
    p.move.findFirst.mockResolvedValue({ id: "mv-x" });
    await expectApiError(
      () => applyStageAction("PF-1201", { action: "receive" }, DEPOT, false),
      409,
      "قبلاً",
    );
  });

  it("سند تحویل ناموجود → ۴۰۰", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 9 }));
    p.orderHandoff.findUnique.mockResolvedValue(null);
    await expectApiError(
      () => applyStageAction("PF-1201", { action: "receive" }, DEPOT, false),
      400,
      "سند تحویل",
    );
  });
});

describe("daccept / prep / deliver — انبار و تحویل", () => {
  it("daccept: ۹→۱۰", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 9 }));
    await applyStageAction("PF-1201", { action: "daccept" }, DEPOT, false);
    const data = tx.order.update.mock.calls[0]![0] as { data: { stage: number } };
    expect(data.data["stage"]).toBe(10);
  });

  it("prep: ۱۰→۱۱ با بسته‌بندی", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 10 }));
    await applyStageAction(
      "PF-1201",
      { action: "prep", packs: 3, checks: ["بسته‌بندی و برچسب‌گذاری انجام شد"] },
      DEPOT,
      false,
    );
    const data = tx.order.update.mock.calls[0]![0] as {
      data: { stage: number; prep: { packs: number } };
    };
    expect(data.data["stage"]).toBe(11);
    expect(data.data["prep"]["packs"]).toBe(3);
  });

  it("deliver: ۱۱ → done + حرکت sale منفی", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 11 }));
    await applyStageAction(
      "PF-1201",
      { action: "deliver", to: "انبار مرکزی" },
      DEPOT,
      false,
    );
    const data = tx.order.update.mock.calls[0]![0] as {
      data: { status: string; delivered: { to: string } };
    };
    expect(data.data["status"]).toBe("done");
    expect(data.data["delivered"]["to"]).toBe("انبار مرکزی");
    const move = tx.move.create.mock.calls[0]![0] as { data: { kind: string; qty: number } };
    expect(move.data["kind"]).toBe("sale");
    expect(move.data["qty"]).toBeLessThan(0);
  });

  it("deliver در مرحله اشتباه → ۴۰۰", async () => {
    // depot در مرحله ۱۰ مجاز است ولی deliver فقط در ۱۱ کار می‌کند
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 10 }));
    await expectApiError(
      () => applyStageAction("PF-1201", { action: "deliver", to: "x" }, DEPOT, false),
      400,
      "تحویل",
    );
  });
});

describe("cancelOrder — لغو (order.js:59)", () => {
  it("لغو با دلیل مجاز برای management در مرحله ≤ ۵", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 3 }));
    await cancelOrder("PF-1201", "مشتری انصراف داد", MGR, false);
    const data = tx.order.update.mock.calls[0]![0] as {
      data: { status: string; cancelReason: string };
    };
    expect(data.data["status"]).toBe("cancelled");
    expect(data.data["cancelReason"]).toBe("مشتری انصراف داد");
  });

  it("دلیل لغو در سرویس ذخیره می‌شود (اعتبارسنجی دلیل در لایه Zod مسیر اجرا می‌شود)", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 3 }));
    await cancelOrder("PF-1201", "", MGR, false);
    const data = tx.order.update.mock.calls[0]![0] as { data: { cancelReason: string } };
    expect(data.data["cancelReason"]).toBe("");
  });

  it("لغو در مرحله بالای ۵ → ۴۰۳ (canCancel — order.js:59)", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 8 }));
    await expectApiError(() => cancelOrder("PF-1201", "دلیل", MGR, false), 403);
  });

  it("لغو توسط نقش غیرمجاز → ۴۰۳", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 3, ownerId: "someone-else" }));
    await expectApiError(
      () => cancelOrder("PF-1201", "دلیل", { userId: "u5", roles: ["sales"] }, false),
      403,
    );
  });
});

describe("getOrder — جزئیات (R-32)", () => {
  it("حالت noMoney فیلدهای پولی را حذف می‌کند", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 3 }));
    const detail = (await getOrder("PF-1201", true)) as Record<string, unknown>;
    expect(detail["calc"]).toBeUndefined();
    expect(detail["paid"]).toBeUndefined();
    expect(detail["balance"]).toBeUndefined();
    // نمایشی‌ها مثل مرحله و اقلام باقی می‌مانند (stage 3 → who=management)
    expect(detail["stageWho"]).toBe("management");
    const item = (detail["items"] as Array<Record<string, unknown>>)[0]!;
    expect(item["qty"]).toBe(10);
    expect(item["price"]).toBeUndefined();
  });

  it("سفارش ناموجود → ۴۰۴", async () => {
    p.order.findUnique.mockResolvedValue(null);
    await expectApiError(() => getOrder("PX-9", false), 404);
  });

  it("نسخه کامل شامل محاسبه و مانده", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 3 }));
    const detail = (await getOrder("PF-1201", false)) as Record<string, unknown>;
    expect(detail["calc"]).toBeDefined();
    expect((detail["calc"] as { total: number }).total).toBeGreaterThan(0);
  });
});

describe("canActOnStage — حالت‌های پایانی", () => {
  it("سفارش بسته/لغو‌شده → همه غیرفعال", () => {
    expect(canActOnStage({ status: "done", stage: 1, ownerId: "u" }, ["management"], "u")).toBe(false);
    expect(canActOnStage({ status: "cancelled", stage: 1, ownerId: "u" }, ["management"], "u")).toBe(false);
  });

  it("مرحله نامعتبر → false (نقش‌های غیرمدیر)", () => {
    expect(canActOnStage({ status: "open", stage: 99, ownerId: "u" }, ["production"], "u")).toBe(false);
  });

  it("نقش production در مرحله تولید مجاز است", () => {
    expect(
      canActOnStage({ status: "open", stage: 7, ownerId: "u" }, ["production"], "x"),
    ).toBe(true);
  });
});

// --- پوشش جزئیات farther (PHASE_08 Part A) ---------------------------

describe("getOrder — نگاشت رابطه‌ها", () => {
  it("پرداخت‌ها، چک‌ها، تاریخچه و اسناد تحویل نگاشته می‌شوند", async () => {
    p.order.findUnique.mockResolvedValue(
      rowFn({
        stage: 9,
        payments: [
          { id: "r1", kind: "cash", amount: 50000, date: "1405/08/01", note: "", void: false, byUserId: "u3", createdAt: 0n, by: { name: "مالی" } },
        ],
        cheques: [
          { id: "c1", sayad: "1234567890123456", amount: 70000, due: "1405/09/01", status: "hand", bank: "ملت", owner: "x", note: "", createdAt: 0n, updatedAt: 0n },
        ],
        stageLog: [
          { id: "s1", orderId: "PF-1201", fromStage: 1, toStage: 2, at: 0n, byUserId: "u5", note: "", kind: "stage", by: { name: "کارشناس" } },
        ],
        handoffs: [
          { id: "TR-1201", orderId: "PF-1201", lines: [{ productId: "P1", qty: 10, color: "" }], at: 0n, byUserId: "u7", note: "سالم: ۱۰" },
        ],
      }),
    );
    p.user.findMany.mockResolvedValue([{ id: "u7", name: "تولید" }]);

    const detail = (await getOrder("PF-1201", false)) as Record<string, unknown>;
    expect((detail["payments"] as unknown[]).length).toBe(1);
    expect((detail["cheques"] as unknown[]).length).toBe(1);
    expect((detail["stageLog"] as unknown[]).length).toBe(1);
    const handoff = (detail["handoffs"] as Array<Record<string, unknown>>)[0]!;
    expect(handoff["byName"]).toBe("تولید");
    expect(handoff["lines"]).toEqual([{ productId: "P1", qty: 10, color: "" }]);
  });

  it("سند تحویل بدون byUserId — نام خالی", async () => {
    p.order.findUnique.mockResolvedValue(
      rowFn({
        stage: 9,
        handoffs: [{ id: "TR-1201", orderId: "PF-1201", lines: "garbage", at: 0n, byUserId: null, note: "" }],
      }),
    );
    const detail = (await getOrder("PF-1201", false)) as Record<string, unknown>;
    const handoff = (detail["handoffs"] as Array<Record<string, unknown>>)[0]!;
    expect(handoff["byName"]).toBeNull();
    expect(handoff["lines"]).toEqual([]);
  });
});

describe("listOrders — فیلتر مبلغ در لیست (R-32)", () => {
  it("نقش noMoney فیلدهای پولی آیتم لیست را حذف می‌کند", async () => {
    const { listOrders } = await import("./order.service");
    p.order.findMany.mockResolvedValue([rowFn({ stage: 3 })]);
    p.order.count.mockResolvedValue(1);
    const result = (await listOrders(
      { page: 1, pageSize: 50, stage: null, status: null, ownerId: null, q: "" },
      { restrictToOwner: false, userId: "u1" },
      true,
    )) as { items: Array<Record<string, unknown>> };
    expect(result.items[0]!["calc"]).toBeUndefined();
    expect(result.items[0]!["paid"]).toBeUndefined();
    expect(result.items[0]!["ownerName"]).toBe("کارشناس");
  });
});

describe("startProduction — اتصال انبار (PHASE_05 §۸)", () => {
  it("کسری مواد → ۴۰۰ «شروع ممکن نیست» (order.js:509)", async () => {
    const { computeOnHand } = await import("@modules/inventory/services/stock.service");
    vi.mocked(computeOnHand).mockResolvedValue({ "raw|m1": 1 });
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 7 }));

    await expectApiError(
      () => applyStageAction("PF-1201", { action: "startProduction" }, ACTOR, false),
      400,
      "مواد اولیه کافی نیست",
    );
  });

  it("موجودی کافی → حرکت use منفی + prod.used ثبت می‌شود", async () => {
    const { computeOnHand } = await import("@modules/inventory/services/stock.service");
    vi.mocked(computeOnHand).mockResolvedValue({ "raw|m1": 1000 });
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 7, prod: { start: "", end: "", qc: null } }));

    await applyStageAction("PF-1201", { action: "startProduction" }, ACTOR, false);
    const move = tx.move.create.mock.calls[0]![0] as {
      data: { wh: string; kind: string; qty: number };
    };
    expect(move.data["kind"]).toBe("use");
    expect(move.data["qty"]).toBeLessThan(0);
    const data = tx.order.update.mock.calls[0]![0] as {
      data: { prod: { startedAt: number; used: Record<string, number> } };
    };
    expect(data.data["prod"]["used"]).toMatchObject({ m1: 20 }); // 2 * qty=10
  });

  it("سفارش بدون قلم تولیدی → ۴۰۰", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 7 }));
    p.product.findMany.mockResolvedValue([{ id: "P1", line: "agency", name: "نمایندگی" }]);
    await expectApiError(
      () => applyStageAction("PF-1201", { action: "startProduction" }, ACTOR, false),
      400,
      "قلم تولیدی",
    );
  });
});

describe("paccept — پذیرش تولید (order.js:719)", () => {
  it("۶→۷ با زمان‌بندی و prod", async () => {
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 6 }));
    await applyStageAction(
      "PF-1201",
      { action: "paccept", start: "1405/08/20", end: "1405/08/25" },
      ACTOR,
      false,
    );
    const data = tx.order.update.mock.calls[0]![0] as {
      data: { stage: number; prod: { start: string; end: string } };
    };
    expect(data.data["stage"]).toBe(7);
    expect(data.data["prod"]["start"]).toBe("1405/08/20");
  });

  it("paccept در مرحله اشتباه → ۴۰۰", async () => {
    // production در مرحله ۷ مجاز است ولی paccept فقط در ۶ کار می‌کند
    p.order.findUnique.mockResolvedValue(rowFn({ stage: 7 }));
    await expectApiError(
      () => applyStageAction("PF-1201", { action: "paccept", start: "", end: "" }, ACTOR, false),
      400,
      "پذیرش",
    );
  });
});
