/**
 * آزمون‌های سرویس موجودی — PHASE_05 §۱۲ (دروازه خروج ۲).
 *
 * قوانین بحرانی (CD-08 — moves تنها منبع حقیقت موجودی):
 *  - onHand جمع جبری qty حرکت‌هاست (app/core.js:۲۰۶)؛
 *  - فیلد موجودی ذخیره‌شده وجود ندارد؛
 *  - freeQty = max(0, onHand − reserved) (core.js:۲۰۸)؛
 *  - آستانه min: m.min > 0 && h < min (app/stock.js:۲۷)؛
 *  - noMoney (R-32):hideMoney فیلتر price/value را حذف می‌کند.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@core/database/client";
import {
  checkReservations,
  computeOnHand,
  freeQtyOf,
  getStock,
  getStockAlerts,
  reservedQty,
} from "./stock.service";

// --- الگوی mock مطابق فاز ۴ (payment.service.test.ts) -------------------

type MoveRow = { wh: string; item: string; qty: number; at: number };
let moves: MoveRow[] = [];

const tx = {
  move: {
    create: vi.fn(async (args: { data: MoveRow }) => {
      moves.push(args.data);
      return args.data;
    }),
  },
};
vi.mock("@core/database/client", () => ({
  prisma: {
    material: {
      findMany: vi.fn(async () => [
        { id: "m1", name: "گچ", code: "RM-101", unit: "کیلو", price: 9000, min: 100 },
        { id: "m2", name: "رزین", code: "RM-105", unit: "کیلو", price: 185000, min: 0 },
        { id: "m3", name: "سیلر", code: "RM-116", unit: "لیتر", price: 240000, min: 50 },
      ]),
    },
    product: {
      findMany: vi.fn(async () => [
        { id: "p1", name: "پنل", code: "BR-101", unit: "متر مربع", price: 1000000, min: 0 },
      ]),
      // مورد نیاز برای side-effect.seed
      count: vi.fn(async () => 0),
    },
    move: {
      groupBy: vi.fn(async (args: any) => {
        const src = args?.where ? moves.filter((m) => matchWhere(m, args.where)) : moves;
        const by = args.by as string[];
        const buckets = new Map<string, number>();
        for (const m of src) {
          const k = by.map((f) => (m as any)[f]).join("|");
          buckets.set(k, (buckets.get(k) ?? 0) + m.qty);
        }
        return [...buckets.entries()].map(([k, qty]) => {
          const vals = k.split("|");
          const row: Record<string, unknown> = { _sum: { qty } };
          by.forEach((f, i) => (row[f] = vals[i]));
          return row;
        });
      }),
    },
    $transaction: vi.fn(async (cb: any) => cb(tx)),
    // مورد نیاز برای side-effect.seed که از طریق @core/database اجرا می‌شود
    role: { upsert: vi.fn() },
    user: { findMany: vi.fn(), upsert: vi.fn() },
    setting: { upsert: vi.fn() },
    rev: { upsert: vi.fn() },
    list: { upsert: vi.fn() },
    $disconnect: vi.fn(),
  },
}));

function matchWhere(m: MoveRow, where: any): boolean {
  if (where.wh && m.wh !== where.wh) return false;
  if (where.qty?.lt !== undefined && !(m.qty < where.qty.lt)) return false;
  if (where.at?.gt !== undefined && !(m.at > where.at.gt)) return false;
  return true;
}

function seedMoves() {
  const now = Date.now();
  moves = [
    { wh: "raw", item: "m1", qty: 100, at: now - 40 * 86400000 }, // open
    { wh: "raw", item: "m1", qty: -30, at: now - 10 * 86400000 }, // use اخیر
    { wh: "raw", item: "m1", qty: -5, at: now - 60 * 86400000 }, // use قدیمی
    { wh: "raw", item: "m2", qty: 50, at: now - 5 * 86400000 },
    { wh: "raw", item: "m3", qty: 60, at: now - 4 * 86400000 }, // بالای min
    { wh: "depot", item: "p1", qty: 20, at: now - 3 * 86400000 },
    { wh: "depot", item: "p1", qty: -4, at: now - 2 * 86400000 },
  ];
}

beforeEach(() => {
  seedMoves();
  vi.clearAllMocks();
});

describe("computeOnHand — جمع جبری qty (core.js:۲۰۶)", () => {
  it("موجودی هر قلم جمع جبری حرکت‌هاست", async () => {
    const onHand = await computeOnHand();
    expect(onHand["raw|m1"]).toBe(65); // 100 − 30 − 5
    expect(onHand["raw|m2"]).toBe(50);
    expect(onHand["depot|p1"]).toBe(16); // 20 − 4
  });

  it("قلم بدون حرکت در نقشه نیست (پیش‌فرض صفر در نمایش)", async () => {
    const onHand = await computeOnHand();
    expect(onHand["raw|m99"]).toBeUndefined();
  });
});

describe("freeQtyOf / reservedQty — موجودی آزاد (core.js:۲۰۸)", () => {
  it("freeQty موجودی منهای رزرو است", () => {
    expect(freeQtyOf(65, 0)).toBe(65);
    expect(freeQtyOf(65, 20)).toBe(45);
  });

  it("freeQty هرگز منفی نمی‌شود", () => {
    expect(freeQtyOf(5, 20)).toBe(0);
  });

  it("رزرو در فاز ۵ صفر است (Q-04 معوق)", () => {
    expect(reservedQty("p1")).toBe(0);
    expect(reservedQty("p1", "PF-1201")).toBe(0);
  });
});

describe("getStock — موجودی همه اقلام + noMoney (R-32)", () => {
  it("ردیف هر ماده و محصول با موجودی محاسبه‌شده برمی‌گردد", async () => {
    const rows = (await getStock(false)) as Awaited<ReturnType<typeof getStock>>;
    const m1 = (rows as any[]).find((r) => r.itemId === "m1");
    expect(m1.onHand).toBe(65);
    expect(m1.wh).toBe("raw");
    expect(m1.free).toBe(65);
    const p1 = (rows as any[]).find((r) => r.itemId === "p1");
    expect(p1.onHand).toBe(16);
    expect(p1.wh).toBe("depot");
  });

  it("مصرف ۳۰ روز فقط حرکت‌های اخیر منفی raw را می‌شمارد", async () => {
    const rows = (await getStock(false)) as any[];
    const m1 = rows.find((r) => r.itemId === "m1");
    expect(m1.used30).toBe(30); // فقط use اخیر، use قدیمی نه
  });

  it(" value = onHand × price برای نقش‌های دارای مجوز_money", async () => {
    const rows = (await getStock(false)) as any[];
    const m1 = rows.find((r) => r.itemId === "m1");
    expect(m1.price).toBe(9000);
    expect(m1.value).toBe(65 * 9000);
  });

  it("hideMoney فیلدهای پولی را حذف می‌کند (R-32/noMoney)", async () => {
    const rows = (await getStock(true)) as any[];
    const m1 = rows.find((r) => r.itemId === "m1");
    expect(m1).toBeDefined();
    expect("price" in m1).toBe(false);
    expect("value" in m1).toBe(false);
    // فیلدهای غیر پولی حفظ می‌شوند
    expect(m1.onHand).toBe(65);
    expect(m1.name).toBe("گچ");
  });
});

describe("getStockAlerts — آستانه min (app/stock.js:۲۷)", () => {
  it("ماده زیر آستانه با shortfall گزارش می‌شود", async () => {
    const alerts = await getStockAlerts();
    // m1: onHand 65 < min 100 → هشدار؛ m2/m3: min 0 یا موجودی کافی
    const m1 = alerts.find((a) => a.itemId === "m1");
    expect(m1).toBeDefined();
    expect(m1!.shortfall).toBe(35);
  });

  it("مواد با موجودی کافی یا min صفر گزارش نمی‌شوند", async () => {
    const alerts = await getStockAlerts();
    expect(alerts.find((a) => a.itemId === "m2")).toBeUndefined();
    expect(alerts.find((a) => a.itemId === "m3")).toBeUndefined();
  });

  it("محصولات دپو بررسی نمی‌شوند (فقط مواد raw)", async () => {
    const alerts = await getStockAlerts();
    expect(alerts.find((a) => a.itemId === "p1")).toBeUndefined();
  });
});

describe("checkReservations — guard موجودی آزاد (PHASE_05 §۳.۹)", () => {
  it("qty ≤ free → ok", async () => {
    const result = await checkReservations([{ productId: "p1", qty: 16 }]);
    expect(result.ok).toBe(true);
    expect(result.items[0]!.free).toBe(16);
  });

  it("qty > free → غیر مجاز", async () => {
    const result = await checkReservations([{ productId: "p1", qty: 17 }]);
    expect(result.ok).toBe(false);
    expect(result.items[0]!.ok).toBe(false);
  });

  it("محصول بدون موجودی → هر qty مثبت غیر مجاز است", async () => {
    const result = await checkReservations([{ productId: "ghost", qty: 1 }]);
    expect(result.ok).toBe(false);
  });

  it("یک قلم نامجاز کل نتیجه را نامجاز می‌کند", async () => {
    const result = await checkReservations([
      { productId: "p1", qty: 1 },
      { productId: "ghost", qty: 1 },
    ]);
    expect(result.ok).toBe(false);
    expect(result.items).toHaveLength(2);
  });
});

describe("moves تنها منبع حقیقت — بدون فیلد ذخیره‌شده", () => {
  it("هیچ مدل موجودی در Prisma وجود ندارد (بررسی schema)", async () => {
    // خواندن schema.prisma و بررسی نبود مدل Stock/Inventory
    const fs = await import("node:fs");
    const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");
    expect(/\bmodel\s+Stock\b/.test(schema)).toBe(false);
    expect(/\bmodel\s+Inventory\b/.test(schema)).toBe(false);
    expect(/\bmodel\s+StockItem\b/.test(schema)).toBe(false);
    //.moves موجود است
    expect(/\bmodel\s+Move\b/.test(schema)).toBe(true);
    // هیچ فیلد qty ذخیره‌شده روی ماده/محصول نیست
    const materialBlock = schema.match(/model Material \{[^}]+\}/s);
    expect(materialBlock).toBeTruthy();
    expect(materialBlock![0]).not.toMatch(/\bstockQty\b|\bqty\b|\bonHand\b/);
  });
});
