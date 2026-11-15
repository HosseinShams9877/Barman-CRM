/**
 * تست‌های یکپارچه سرویس سفارش (PHASE_04 §۱۲).
 *
 * پوشش:
 *  - قانون تخفیف سه‌حالته CD-25 (effectiveDiscountCap / assertDiscountCap)
 *  - ماتریس مجوز جابه‌جایی مرحله canActOnStage (core.js:182-189)
 *  - فیلتر pxAll در listOrders (R-10)
 *  - انتقالات مرحله: submit بر اساس نقش، approve با smOk/mgrOk،
 *    return با backNote و پاک شدن تأییدها، send، finalize با/بدون پرش ۶/۷/۸
 *  - ۴۰۳ برای مسیرهای مجازنشده
 *  - سقف تخفیف هنگام ایجاد
 *
 * پراسیا به‌صورت کامل mock می‌شود (الگوی lead.service.test.ts).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@core/database/client";
import { ApiError } from "@core/errors";
import type { Role } from "@core/permissions";
import { Prisma } from "@prisma/client";
import {
  applyStageAction,
  canActOnStage,
  assertDiscountCap,
  createOrder,
  effectiveDiscountCap,
  listOrders,
  type Actor,
  type OrderListScope,
} from "./order.service";
import type { OrderListParams } from "../types/order.types";

vi.mock("@core/database/client", () => {
  const orderCreate = vi.fn();
  const orderUpdate = vi.fn();
  const stageLogCreate = vi.fn();
  const paymentCreate = vi.fn();
  const paymentUpdate = vi.fn();
  const chequeCreate = vi.fn();
  const chequeUpdate = vi.fn();
  const handoffCreate = vi.fn();
  const findUnique = vi.fn();
  const findMany = vi.fn();
  const count = vi.fn();
  const productFindMany = vi.fn();
  const settingFindUnique = vi.fn();
  const userFindMany = vi.fn();
  const tx = {
    order: { create: orderCreate, update: orderUpdate },
    orderStageLog: { create: stageLogCreate },
    orderPayment: { create: paymentCreate, update: paymentUpdate },
    orderCheque: { create: chequeCreate, update: chequeUpdate },
    orderHandoff: { create: handoffCreate },
  };
  return {
    prisma: {
      order: { findUnique, findMany, count, update: orderUpdate, create: orderCreate },
      product: { findMany: productFindMany, count: vi.fn() },
      user: { findMany: userFindMany },
      // مورد نیاز برای side-effect.seed که از طریق @core/database اجرا می‌شود
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
  order: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  product: { findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
  user: { findMany: ReturnType<typeof vi.fn> };
  setting: { findUnique: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
  __tx: {
    order: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    orderStageLog: { create: ReturnType<typeof vi.fn> };
    orderPayment: { create: ReturnType<typeof vi.fn> };
    orderCheque: { create: ReturnType<typeof vi.fn> };
    orderHandoff: { create: ReturnType<typeof vi.fn> };
  };
};

const tx = p.__tx;

/** یک ردیف سفارش کامل با پیش‌فرض‌های قابل بازنویسی. */
function row(overrides: Record<string, unknown> = {}) {
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
    account: { name: "شرخت" },
    contact: null,
    owner: { name: "کارشناس" },
    ...overrides,
  };
}

const ACTOR = (userId: string, roles: Role[]): Actor => ({ userId, roles });

beforeEach(() => {
  vi.clearAllMocks();
  p.setting.findUnique.mockResolvedValue(null);
  p.order.findUnique.mockResolvedValue(row());
  p.order.findMany.mockResolvedValue([]);
  p.order.count.mockResolvedValue(0);
  p.product.findMany.mockResolvedValue([{ id: "P1" }]);
  p.user.findMany.mockResolvedValue([]);
  tx.order.update.mockResolvedValue({});
  tx.order.create.mockResolvedValue({});
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

// --- قانون تخفیف سه‌حالته (CD-25) ----------------------------------------

describe("effectiveDiscountCap — سه حالت CD-25", () => {
  it("caps === null یعنی نامحدود", () => {
    expect(effectiveDiscountCap(null, ["sales"])).toBeNull();
  });

  it("کلید null یعنی نامحدود (even alongside zero caps)", () => {
    expect(effectiveDiscountCap({ admin: 0, sales: null }, ["sales"])).toBeNull();
    expect(effectiveDiscountCap({ admin: null }, ["admin", "finance"])).toBeNull();
  });

  it("نبود کلید یعنی سقف ۰", () => {
    expect(effectiveDiscountCap({}, ["sales"])).toBe(0);
    expect(effectiveDiscountCap({ admin: 100 }, ["sales"])).toBe(0);
  });

  it("بیشترین سقف بین نقش‌ها انتخاب می‌شود", () => {
    expect(effectiveDiscountCap({ sales: 3, salesManager: 8 }, ["sales", "salesManager"])).toBe(8);
    expect(effectiveDiscountCap({ sales: 3, admin: 100 }, ["sales", "admin"])).toBe(100);
  });

  it("cap>0 مقدار سقف است", () => {
    expect(effectiveDiscountCap({ finance: 5 }, ["finance"])).toBe(5);
  });
});

describe("assertDiscountCap — اجرای سقف در سرور", () => {
  it("cap null هر تخفیفی مجاز است", () => {
    expect(() => assertDiscountCap(100, null, ["sales"])).not.toThrow();
  });

  it("cap 0 هر تخفیف > 0 را رد می‌کند (۴۰۰)", () => {
    expect(() => assertDiscountCap(1, { finance: 0 }, ["finance"])).toThrow();
    try {
      assertDiscountCap(5, { finance: 0 }, ["finance"]);
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      if (e instanceof ApiError) {
        expect(e.status).toBe(400);
        expect(e.message).toContain("سقف تخفیف صفر");
      }
    }
    // خود نقش finance با cap 0 → تخفیف ۰ مجاز
    expect(() => assertDiscountCap(0, { finance: 0 }, ["finance"])).not.toThrow();
  });

  it("cap مثبت: تخفیف بیشتر از cap رد، مساوی/کمتر مجاز", () => {
    expect(() => assertDiscountCap(6, { salesManager: 5 }, ["salesManager"])).toThrow();
    expect(() => assertDiscountCap(5, { salesManager: 5 }, ["salesManager"])).not.toThrow();
    expect(() => assertDiscountCap(2, { salesManager: 5 }, ["salesManager"])).not.toThrow();
    try {
      assertDiscountCap(6, { salesManager: 5 }, ["salesManager"]);
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      if (e instanceof ApiError) {
        expect(e.status).toBe(400);
        expect(e.message).toContain("سقف مجاز");
      }
    }
  });

  it("cap منفی نامعتبر است (۴۰۰)", () => {
    try {
      assertDiscountCap(3, { admin: -1 }, ["admin"] as Role[]);
      expect.fail("باید خطا پرتاب می‌شد");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      if (e instanceof ApiError) {
        expect(e.status).toBe(400);
        expect(e.message).toContain("نامعتبر");
      }
    }
  });
});

// --- ماتریس مجوز مرحله (core.js:182-189) ----------------------------------

describe("canActOnStage — ماتریس مجوز", () => {
  const at = (stage: number, roles: Role[], ownerId = "u-sales", actorId = "u-x") =>
    canActOnStage({ status: "open", stage, ownerId }, roles, actorId);

  it("سفارش بسته/لغوشده: هیچ کسی نمی‌تواند کاری کند", () => {
    for (const status of ["done", "cancelled"] as const) {
      for (const roles of [["admin"], ["management"], ["finance"]] as Role[][]) {
        expect(canActOnStage({ status, stage: 3, ownerId: "u" }, roles, "u")).toBe(false);
      }
    }
  });

  it("management/admin در همه مراحل مجازند", () => {
    for (let s = 1; s <= 11; s++) {
      expect(at(s, ["management"])).toBe(true);
      expect(at(s, ["admin"])).toBe(true);
    }
  });

  it("مرحله ۵ فقط finance است", () => {
    expect(at(5, ["finance"])).toBe(true);
    expect(at(5, ["sales"])).toBe(false);
    expect(at(5, ["production"])).toBe(false);
    expect(at(5, ["depot"])).toBe(false);
  });

  it("مرحله sales: فقط مالک یا salesManager", () => {
    // stage 1 (draft) و 4 (send) → who = sales
    expect(at(1, ["sales"], "u-sales", "u-sales")).toBe(true);
    expect(at(1, ["sales"], "u-sales", "u-other")).toBe(false);
    expect(at(1, ["salesManager"], "u-sales", "u-other")).toBe(true);
    expect(at(4, ["sales"], "u-sales", "u-sales")).toBe(true);
    expect(at(4, ["depot"], "u-sales", "u-sales")).toBe(false);
  });

  it("مراحل production: فقط production", () => {
    expect(at(6, ["production"])).toBe(true);
    expect(at(7, ["production"])).toBe(true);
    expect(at(8, ["production"])).toBe(true);
    expect(at(7, ["sales"], "u-sales", "u-sales")).toBe(false);
  });

  it("مراحل depot: فقط depot", () => {
    expect(at(9, ["depot"])).toBe(true);
    expect(at(10, ["depot"])).toBe(true);
    expect(at(11, ["depot"])).toBe(true);
    expect(at(10, ["production"])).toBe(false);
  });

  it("مرحله ۲ salesManager و ۳ management", () => {
    expect(at(2, ["salesManager"])).toBe(true);
    expect(at(2, ["sales"], "u-sales", "u-sales")).toBe(false);
    expect(at(3, ["management"])).toBe(true);
    expect(at(3, ["salesManager"])).toBe(false);
  });
});

// --- listOrders — فیلتر pxAll (R-10) ---------------------------------------

describe("listOrders — فیلتر مالک (pxAll / R-10)", () => {
  const PARAMS: OrderListParams = {
    stage: null,
    status: null,
    ownerId: null,
    q: "",
    page: 1,
    pageSize: 20,
  };

  it("کاربر عادی فقط سفارش‌های خودش را می‌بیند", async () => {
    const scope: OrderListScope = { restrictToOwner: true, userId: "u-sales" };
    await listOrders(PARAMS, scope, false);
    const where = p.order.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where.ownerId).toBe("u-sales");
    const whereCount = p.order.count.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(whereCount.ownerId).toBe("u-sales");
  });

  it("با مجوز viewAll فیلتر مالک اعمال نمی‌شود", async () => {
    const scope: OrderListScope = { restrictToOwner: false, userId: "u-sales" };
    await listOrders(PARAMS, scope, false);
    const where = p.order.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where.ownerId).toBeUndefined();
  });

  it("فیلتر ownerId اپلیکیشن فقط در حالت viewAll کار می‌کند", async () => {
    const scope: OrderListScope = { restrictToOwner: false, userId: "u-mgr" };
    await listOrders({ ...PARAMS, ownerId: "u-alice" }, scope, false);
    const where = p.order.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where.ownerId).toBe("u-alice");
  });

  it("فیلتر stage و status و جستجو اعمال می‌شود", async () => {
    const scope: OrderListScope = { restrictToOwner: false, userId: "u-mgr" };
    await listOrders({ ...PARAMS, stage: 5, status: "open", q: "PF-1" }, scope, false);
    const where = p.order.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where.stage).toBe(5);
    expect(where.status).toBe("open");
    expect(where.OR).toBeDefined();
  });

  it("hideMoney فیلدهای پولی آیتم‌ها را حذف می‌کند (R-32)", async () => {
    p.order.findMany.mockResolvedValue([
      row({ id: "PF-1", calc: { sub: 10, total: 11 }, paid: 0, balance: 11, discPct: 0 }),
    ]);
    const scope: OrderListScope = { restrictToOwner: false, userId: "u-prod" };
    const res = await listOrders(PARAMS, scope, true);
    const item = res.items[0] as Record<string, unknown>;
    expect(item.calc).toBeUndefined();
    expect(item.paid).toBeUndefined();
    expect(item.balance).toBeUndefined();
    expect(item.discPct).toBeUndefined();
  });
});

// --- ماشین حالت مرحله -------------------------------------------------------

describe("applyStageAction — ارسال برای تأیید (order.js:271-273)", () => {
  it("sales → مرحله ۲", async () => {
    await applyStageAction("PF-1201", { action: "submit" }, ACTOR("u-sales", ["sales"]), false);
    const data = tx.order.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.stage).toBe(2);
  });

  it("salesManager → مرحله ۳", async () => {
    await applyStageAction("PF-1201", { action: "submit" }, ACTOR("u-sm", ["salesManager"]), false);
    const data = tx.order.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.stage).toBe(3);
  });

  it("سایر نقش‌ها → مرحله ۴", async () => {
    await applyStageAction("PF-1201", { action: "submit" }, ACTOR("u-m", ["management"]), false);
    const data = tx.order.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.stage).toBe(4);
  });

  it("بدون مشتری رد می‌شود (۴۰۰)", async () => {
    p.order.findUnique.mockResolvedValue(row({ accountId: null }));
    await expectApiError(
      () => applyStageAction("PF-1201", { action: "submit" }, ACTOR("u-sales", ["sales"]), false),
      400,
      "مشتری را انتخاب کنید",
    );
  });

  it("در مرحله غیر از ۱ رد می‌شود", async () => {
    p.order.findUnique.mockResolvedValue(row({ stage: 2 }));
    await expectApiError(
      () => applyStageAction("PF-1201", { action: "submit" }, ACTOR("u-sm", ["salesManager"]), false),
      400,
    );
  });
});

describe("applyStageAction — تأیید (smOk / mgrOk)", () => {
  it("salesManager در مرحله ۲ → smOk ثبت و stage ۳", async () => {
    p.order.findUnique.mockResolvedValue(row({ stage: 2 }));
    await applyStageAction("PF-1201", { action: "approve" }, ACTOR("u-sm", ["salesManager"]), false);
    const data = tx.order.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.stage).toBe(3);
    expect(data.smOk).toEqual({ by: "u-sm", t: expect.any(Number) });
    expect(data.mgrOk).toBeUndefined();
    const log = tx.orderStageLog.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(log.fromStage).toBe(2);
    expect(log.toStage).toBe(3);
  });

  it("management در مرحله ۳ → mgrOk ثبت و stage ۴", async () => {
    p.order.findUnique.mockResolvedValue(row({ stage: 3 }));
    await applyStageAction("PF-1201", { action: "approve" }, ACTOR("u-m", ["management"]), false);
    const data = tx.order.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.stage).toBe(4);
    expect(data.mgrOk).toEqual({ by: "u-m", t: expect.any(Number) });
  });

  it("تأیید در مرحله ۱ رد می‌شود", async () => {
    await expectApiError(
      () => applyStageAction("PF-1201", { action: "approve" }, ACTOR("u-sm", ["salesManager"]), false),
      400,
      "ارسال کنید",
    );
  });

  it("تأیید در مرحله ≥ ۵ رد می‌شود", async () => {
    p.order.findUnique.mockResolvedValue(row({ stage: 5 }));
    await expectApiError(
      () => applyStageAction("PF-1201", { action: "approve" }, ACTOR("u-m", ["management"]), false),
      400,
    );
  });

  it("sales (مالک اما غیر salesManager) در مرحله ۲ → ۴۰۳", async () => {
    p.order.findUnique.mockResolvedValue(row({ stage: 2, ownerId: "u-sales" }));
    await expectApiError(
      () => applyStageAction("PF-1201", { action: "approve" }, ACTOR("u-sales", ["sales"]), false),
      403,
    );
    expect(tx.order.update).not.toHaveBeenCalled();
  });
});

describe("applyStageAction — بازگشت برای اصلاح (order.js:698)", () => {
  it("از مرحله ۲ → ۱ با backNote و پاک شدن smOk", async () => {
    p.order.findUnique.mockResolvedValue(row({ stage: 2, smOk: { by: "u-sm", t: 1 } }));
    await applyStageAction(
      "PF-1201",
      { action: "return", reason: "قیمت", note: "تخفیف بیشتر" },
      ACTOR("u-sm", ["salesManager"]),
      false,
    );
    const data = tx.order.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.stage).toBe(1);
    expect(data.smOk).toBe(Prisma.DbNull);
    expect(data.mgrOk).toBe(Prisma.DbNull);
    expect(data.backNote).toEqual({
      by: "u-sm",
      t: expect.any(Number),
      text: "قیمت — تخفیف بیشتر",
    });
    const log = tx.orderStageLog.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(log.kind).toBe("back");
    expect(log.toStage).toBe(1);
    expect(String(log.note)).toContain("برگشت برای اصلاح");
  });

  it("از مرحله ۳ → ۱ و smOk حفظ می‌شود", async () => {
    const smOk = { by: "u-sm", t: 1 };
    p.order.findUnique.mockResolvedValue(row({ stage: 3, smOk }));
    await applyStageAction(
      "PF-1201",
      { action: "return", note: "اصلاح آدرس" },
      ACTOR("u-m", ["management"]),
      false,
    );
    const data = tx.order.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.stage).toBe(1);
    expect(data.smOk).toEqual(smOk);
  });

  it("از مرحله ۴ رد می‌شود", async () => {
    p.order.findUnique.mockResolvedValue(row({ stage: 4 }));
    await expectApiError(
      () => applyStageAction("PF-1201", { action: "return", note: "x" }, ACTOR("u-m", ["management"]), false),
      400,
    );
  });

  it("بعد از بازگشت، تأیید مجدد لازم است (submit از مرحله ۱ مجاز)", async () => {
    p.order.findUnique.mockResolvedValue(row({ stage: 1, smOk: null }));
    await applyStageAction("PF-1201", { action: "submit" }, ACTOR("u-sm", ["salesManager"]), false);
    const data = tx.order.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.stage).toBe(3);
  });
});

describe("applyStageAction — ارسال برای مشتری (۴→۵)", () => {
  it("send با via ثبت می‌شود", async () => {
    p.order.findUnique.mockResolvedValue(row({ stage: 4 }));
    await applyStageAction(
      "PF-1201",
      { action: "send", via: ["sms"] },
      ACTOR("u-sales", ["sales"]),
      false,
    );
    const data = tx.order.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.stage).toBe(5);
    expect(data.sent).toEqual({ via: "sms", at: expect.any(Number) });
  });

  it("send در مرحله ۵ رد می‌شود", async () => {
    p.order.findUnique.mockResolvedValue(row({ stage: 5 }));
    await expectApiError(
      () => applyStageAction("PF-1201", { action: "send", via: ["sms"] }, ACTOR("u-m", ["management"]), false),
      400,
    );
  });
});

describe("applyStageAction — قطعی‌سازی (finalize — order.js:452-472)", () => {
  const FIN = ACTOR("u-fin", ["finance"]);

  it("خط تولیدی → مرحله ۶ بدون پرش و materialize پرداخت/چک", async () => {
    // preset half روی total = ۱۱٬۰۰۰٬۰۰۰ (با مالیات ۱۰٪): ۵٫۵M نقد + ۵٫۵M چک
    p.order.findUnique.mockResolvedValue(row({ stage: 5 }));
    await applyStageAction("PF-1201", { action: "finalize", agreedHow: "call", agreedNote: "" }, FIN, false);
    const data = tx.order.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.stage).toBe(6);
    expect(data.skipped).toEqual([]);
    expect(data.agreed).toEqual({ t: expect.any(Number), how: "call", note: "" });
    expect(tx.orderPayment.create).toHaveBeenCalledTimes(1);
    const pay = tx.orderPayment.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(pay.amount).toBe(5_500_000);
    expect(pay.kind).toBe("cash");
    expect(tx.orderCheque.create).toHaveBeenCalledTimes(1);
    const chq = tx.orderCheque.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(chq.amount).toBe(5_500_000);
    expect(chq.status).toBe("hand");
    expect(chq.sayad).toBe("");
  });

  it("خط نمایندگی → پرش [۶،۷،۸] و مرحله ۹", async () => {
    p.order.findUnique.mockResolvedValue(row({ stage: 5, line: "agency" }));
    await applyStageAction("PF-1201", { action: "finalize", agreedHow: "pay", agreedNote: "" }, FIN, false);
    const data = tx.order.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.stage).toBe(9);
    expect(data.skipped).toEqual([6, 7, 8]);
    const log = tx.orderStageLog.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(String(log.note)).toContain("پرش مراحل تولید");
    // چک‌ها و پیش‌پرداخت هنوز materialize می‌شوند
    expect(tx.orderCheque.create).toHaveBeenCalledTimes(1);
    expect(tx.orderPayment.create).toHaveBeenCalledTimes(1);
  });

  it("بدون preset/planBuilder → ۴۰۰ برنامه نامشخص", async () => {
    p.order.findUnique.mockResolvedValue(row({ stage: 5, preset: "" }));
    await expectApiError(
      () => applyStageAction("PF-1201", { action: "finalize", agreedHow: "call", agreedNote: "" }, FIN, false),
      400,
      "برنامه پرداخت مشخص نیست",
    );
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("خارج از مرحله ۵ رد می‌شود", async () => {
    p.order.findUnique.mockResolvedValue(row({ stage: 6 }));
    await expectApiError(
      () => applyStageAction("PF-1201", { action: "finalize", agreedHow: "call", agreedNote: "" }, ACTOR("u-prod", ["production"]), false),
      400,
    );
  });

  it("نقش غیر finance در مرحله ۵ → ۴۰۳", async () => {
    p.order.findUnique.mockResolvedValue(row({ stage: 5 }));
    await expectApiError(
      () => applyStageAction("PF-1201", { action: "finalize", agreedHow: "call", agreedNote: "" }, ACTOR("u-sales", ["sales"]), false),
      403,
    );
    expect(tx.order.update).not.toHaveBeenCalled();
  });
});

// --- ایجاد با سقف تخفیف -----------------------------------------------------

describe("createOrder — اجرای CD-25 هنگام ایجاد", () => {
  const INPUT = {
    line: "prod" as const,
    items: [{ productId: "P1", qty: 1, price: 1_000_000, discount: 0, color: "" }],
    discPct: 0,
    discAmt: 0,
    ship: 0,
    install: 0,
    noVat: false,
    validDays: 3,
    note: "",
    preset: "",
  };

  it("sales با تخفیف ۱۰ و سقف ۳ → ۴۰۰", async () => {
    await expectApiError(
      () => createOrder({ ...INPUT, discPct: 10 }, ACTOR("u-sales", ["sales"])),
      400,
      "سقف مجاز",
    );
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it("sales با تخفیف ۳ (دقیقاً سقف) مجاز است", async () => {
    await createOrder({ ...INPUT, discPct: 3 }, ACTOR("u-sales", ["sales"]));
    expect(tx.order.create).toHaveBeenCalledTimes(1);
    const data = tx.order.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.discPct).toBe(3);
  });

  it("admin با سقف ۱۰۰ می‌تواند تخفیف ۱۰۰ بدهد", async () => {
    await createOrder({ ...INPUT, discPct: 100 }, ACTOR("u-ad", ["admin"]));
    const data = tx.order.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.discPct).toBe(100);
  });

  it("محصول ناشناخته رد می‌شود", async () => {
    p.product.findMany.mockResolvedValue([]);
    await expectApiError(
      () => createOrder(INPUT, ACTOR("u-ad", ["admin"])),
      400,
      "محصول",
    );
  });

  it("شناسه بر اساس تمام سفارش‌ها (شامل done) تولید می‌شود — رگرسیون کانسترینت یکتایی", async () => {
    // قبلاً فقط سفارش‌های open بررسی می‌شدند؛ پس از done شدن PF-1203
    // شناسه PF-1203 دوباره تولید و کانسترینت یکتایی نقض می‌شد. Demo
    // شمارنده تک‌منهای مستقل از وضعیت دارد (core.js:365 nextId).
    p.order.findMany.mockResolvedValue([
      { id: "PF-1201" },
      { id: "PF-1202" },
      { id: "PF-1203" },
    ]);
    await createOrder(INPUT, ACTOR("u-ad", ["admin"]));
    const where = p.order.findMany.mock.calls[0]?.[0]?.where;
    expect(where).toBeUndefined();
    const data = tx.order.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.id).toBe("PF-1204");
  });
});
