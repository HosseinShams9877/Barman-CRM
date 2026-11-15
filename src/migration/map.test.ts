/**
 * آزمون نقشه‌گذاری موجودیت‌ها — مرحله ۲/۴ (MIGRATION_STRATEGY §۳.۲/§۳.۴).
 *
 * اسناد نمونه کوتاه (نه کل Demo) — هر تصمیم نگاشت یک آزمون دارد.
 */
import { describe, expect, it } from "vitest";
import { mapEntities, mapMeta, INITIAL_PASSWORD, DEMO_USERS_FALLBACK } from "./map";

const DOCS = {
  accounts: [
    {
      id: "AC-101",
      name: "شرکت نمونه",
      kind: "company",
      city: "تهران",
      phones: ["09121234501"],
      created: 1791022005345,
      src: "اینستاگرام",
      owner: "u5",
      contacts: [{ id: "c0", name: "مهندس رستمی", role: "مدیرعامل", phone: "09121234501" }],
    },
    { id: "AC-201", name: "", kind: "unknown", phones: ["09121119901"], created: 1793527605345 },
  ],
  leads: [
    {
      id: "LD-1001",
      acct: "AC-201",
      line: "prod",
      stage: "raw",
      owner: "u5",
      src: "اینستاگرام",
      created: 1793614005345,
      updated: 1794046005345,
      interest: ["p1", "p2"],
      area: 120,
      value: 0,
      prob: 50,
      project: "مسکونی",
      next: { t: 1794046005345, what: "تماس و شناسایی" },
      note: "تماس ورودی",
      hist: [{ id: "h1", t: 1793614005345, who: "u5", kind: "in", text: "ورود سرنخ", result: "" }],
      tries: 2,
    },
  ],
  orders: [
    {
      id: "PF-1201",
      created: 1791799605345,
      owner: "u5",
      acct: "AC-101",
      contact: "c0",
      lead: "",
      line: "prod",
      items: [{ pid: "p13", qty: 60, price: 1800000, color: "طوسی روشن" }],
      discPct: 5,
      plan: [{ kind: "cash", amount: 100, due: 1791799605345 }],
      receipts: [
        { id: "r1", kind: "cash", amount: 78900000, t: 1791889605345, ref: "فیش ۷۳۴", by: "u3" },
        { id: "r2", kind: "cheque", amount: 78950000, t: 1791889605345, by: "u3", chq: { sayad: "1234567890131807", bank: "ملت", due: 1794391605345, status: "hand" } },
      ],
      log: [
        { t: 1791799605345, who: "u5", text: "پیش‌فاکتور ساخته شد" },
        { t: 1791911205345, who: "u3", text: "پرداخت تأیید و سفارش قطعی شد" },
      ],
      times: { 1: 1791799605345, 6: 1791911205345 },
      stage: 6,
      stageAt: 1791911205345,
      due: 1792192005345,
      sentVia: ["پیامک (لینک PDF)"],
      sentAt: 1791886005345,
      closed: true,
      prod: {
        start: 1791997605345,
        end: 1792256805345,
        acceptedAt: 1791911205345,
        qc: { t: 1791954405345, good: { p13: 60 }, waste: { p13: 0 } },
        handoff: { id: "TR-1201", t: 1791954405345, lines: [{ pid: "p13", qty: 60 }], recv: { t: 1791976005345, by: "u8" } },
      },
      smOk: { by: "u4", t: 1791821205345 },
    },
    {
      id: "PF-1212",
      created: 1794046132566,
      owner: "u5",
      acct: "",
      line: "prod",
      items: [],
      times: { 1: 1794046132566 },
      log: [{ t: 1794046132566, who: "u5", text: "پیش‌فاکتور تازه ساخته شد" }],
      stage: 1,
      stageAt: 1794046132566,
      due: 1794060532566,
      prepAt: 1794046132566,
    },
  ],
  buys: [
    {
      id: "BY-301",
      kind: "raw",
      sup: "s1",
      created: 1792318005345,
      by: "u1",
      lines: [{ item: "m1", qty: 3000, price: 9000 }],
      pay: { method: "cash", note: "" },
      status: "done",
      log: [
        { t: 1792318005345, who: "u1", text: "سند خرید ثبت شد" },
        { t: 1792361205345, who: "u3", text: "مالی پرداخت کرد و رسید برای تأمین‌کننده ارسال شد" },
      ],
      payments: [{ id: "bp1", kind: "cheque", amount: 27000000, t: 1792361205345, chq: { due: 1794949205345, status: "issued" } }],
    },
    {
      id: "BY-303",
      kind: "agency",
      sup: "s5",
      created: 1793786805345,
      by: "u1",
      lines: [{ item: "a1", qty: 200, price: 520000 }],
      status: "wait",
      log: [{ t: 1793786805345, who: "u1", text: "سند خرید ثبت شد" }],
      payments: [],
    },
  ],
  jobs: [
    {
      id: "PJ-501",
      pid: "p4",
      qty: 100,
      color: "سفید",
      end: 1794385800000,
      status: "sent",
      created: 1794157993643,
      by: "u1",
      startedAt: 1794158261369,
      good: 100,
      waste: 0,
      qcAt: 1794158266174,
    },
  ],
  moves: [
    { id: "mv0", wh: "raw", item: "m1", qty: 3500, kind: "open", ref: "", t: 1790590005345, by: "u7", note: "موجودی اول دوره" },
    { id: "mv5", wh: "depot", item: "p4", qty: -60, kind: "sale", ref: "PF-1201", t: 1792022805345 },
  ],
};

describe("mapMeta — مرحله ۲", () => {
  it("کاربران: meta.users خالی → fallback USERS0 (core.js:122-131)", () => {
    const { users } = mapMeta({ v: 1 });
    expect(users).toHaveLength(8);
    expect(users[0]).toMatchObject({ id: "u1", name: "امیرعلی رحیمی" });
    expect(users[7]).toMatchObject({ id: "u8", roles: ["depot"] });
  });

  it("نقش‌ها: ۷ نقش ثابت با برچسب فارسی", () => {
    const { roles } = mapMeta({});
    expect(roles.map((r) => r.key)).toEqual(["management", "admin", "finance", "salesManager", "sales", "production", "depot"]);
  });

  it("رمز اولیه bcrypt — reset هماهنگ (MIGRATION_STRATEGY §۴)", () => {
    const { users } = mapMeta({});
    for (const u of users) {
      expect(u.passwordHash).toMatch(/^\$2/);
    }
    expect(INITIAL_PASSWORD).toBe("barman1405");
    expect(DEMO_USERS_FALLBACK).toHaveLength(8);
  });

  it("کاتالوگ: محصولات/مواد/تأمین‌کننده‌ها/BOM", () => {
    const { products, materials, suppliers, bom } = mapMeta({
      cat: {
        products: [
          { id: "p1", code: "BR-101", name: "پنل", line: "prod", cat: "پنل", unit: "مترمربع", price: 1000000, days: 2, bom: [{ m: "m1", q: 8.1 }] },
          { id: "a1", code: "AG-201", name: "PVC", line: "agency", cat: "PVC", unit: "مترمربع", price: 690000, sup: "s5" },
        ],
        materials: [{ id: "m1", code: "RM-101", name: "گچ", unit: "کیلو", price: 9000, min: 2500 }],
        suppliers: [{ id: "s5", name: "دکوپلاست", kind: "agency", phone: "0912", terms: "چک ۴۵ روزه", items: ["a1"] }],
      },
      lists: { sources: ["اینستاگرام"] },
      settings: { vat: 10, validDays: 3, rate: 3 },
    });
    expect(products).toHaveLength(2);
    expect(products[1]).toMatchObject({ supplierId: "s5" });
    expect(products[0]).toMatchObject({ supplierId: null, days: 2 });
    expect(materials[0]).toMatchObject({ min: 2500 });
    expect(suppliers[0]).toMatchObject({ kind: "agency" });
    expect(bom).toEqual([{ productId: "p1", materialId: "m1", qty: 8.1 }]);
  });

  it("BOM با ماده ناموجود → گزارش فیلد رهاشده", () => {
    const { bom, droppedFields } = mapMeta({
      cat: {
        products: [{ id: "p1", code: "BR-101", name: "x", line: "prod", cat: "c", unit: "u", price: 1, bom: [{ m: "mX", q: 1 }] }],
        materials: [],
        suppliers: [],
      },
    });
    expect(bom).toEqual([]);
    expect(droppedFields).toHaveLength(1);
  });

  it("تنظیمات: rate بدون اختراع قانون منتقل می‌شود (Q-01)", () => {
    const { settings } = mapMeta({ settings: { vat: 10, rate: 3 } });
    expect(settings).toMatchObject({ vat: 10, rate: 3 });
  });
});

describe("mapEntities — مرحله ۴: accounts", () => {
  const { data, rejected } = mapEntities(DOCS);

  it("company → customer (taxonomy هدف)", () => {
    expect(data.accounts[0]).toMatchObject({ id: "AC-101", kind: "customer", name: "شرکت نمونه" });
    expect(data.accounts[1]).toMatchObject({ id: "AC-201", kind: "unknown", name: "" });
  });

  it("تلفن‌ها و مخاطبین → جداول جدا", () => {
    expect(data.phones).toHaveLength(2);
    expect(data.phones[0]).toEqual({ id: "AC-101-ph-0", accountId: "AC-101", kind: "", number: "09121234501" });
    expect(data.contacts).toHaveLength(1);
    expect(data.contacts[0]).toMatchObject({ id: "c0", accountId: "AC-101", name: "مهندس رستمی" });
  });

  it("فیلدهای بدون مدل (city/src/owner) گزارش می‌شوند", () => {
    const drop = data.droppedFields.find((d) => d.collection === "accounts" && d.id === "AC-101");
    expect(drop?.fields).toEqual(expect.arrayContaining(["city", "src", "owner"]));
  });

  it("هیچ حسابی رد نشده", () => {
    expect(rejected.filter((r) => r.collection === "accounts")).toEqual([]);
  });
});

describe("mapEntities — مرحله ۴: leads", () => {
  const { data } = mapEntities(DOCS);

  it("value=0 → amount null (نامشخص)", () => {
    expect(data.leads[0]).toMatchObject({ amount: null, title: "مسکونی", source: "اینستاگرام", stage: "raw" });
  });

  it("interest → LeadInterest", () => {
    expect(data.interests).toEqual([
      { leadId: "LD-1001", productId: "p1" },
      { leadId: "LD-1001", productId: "p2" },
    ]);
  });

  it("hist → followup با kind یکسان", () => {
    expect(data.followups[0]).toMatchObject({ id: "h1", leadId: "LD-1001", kind: "in", byUserId: "u5" });
  });

  it("next → یک رویداد پیگیری با nextAt (YYYY/MM/DD)", () => {
    const next = data.followups.find((f) => f.nextAt !== null);
    expect(next).toBeDefined();
    expect(next?.nextAt).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    expect(next?.note).toBe("تماس و شناسایی");
  });

  it("فیلدهای area/prob/tries/srcNote گزارش می‌شوند", () => {
    const drop = data.droppedFields.find((d) => d.collection === "leads" && d.id === "LD-1001");
    expect(drop?.fields).toEqual(expect.arrayContaining(["area", "prob", "tries"]));
  });
});

describe("mapEntities — مرحله ۴: orders", () => {
  const { data } = mapEntities(DOCS);

  it("اقلام → OrderItem بدون تخفیف قلم", () => {
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({ orderId: "PF-1201", productId: "p13", qty: 60, price: 1800000, discount: 0 });
  });

  it("رسید نقد → OrderPayment با تاریخ خالص", () => {
    expect(data.payments).toHaveLength(1);
    expect(data.payments[0]).toMatchObject({ kind: "cash", amount: 78900000, byUserId: "u3" });
    expect(data.payments[0]!.date).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });

  it("رسید چک → OrderCheque با سررسید و وضعیت", () => {
    expect(data.cheques).toHaveLength(1);
    expect(data.cheques[0]).toMatchObject({ sayad: "1234567890131807", status: "hand", bank: "ملت" });
    expect(data.cheques[0]!.due).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });

  it("وضعیت: closed → done", () => {
    expect(data.orders[0]).toMatchObject({ status: "done", stage: 6, discPct: 5 });
    expect(data.orders[1]).toMatchObject({ status: "open", accountId: null, contactId: null, leadId: null });
  });

  it("sent → {via, at}", () => {
    expect(data.orders[0]!.sent).toMatchObject({ via: "پیامک (لینک PDF)" });
  });

  it("log → OrderStageLog با fromStage/toStage از times", () => {
    expect(data.stageLogs).toHaveLength(3);
    const first = data.stageLogs[0]!;
    expect(first).toMatchObject({ toStage: 1, fromStage: null, kind: "stage", note: "پیش‌فاکتور ساخته شد" });
    const second = data.stageLogs[1]!;
    // پرش از مرحله ۱ به ۶ (زمان‌های times)
    expect(second).toMatchObject({ fromStage: 1, toStage: 6, kind: "skip" });
  });

  it("prod.handoff → OrderHandoff با شناسه TR- اصلی (R-12)", () => {
    expect(data.handoffs).toHaveLength(1);
    expect(data.handoffs[0]).toMatchObject({ id: "TR-1201", orderId: "PF-1201", byUserId: "u8" });
    expect(data.handoffs[0]!.lines).toEqual([{ productId: "p13", qty: 60, color: "طوسی روشن" }]);
  });

  it("prod → شکل هدف (start/end تاریخ خالص، qc عددی)", () => {
    const prod = data.orders[0]!.prod as { start: string; end: string; qc: { good: number; waste: number } };
    expect(prod.start).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    expect(prod.end).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    expect(prod.qc).toEqual({ good: 60, waste: 0, why: "" });
  });

  it("prepAt به‌تنهایی → prep با t (PF-1201 دمو)", () => {
    expect(data.orders[1]!.prep).toMatchObject({ t: 1794046132566, packs: 0 });
  });

  it("plan (برنامه پرداخت) گزارش می‌شود — فقط رسیدها منتقل می‌شوند", () => {
    const drop = data.droppedFields.find((d) => d.collection === "orders" && d.id === "PF-1201");
    expect(drop?.fields).toEqual(expect.arrayContaining(["plan (برنامه پرداخت — رسیدها منتقل می‌شوند)"]));
  });
});

describe("mapEntities — مرحله ۴: buys", () => {
  const { data, rejected } = mapEntities(DOCS);

  it("خرید آژانسی رد می‌شود (BuyItem فقط مواد خام)", () => {
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ collection: "buys", id: "BY-303", step: "map" });
    expect(rejected[0]!.reason).toContain("آژانسی");
  });

  it("وضعیت done → recv", () => {
    expect(data.buys).toHaveLength(1);
    expect(data.buys[0]).toMatchObject({ id: "BY-301", status: "recv", supplierId: "s1", total: 27000000 });
  });

  it("چک خرید → BuyCheque با سررسید", () => {
    expect(data.buyCheques).toHaveLength(1);
    expect(data.buyCheques[0]).toMatchObject({ amount: 27000000, status: "issued" });
    expect(data.buyCheques[0]!.due).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });

  it("statusLog: آخرین ورقی به وضعیت نهایی تصحیح می‌شود", () => {
    expect(data.buyStatusLogs).toHaveLength(2);
    expect(data.buyStatusLogs[0]).toMatchObject({ fromStatus: null, toStatus: "req" });
    // متن log برای «مالی پرداخت کرد» fin می‌دهد ولی وضعیت نهایی recv است.
    expect(data.buyStatusLogs[1]).toMatchObject({ fromStatus: "req", toStatus: "recv" });
  });

  it("پرداخت نقدی خرید → گزارش فیلد (مدل هدف ندارد)", () => {
    const drop = data.droppedFields.find((d) => d.collection === "buys" && d.id === "BY-301");
    expect(drop).toBeDefined();
  });
});

describe("mapEntities — مرحله ۴: jobs/moves", () => {
  it("job با BOM محصول → bomSnapshot محاسبه‌شده", () => {
    const { data } = mapEntities(DOCS, {
      products: [{ id: "p4", code: "BR", name: "x", line: "prod", category: "c", unit: "u", price: 1, active: true, days: 2, supplierId: null, colors: [], createdAt: 0 }],
      materials: [{ id: "m1", code: "RM-101", name: "گچ", unit: "کیلو", price: 9, min: 0, createdAt: 0 }],
      bom: [{ productId: "p4", materialId: "m1", qty: 9.81 }],
    });
    expect(data.jobs).toHaveLength(1);
    const snapshot = data.jobs[0]!.bomSnapshot as Array<{ materialId: string; qty: number }>;
    expect(snapshot).toEqual([{ materialId: "m1", code: "RM-101", name: "گچ", unit: "کیلو", qty: 981, total: 981 }]);
  });

  it("moves مستقیم — ref خالی → null", () => {
    const { data } = mapEntities(DOCS);
    expect(data.moves).toHaveLength(2);
    expect(data.moves[0]).toMatchObject({ ref: null, wh: "raw", byUserId: "u7" });
    expect(data.moves[1]).toMatchObject({ ref: "PF-1201", byUserId: null });
  });
});
