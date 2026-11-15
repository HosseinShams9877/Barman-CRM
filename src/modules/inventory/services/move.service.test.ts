/**
 * آزمون‌های سرویس حرکت‌های انبار — PHASE_05 §۱۲ (دروازه خروج ۲).
 *
 * قوانین بحرانی:
 *  - علامت qty بر اساس kind در سرور اعمال می‌شود (core.js:۲۰۶)؛
 *  - خروج دپو بیشتر از موجودی آزاد رد می‌شود (app/stock.js:۶۸)؛
 *  - ویرایش/حذف فقط حرکت‌های دستی open/out/adj (PHASE_05 §۸)؛
 *  - قلم باید در کاتالوگ انبار متناظر وجود داشته باشد.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@core/database/client";

// --- الگوی mock مطابق فاز ۴ ---------------------------------------------

type MoveDoc = {
  id: string;
  wh: string;
  item: string;
  qty: number;
  kind: string;
  ref: string | null;
  at: bigint;
  byUserId: string | null;
  note: string;
};

let moves: MoveDoc[] = [];

function seedMoves() {
  moves = [
    { id: "mv-open1", wh: "raw", item: "m1", qty: 100, kind: "open", ref: null, at: 1000n, byUserId: "u1", note: "موجودی اول دوره" },
    { id: "mv-out1", wh: "depot", item: "p1", qty: -2, kind: "out", ref: null, at: 2000n, byUserId: "u1", note: "خروج" },
    { id: "mv-prod1", wh: "depot", item: "p1", qty: 20, kind: "prod", ref: "PF-1203", at: 3000n, byUserId: null, note: "ورود از تولید" },
    { id: "mv-waste1", wh: "raw", item: "m1", qty: -1, kind: "waste", ref: null, at: 4000n, byUserId: "u1", note: "ضایعات" },
    { id: "mv-adj1", wh: "raw", item: "m2", qty: -3, kind: "adj", ref: null, at: 5000n, byUserId: "u1", note: "اصلاح شمارش" },
  ];
}

vi.mock("@core/database/client", () => ({
  prisma: {
    material: {
      findMany: vi.fn(async () => [
        { id: "m1", name: "گچ", code: "RM-101", unit: "کیلو" },
        { id: "m2", name: "رزین", code: "RM-105", unit: "کیلو" },
      ]),
      findUnique: vi.fn(async (args: { where: { id: string }; select?: unknown }) => {
        const all: any[] = [
          { id: "m1", name: "گچ", code: "RM-101", unit: "کیلو" },
          { id: "m2", name: "رزین", code: "RM-105", unit: "کیلو" },
        ];
        const row = all.find((m) => m.id === args.where.id);
        return args.select && row ? { id: row.id } : row ?? null;
      }),
    },
    product: {
      findMany: vi.fn(async () => [
        { id: "p1", name: "پنل", code: "BR-101", unit: "متر مربع" },
      ]),
      findUnique: vi.fn(async (args: { where: { id: string }; select?: unknown }) => {
        if (args.where.id !== "p1") return null;
        return args.select ? { id: "p1" } : { id: "p1", name: "پنل", code: "BR-101", unit: "متر مربع" };
      }),
      count: vi.fn(async () => 0),
    },
    move: {
      findMany: vi.fn(async (args: any) => {
        let rows = [...moves];
        if (args?.where?.wh) rows = rows.filter((m) => m.wh === args.where.wh);
        if (args?.where?.kind) rows = rows.filter((m) => m.kind === args.where.kind);
        rows.sort((a, b) => Number(b.at) - Number(a.at));
        const skip = args?.skip ?? 0;
        return rows.slice(skip, skip + (args?.take ?? 50));
      }),
      count: vi.fn(async (args: any) => {
        let rows = [...moves];
        if (args?.where?.wh) rows = rows.filter((m) => m.wh === args.where.wh);
        if (args?.where?.kind) rows = rows.filter((m) => m.kind === args.where.kind);
        return rows.length;
      }),
      findUnique: vi.fn(async (args: { where: { id: string } }) =>
        moves.find((m) => m.id === args.where.id) ?? null,
      ),
      create: vi.fn(async (args: { data: Omit<MoveDoc, "id"> & { id: string } }) => {
        const doc: MoveDoc = { ...args.data };
        moves.push(doc);
        return doc;
      }),
      update: vi.fn(async (args: { where: { id: string }; data: Partial<MoveDoc> }) => {
        const doc = moves.find((m) => m.id === args.where.id)!;
        Object.assign(doc, args.data);
        return doc;
      }),
      delete: vi.fn(async (args: { where: { id: string } }) => {
        const doc = moves.find((m) => m.id === args.where.id)!;
        moves = moves.filter((m) => m.id !== args.where.id);
        return doc;
      }),
      groupBy: vi.fn(async () => {
        const buckets = new Map<string, number>();
        for (const m of moves) {
          const k = `${m.wh}|${m.item}`;
          buckets.set(k, (buckets.get(k) ?? 0) + m.qty);
        }
        return [...buckets.entries()].map(([k, qty]) => {
          const [wh, item] = k.split("|");
          return { wh, item, _sum: { qty } };
        });
      }),
    },
    // مورد نیاز برای side-effect.seed که از طریق @core/database اجرا می‌شود
    role: { upsert: vi.fn() },
    user: { findMany: vi.fn(), upsert: vi.fn(), count: vi.fn() },
    setting: { upsert: vi.fn() },
    rev: { upsert: vi.fn() },
    list: { upsert: vi.fn() },
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
  },
}));

const actor = { userId: "u1", roles: ["warehouse"] as never };

import { createMove, deleteMove, getMove, listMoves, updateMove } from "./move.service";

beforeEach(() => {
  seedMoves();
  vi.clearAllMocks();
});

describe("createMove — علامت qty بر اساس kind (core.js:۲۰۶)", () => {
  it("out در raw منفی ذخیره می‌شود", async () => {
    const row = await createMove(
      { wh: "raw", itemId: "m1", qty: 10, kind: "out", note: "خروج دستی" },
      actor,
    );
    expect(row.qty).toBe(-10);
    expect(moves.at(-1)?.qty).toBe(-10);
  });

  it("open مثبت ذخیره می‌شود", async () => {
    const row = await createMove(
      { wh: "raw", itemId: "m1", qty: 50, kind: "open", note: "اول دوره" },
      actor,
    );
    expect(row.qty).toBe(50);
  });

  it("waste در raw منفی ذخیره می‌شود", async () => {
    const row = await createMove(
      { wh: "raw", itemId: "m1", qty: 4, kind: "waste", note: "ضایعات" },
      actor,
    );
    expect(row.qty).toBe(-4);
  });

  it("adj مقدار علامت‌دار مستقیم ذخیره می‌شود", async () => {
    const row = await createMove(
      { wh: "raw", itemId: "m1", qty: -7, kind: "adj", note: "اصلاح" },
      actor,
    );
    expect(row.qty).toBe(-7);
  });

  it("شناسه حرکت با پیشوند mv شروع می‌شود (core.js:۱۱۰)", async () => {
    const row = await createMove(
      { wh: "raw", itemId: "m1", qty: 1, kind: "adj", note: "تست" },
      actor,
    );
    expect(row.id.startsWith("mv")).toBe(true);
  });

  it("byUserId از نشست اجراکننده ثبت می‌شود", async () => {
    await createMove(
      { wh: "raw", itemId: "m1", qty: 1, kind: "adj", note: "تست" },
      actor,
    );
    expect(moves.at(-1)?.byUserId).toBe("u1");
  });

  it("قلم ناموجود در کاتالوگ رد می‌شود", async () => {
    await expect(
      createMove(
        { wh: "raw", itemId: "ghost", qty: 1, kind: "out", note: "x" },
        actor,
      ),
    ).rejects.toThrow(/کاتالوگ/);
  });

  it("قلم محصول در انبار raw رد می‌شود ( کاتالوگ متناظر)", async () => {
    await expect(
      createMove(
        { wh: "raw", itemId: "p1", qty: 1, kind: "out", note: "x" },
        actor,
      ),
    ).rejects.toThrow(/کاتالوگ/);
  });
});

describe("createMove — guard موجودی برای out در دپو (app/stock.js:۶۸)", () => {
  it("out کمتر از موجودی آزاد مجاز است", async () => {
    // موجودی p1: 20 − 2 = 18
    const row = await createMove(
      { wh: "depot", itemId: "p1", qty: 18, kind: "out", note: "خروج" },
      actor,
    );
    expect(row.qty).toBe(-18);
  });

  it("out بیشتر از موجودی آزاد رد می‌شود", async () => {
    await expect(
      createMove(
        { wh: "depot", itemId: "p1", qty: 19, kind: "out", note: "خروج" },
        actor,
      ),
    ).rejects.toThrow(/موجودی آزاد/);
  });

  it("guard فقط برای depot است؛ out در raw بدون موجودی کافی مجاز است", async () => {
    // m1 موجودی 99 دارد ولی raw شامل guard نیست (الگوی Demo — فقط دپو)
    const row = await createMove(
      { wh: "raw", itemId: "m1", qty: 500, kind: "out", note: "خروج" },
      actor,
    );
    expect(row.qty).toBe(-500);
  });
});

describe("updateMove — ویرایش فقط حرکت‌های دستی (PHASE_05 §۸)", () => {
  it("ویرایش حرکت open مجاز است", async () => {
    const row = await updateMove("mv-open1", { qty: 120, note: "اصلاح" }, actor);
    expect(row.qty).toBe(120);
    expect(row.note).toBe("اصلاح");
  });

  it("ویرایش حرکت adj مقدار علامت‌دار می‌پذیرد", async () => {
    const row = await updateMove("mv-adj1", { qty: 5 }, actor);
    expect(row.qty).toBe(5);
  });

  it("ویرایش حرکت سیستمی prod رد می‌شود", async () => {
    await expect(updateMove("mv-prod1", { note: "x" }, actor)).rejects.toThrow(
      /سیستمی/,
    );
  });

  it("ویرایش حرکت دستی waste رد می‌شود (فقط open/out/adj)", async () => {
    await expect(updateMove("mv-waste1", { note: "x" }, actor)).rejects.toThrow(
      /سیستمی|قابل ویرایش/,
    );
  });

  it("qty غیرمثبت برای open رد می‌شود", async () => {
    await expect(updateMove("mv-open1", { qty: 0 }, actor)).rejects.toThrow(
      /بیشتر از صفر/,
    );
  });

  it("حرکت open ناموجود → notFound", async () => {
    await expect(updateMove("mv-ghost", { note: "x" }, actor)).rejects.toThrow();
  });

  it("ویرایش out با qty بیشتر از موجودی آزاد رد می‌شود", async () => {
    // mv-out1 qty −2؛ موجودی p1 = 18؛ حذف این حرکت از محاسبه → 20 آزاد
    await expect(
      updateMove("mv-out1", { qty: 25 }, actor),
    ).rejects.toThrow(/موجودی آزاد/);
    await expect(updateMove("mv-out1", { qty: 20 }, actor)).resolves.toBeTruthy();
  });
});

describe("deleteMove — حذف فقط حرکت‌های دستی", () => {
  it("حذف حرکت open مجاز است", async () => {
    await deleteMove("mv-open1");
    expect(moves.find((m) => m.id === "mv-open1")).toBeUndefined();
  });

  it("حذف حرکت سیستمی prod رد می‌شود", async () => {
    await expect(deleteMove("mv-prod1")).rejects.toThrow(/سیستمی/);
  });

  it("حذف حرکت waste رد می‌شود", async () => {
    await expect(deleteMove("mv-waste1")).rejects.toThrow();
  });
});

describe("listMoves — فیلتر و جستجو", () => {
  it("لیست همه حرکت‌ها با صفحه‌بندی", async () => {
    const result = await listMoves({ wh: null, kind: null, q: "", page: 1, pageSize: 50 });
    expect(result.items).toHaveLength(5);
    expect(result.total).toBe(5);
  });

  it("فیلتر انبار و kind اعمال می‌شود", async () => {
    const raws = await listMoves({ wh: "raw", kind: null, q: "", page: 1, pageSize: 50 });
    expect(raws.items.every((m) => m.wh === "raw")).toBe(true);
    const prods = await listMoves({ wh: null, kind: "prod", q: "", page: 1, pageSize: 50 });
    expect(prods.items).toHaveLength(1);
    expect(prods.items[0]!.ref).toBe("PF-1203");
  });

  it("جستجو روی نام قلم اعمال می‌شود", async () => {
    const result = await listMoves({ wh: null, kind: null, q: "گچ", page: 1, pageSize: 50 });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((m) => m.itemName.includes("گچ"))).toBe(true);
  });

  it("نام/کد/واحد قلم از کاتالوگ پر می‌شود", async () => {
    const result = await listMoves({ wh: null, kind: null, q: "", page: 1, pageSize: 50 });
    const m1 = result.items.find((m) => m.itemId === "m1");
    expect(m1?.itemName).toBe("گچ");
    expect(m1?.itemCode).toBe("RM-101");
    expect(m1?.unit).toBe("کیلو");
  });
});

describe("getMove — خواندن یک حرکت", () => {
  it("حرکت موجود برمی‌گردد", async () => {
    const row = await getMove("mv-open1");
    expect(row.itemId).toBe("m1");
    expect(row.qty).toBe(100);
  });

  it("حرکت ناموجود notFound", async () => {
    await expect(getMove("mv-ghost")).rejects.toThrow();
  });
});
