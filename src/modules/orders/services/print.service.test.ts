/**
 * تست‌های سرویس چاپ امن سفارش (PHASE_04 §۹ — Secure print, R-01).
 *
 * پوشش:
 *  - صدور توکن HMAC مقید به (sub, oid) با TTL از PRINT_TOKEN_TTL_MS
 *  - ۴۰۳ برای نقش بدون orders.view (تنها نقش‌های مجاز این مجوز را دارند)
 *  - تأیید امضا/انقضا/ساختار محموله — توکن دستکاری‌شده → null
 *  - ۴۰۱ بدون توکن / توکن نامعتبر / توکن منقضی
 *  - ۴۰۳ توکن مربوط به سفارش دیگر (cross-order)
 *  - ۴۰۴ سفارش ناموجود
 *  - فیلتر noMoney بر اساس نقش‌های داخل توکن (R-32)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { prisma } from "@core/database/client";
import { ApiError } from "@core/errors";
import {
  PRINT_TOKEN_TTL_DEFAULT_MS,
  PRINT_TOKEN_TTL_ENV,
  getPrintOrder,
  issuePrintToken,
  printTokenTtlMs,
  verifyPrintToken,
} from "./print.service";

vi.mock("@core/database/client", () => {
  const findUnique = vi.fn();
  const findMany = vi.fn();
  const count = vi.fn();
  const settingFindUnique = vi.fn();
  const productFindMany = vi.fn();
  const userFindMany = vi.fn();
  const tx = {
    order: { create: vi.fn(), update: vi.fn() },
    orderStageLog: { create: vi.fn() },
    orderPayment: { create: vi.fn(), update: vi.fn() },
    orderCheque: { create: vi.fn(), update: vi.fn() },
    orderHandoff: { create: vi.fn() },
  };
  return {
    prisma: {
      order: { findUnique, findMany, count, update: vi.fn(), create: vi.fn() },
      orderPayment: { create: vi.fn(), update: vi.fn() },
      orderCheque: { create: vi.fn(), update: vi.fn() },
      orderStageLog: { create: vi.fn() },
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
    },
  };
});

const p = vi.mocked(prisma) as unknown as {
  order: { findUnique: ReturnType<typeof vi.fn> };
  setting: { findUnique: ReturnType<typeof vi.fn> };
  user: { findMany: ReturnType<typeof vi.fn> };
};

const SECRET = "a".repeat(40);
let originalSecret: string | undefined;
let originalTtl: string | undefined;

/** ردیف کامل سفارش برای getOrder. */
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
        qty: 2,
        price: 1_000_000,
        discount: 0,
        color: "",
        product: { name: "محصول ۱", code: "P1", unit: "عدد" },
      },
    ],
    payments: [
      { id: "pay1", kind: "cash", amount: 500_000, date: "1405/09/01", void: false, note: "", byUserId: "u", createdAt: 1 },
    ],
    cheques: [],
    stageLog: [{ id: "l1", fromStage: 1, toStage: 1, kind: "stage", note: "ثبت پیش‌فاکتور", at: 1, byUserId: "u" }],
    handoffs: [],
    account: { name: "شرخت" },
    contact: null,
    owner: { name: "کارشناس" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  originalSecret = process.env["AUTH_SECRET"];
  originalTtl = process.env[PRINT_TOKEN_TTL_ENV];
  process.env["AUTH_SECRET"] = SECRET;
  delete process.env[PRINT_TOKEN_TTL_ENV];
  p.order.findUnique.mockResolvedValue(row());
  p.setting.findUnique.mockResolvedValue(null);
  p.user.findMany.mockResolvedValue([]);
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env["AUTH_SECRET"];
  else process.env["AUTH_SECRET"] = originalSecret;
  if (originalTtl === undefined) delete process.env[PRINT_TOKEN_TTL_ENV];
  else process.env[PRINT_TOKEN_TTL_ENV] = originalTtl;
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

/** ساخت توکن دستی با محموله دلخواه و امضای معتبر. */
function signClaims(claims: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const sig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function decode(token: string): Record<string, unknown> {
  const payload = token.slice(0, token.lastIndexOf("."));
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

// --- printTokenTtlMs ----------------------------------------------------------

describe("printTokenTtlMs — TTL قابل پیکربندی (PHASE_04 §۹)", () => {
  it("پیش‌فرض ۵ دقیقه است", () => {
    expect(printTokenTtlMs()).toBe(PRINT_TOKEN_TTL_DEFAULT_MS);
    expect(PRINT_TOKEN_TTL_DEFAULT_MS).toBe(300_000);
  });

  it("مقدار معتبر از متغیر محیطی خوانده می‌شود", () => {
    process.env[PRINT_TOKEN_TTL_ENV] = "60000";
    expect(printTokenTtlMs()).toBe(60_000);
  });

  it("مقادیر نامعتبر به پیش‌فرض برمی‌گردند", () => {
    for (const raw of ["abc", "0", "-5", "", "  ", "NaN", "1e999"]) {
      process.env[PRINT_TOKEN_TTL_ENV] = raw;
      expect(printTokenTtlMs(), `raw=${JSON.stringify(raw)}`).toBe(PRINT_TOKEN_TTL_DEFAULT_MS);
    }
  });

  it("بیشتر از ۲۴ ساعت به پیش‌فرض برمی‌گردد", () => {
    process.env[PRINT_TOKEN_TTL_ENV] = String(24 * 60 * 60 * 1000 + 1);
    expect(printTokenTtlMs()).toBe(PRINT_TOKEN_TTL_DEFAULT_MS);
    process.env[PRINT_TOKEN_TTL_ENV] = String(24 * 60 * 60 * 1000);
    expect(printTokenTtlMs()).toBe(24 * 60 * 60 * 1000);
  });
});

// --- issuePrintToken ----------------------------------------------------------

describe("issuePrintToken — صدور توکن", () => {
  it("توکن با محموله sub/oid/roles/iat/exp صادر می‌شود", () => {
    const token = issuePrintToken("PF-1201", { userId: "u-sales", roles: ["sales"] });
    const claims = decode(token);
    expect(claims["sub"]).toBe("u-sales");
    expect(claims["oid"]).toBe("PF-1201");
    expect(claims["roles"]).toEqual(["sales"]);
    expect(claims["iat"]).toBeTypeOf("number");
    expect(claims["exp"]).toBeTypeOf("number");
  });

  it("انقضا برابر TTL پیش‌فرض است", () => {
    const token = issuePrintToken("PF-1201", { userId: "u", roles: ["admin"] });
    const claims = decode(token);
    expect(Number(claims["exp"]) - Number(claims["iat"])).toBe(PRINT_TOKEN_TTL_DEFAULT_MS);
  });

  it("نقش بدون orders.view → ۴۰۳", () => {
    // همه نقش‌های تعریف‌شده orders.view دارند — تنها آرایه نقش خالی به این شاخه می‌رسد
    expect(() =>
      issuePrintToken("PF-1201", { userId: "u", roles: [] }),
    ).toThrowError(/مجوز چاپ/);
  });

  it("AUTH_SECRET کوتاه → خطا", () => {
    process.env["AUTH_SECRET"] = "short";
    expect(() => issuePrintToken("PF-1201", { userId: "u", roles: ["admin"] })).toThrowError(
      /AUTH_SECRET/,
    );
  });

  it("توکن برای سفارش‌های مختلف متفاوت است", () => {
    const t1 = issuePrintToken("PF-1201", { userId: "u", roles: ["admin"] });
    const t2 = issuePrintToken("PF-1202", { userId: "u", roles: ["admin"] });
    expect(decode(t1)["oid"]).toBe("PF-1201");
    expect(decode(t2)["oid"]).toBe("PF-1202");
  });
});

// --- verifyPrintToken ---------------------------------------------------------

describe("verifyPrintToken — تأیید امضا و انقضا", () => {
  it("توکن صادرشده معتبر است", () => {
    const token = issuePrintToken("PF-1201", { userId: "u-sales", roles: ["sales"] });
    const claims = verifyPrintToken(token);
    expect(claims).not.toBeNull();
    expect(claims?.sub).toBe("u-sales");
    expect(claims?.oid).toBe("PF-1201");
    expect(claims?.roles).toEqual(["sales"]);
  });

  it("توکن دستکاری‌شده (تغییر محموله) رد می‌شود", () => {
    const token = issuePrintToken("PF-1201", { userId: "u", roles: ["admin"] });
    const i = token.lastIndexOf(".");
    const tampered = `${token.slice(0, i)}X${token.slice(i)}`;
    expect(verifyPrintToken(tampered)).toBeNull();
  });

  it("توکن با امضای اشتباه رد می‌شود", () => {
    const token = issuePrintToken("PF-1201", { userId: "u", roles: ["admin"] });
    const i = token.lastIndexOf(".");
    expect(verifyPrintToken(`${token.slice(0, i)}.AAAA`)).toBeNull();
  });

  it("توکن با رازه متفاوت رد می‌شود", () => {
    const token = issuePrintToken("PF-1201", { userId: "u", roles: ["admin"] });
    process.env["AUTH_SECRET"] = "b".repeat(40);
    expect(verifyPrintToken(token)).toBeNull();
  });

  it("ورودی‌های بدون نقطه/خالی/null/undefined → null", () => {
    expect(verifyPrintToken("")).toBeNull();
    expect(verifyPrintToken(null)).toBeNull();
    expect(verifyPrintToken(undefined)).toBeNull();
    expect(verifyPrintToken("PF-1201")).toBeNull();
    expect(verifyPrintToken("a.b.")).toBeNull();
  });

  it("محموله غیر JSON رد می‌شود", () => {
    const encoded = Buffer.from("not-json", "utf8").toString("base64url");
    const sig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
    expect(verifyPrintToken(`${encoded}.${sig}`)).toBeNull();
  });

  it("محموله با فیلدهای ناقص رد می‌شود", () => {
    const cases: Array<Record<string, unknown>> = [
      { sub: "u", oid: "PF-1", roles: [], iat: 1 }, // بدون exp
      { sub: "u", oid: "PF-1", roles: [], exp: 1 }, // بدون iat
      { sub: "", oid: "PF-1", roles: [], iat: 1, exp: 2 }, // sub خالی
      { sub: "u", oid: "", roles: [], iat: 1, exp: 2 }, // oid خالی
      { sub: "u", oid: "PF-1", iat: 1, exp: 2 }, // بدون roles
      { sub: "u", oid: "PF-1", roles: "admin", iat: 1, exp: 2 }, // roles غیرآرایه
      { sub: "u", oid: "PF-1", roles: [], iat: "1", exp: 2 }, // iat غیرعدد
    ];
    for (const claims of cases) {
      expect(verifyPrintToken(signClaims(claims)), JSON.stringify(claims)).toBeNull();
    }
  });

  it("توکن منقضی رد می‌شود", () => {
    const expired = signClaims({
      sub: "u",
      oid: "PF-1201",
      roles: ["admin"],
      iat: Date.now() - 10_000,
      exp: Date.now() - 1,
    });
    expect(verifyPrintToken(expired)).toBeNull();
  });

  it("توکن با انقضا دقیقاً اکنون رد می‌شود (>=)", () => {
    const now = Date.now();
    const token = signClaims({ sub: "u", oid: "PF-1201", roles: ["admin"], iat: now, exp: now });
    expect(verifyPrintToken(token)).toBeNull();
  });
});

// --- getPrintOrder ------------------------------------------------------------

describe("getPrintOrder — مسیر چاپ بدون کوکی (R-01)", () => {
  it("توکن معتبر → داده کامل سفارش + شرکت و نرخ مالیات", async () => {
    const token = issuePrintToken("PF-1201", { userId: "u-sales", roles: ["salesManager"] });
    const out = await getPrintOrder("PF-1201", token);
    expect(out.id).toBe("PF-1201");
    expect(out.company).toBeTypeOf("object");
    expect(out.vatRate).toBe(10);
  });

  it("بدون توکن → ۴۰۱", async () => {
    await expectApiError(() => getPrintOrder("PF-1201", null), 401, "توکن چاپ");
    await expectApiError(() => getPrintOrder("PF-1201", undefined), 401);
    await expectApiError(() => getPrintOrder("PF-1201", ""), 401);
  });

  it("توکن نامعتبر → ۴۰۱", async () => {
    await expectApiError(() => getPrintOrder("PF-1201", "garbage"), 401, "منقضی");
    await expectApiError(() => getPrintOrder("PF-1201", "a.b.c"), 401);
  });

  it("توکن مربوط به سفارش دیگر → ۴۰۳ (cross-order)", async () => {
    const token = issuePrintToken("PF-9999", { userId: "u", roles: ["admin"] });
    await expectApiError(() => getPrintOrder("PF-1201", token), 403, "این سفارش");
  });

  it("توکن منقضی → ۴۰۱", async () => {
    const expired = signClaims({
      sub: "u",
      oid: "PF-1201",
      roles: ["admin"],
      iat: Date.now() - 10_000,
      exp: Date.now() - 1,
    });
    await expectApiError(() => getPrintOrder("PF-1201", expired), 401, "منقضی");
  });

  it("سفارش ناموجود → ۴۰۴", async () => {
    p.order.findUnique.mockResolvedValue(null);
    const token = issuePrintToken("PF-1201", { userId: "u", roles: ["admin"] });
    await expectApiError(() => getPrintOrder("PF-1201", token), 404, "پیدا نشد");
  });

  it("نقش noMoney در توکن → نسخه  خالی از مبالغ (R-32)", async () => {
    const token = issuePrintToken("PF-1201", { userId: "u-prod", roles: ["production"] });
    const out = await getPrintOrder("PF-1201", token);
    const json = JSON.stringify(out);
    expect(json).not.toContain('"calc"');
    expect(json).not.toContain('"paid"');
    expect(json).not.toContain('"balance"');
    expect(json).not.toContain('"discPct"');
    expect(json).not.toContain('"discAmt"');
    expect(json).not.toContain('"ship"');
    expect(json).not.toContain('"install"');
    expect(json).not.toContain('"price"');
    expect(json).not.toContain('"discount"');
    // اقلام و مقادیر غیرپولی همچنان موجودند
    expect(out.items).toHaveLength(1);
    expect(out.items[0]?.qty).toBe(2);
    if (out.items[0] !== undefined) {
      expect("price" in out.items[0]).toBe(false);
    }
  });

  it("ورودی‌های پولی تاریخچه برای نقش noMoney فیلتر می‌شوند (order.js:606)", async () => {
    // stageLog با note «ثبت پیش‌فاکتور» پولی محسوب می‌شود → حذف
    const token = issuePrintToken("PF-1201", { userId: "u-prod", roles: ["depot"] });
    const out = await getPrintOrder("PF-1201", token);
    expect(out.stageLog).toHaveLength(0);
    // و نسخه کامل همان ورودی را نگه می‌دارد
    const fullToken = issuePrintToken("PF-1201", { userId: "u-fin", roles: ["finance"] });
    const full = await getPrintOrder("PF-1201", fullToken);
    expect(full.stageLog).toHaveLength(1);
  });

  it("نقش پولی → نسخه کامل با calc", async () => {
    const token = issuePrintToken("PF-1201", { userId: "u-fin", roles: ["finance"] });
    const out = await getPrintOrder("PF-1201", token);
    expect("calc" in out).toBe(true);
    expect(out.company).toBeTypeOf("object");
    expect(out.vatRate).toBe(10);
    expect(out.items[0]).toHaveProperty("price", 1_000_000);
  });

  it("تنظیمات شرکت از پایگاه داده خوانده می‌شود", async () => {
    p.setting.findUnique.mockResolvedValue({
      vat: 9,
      company: { name: "بارمان", phone: "021" },
      discountCap: null,
      rate: null,
    });
    const token = issuePrintToken("PF-1201", { userId: "u", roles: ["admin"] });
    const out = await getPrintOrder("PF-1201", token);
    expect(out.vatRate).toBe(9);
    // getSettings مقادیر پایگاه داده را با پیش‌فرض‌ها ادغام می‌کند
    expect(out.company).toMatchObject({ name: "بارمان", phone: "021" });
  });
});
