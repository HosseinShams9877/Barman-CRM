/**
 * آزمون اعتبارسنجی — مرحله ۵ (MIGRATION_STRATEGY §۳.۵).
 *
 * - داده معتبر → بدون رد
 * - خطای اسکما/ارجاع اجباری → رد
 * - ارجاع نرم ناموجود → null + گزارش شفاف
 */
import { describe, expect, it } from "vitest";
import { validateMapped } from "./validate";
import type { MappedData } from "./map";

function baseData(): MappedData {
  return {
    roles: [{ key: "admin", name: "ادمین" }],
    users: [{ id: "u1", name: "ali", title: "", passwordHash: "$2a$10$x", roles: ["admin"], createdAt: 0 }],
    settings: null,
    lists: [],
    suppliers: [{ id: "s1", name: "sup", kind: "raw", phone: "", terms: "", items: [], createdAt: 0 }],
    products: [{ id: "p1", code: "BR-101", name: "p", line: "prod", category: "c", unit: "u", price: 1, active: true, days: 2, supplierId: null, colors: [], createdAt: 0 }],
    bom: [],
    materials: [{ id: "m1", code: "RM-101", name: "m", unit: "کیلو", price: 1, min: 0, createdAt: 0 }],
    accounts: [{ id: "AC-101", name: "a", kind: "customer", active: true, address: "", note: "", createdAt: 0, updatedAt: 0 }],
    phones: [{ id: "ph1", accountId: "AC-101", kind: "", number: "09121234500" }],
    contacts: [{ id: "c0", accountId: "AC-101", name: "نام", role: "", phone: "" }],
    leads: [
      { id: "LD-1001", accountId: "AC-101", line: "prod", stage: "raw", title: "", amount: null, ownerId: "u1", source: "اینستاگرام", note: "", lostReason: null, lostFrom: null, createdAt: 0, updatedAt: 0 },
    ],
    interests: [{ leadId: "LD-1001", productId: "p1" }],
    followups: [{ id: "f1", leadId: "LD-1001", at: 1, kind: "in", result: "", note: "text", nextAt: null, byUserId: "u1" }],
    orders: [
      {
        id: "PF-1201", accountId: "AC-101", contactId: "c0", leadId: "LD-1001", line: "prod", stage: 1, status: "open",
        discPct: 0, discAmt: 0, ship: 0, install: 0, noVat: false, validDays: 3, note: "", preset: "", skipped: [],
        planBuilder: null, backNote: null, smOk: null, mgrOk: null, due: 0, stageAt: 0, times: { 1: 0 }, sent: null,
        prod: null, prep: null, delivered: null, agreed: null, cancelReason: null, ownerId: "u1", createdById: "u1",
        createdAt: 0, updatedAt: 0,
      },
    ],
    items: [{ id: "i1", orderId: "PF-1201", productId: "p1", qty: 2, price: 100, discount: 0, color: "" }],
    payments: [{ id: "p1", orderId: "PF-1201", kind: "cash", amount: 200, date: "1405/08/19", void: false, note: "", byUserId: "u1", createdAt: 0 }],
    cheques: [{ id: "c1", orderId: "PF-1201", sayad: "", amount: 100, due: "1405/09/19", status: "hand", bank: "", owner: "", note: "", createdAt: 0, updatedAt: 0 }],
    stageLogs: [{ id: "s1", orderId: "PF-1201", fromStage: null, toStage: 1, at: 0, byUserId: "u1", note: "ساخته شد", kind: "stage" }],
    handoffs: [{ id: "TR-1201", orderId: "PF-1201", lines: [], at: 0, byUserId: null, note: "" }],
    buys: [{ id: "BY-301", supplierId: "s1", status: "recv", total: 100, note: "", createdBy: "u1", createdAt: 0, updatedAt: 0 }],
    buyItems: [{ id: "bi1", buyId: "BY-301", materialId: "m1", qty: 1, price: 100 }],
    buyCheques: [{ id: "bc1", buyId: "BY-301", amount: 100, due: "1405/09/19", sayad: null, status: "issued" }],
    buyStatusLogs: [{ id: "bs1", buyId: "BY-301", fromStatus: null, toStatus: "req", at: 0, byUserId: "u1", note: "ثبت شد" }],
    jobs: [{ id: "PJ-501", productId: "p1", qty: 10, color: null, end: null, status: "plan", good: null, waste: null, startedAt: null, qcAt: null, recvQty: null, recvAt: null, bomSnapshot: [], createdBy: "u1", createdAt: 0, updatedAt: 0 }],
    moves: [{ id: "mv0", wh: "raw", item: "m1", qty: 5, kind: "open", ref: null, at: 0, byUserId: "u1", note: "" }],
    droppedFields: [],
  };
}

function ids(data: MappedData) {
  return {
    accountIds: new Set(data.accounts.map((a) => a.id)),
    contactIds: new Set(data.contacts.map((c) => c.id)),
    productIds: new Set(data.products.map((p) => p.id)),
    materialIds: new Set(data.materials.map((m) => m.id)),
    supplierIds: new Set(data.suppliers.map((s) => s.id)),
    userIds: new Set(data.users.map((u) => u.id)),
    leadIds: new Set(data.leads.map((l) => l.id)),
    orderIds: new Set(data.orders.map((o) => o.id)),
    buyIds: new Set(data.buys.map((b) => b.id)),
    jobIds: new Set(data.jobs.map((j) => j.id)),
  };
}

describe("مرحله ۵ — داده معتبر", () => {
  it("هیچ ردی تولید نمی‌شود", () => {
    const data = baseData();
    const result = validateMapped(data, ids(data));
    expect(result.rejected).toEqual([]);
    expect(result.referentialIssues).toEqual([]);
  });
});

describe("مرحله ۵ — خطای اسکما", () => {
  it("مرحله نامعتبر سفارش رد می‌شود", () => {
    const data = baseData();
    data.orders[0]!.stage = 12;
    const result = validateMapped(data, ids(data));
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]).toMatchObject({ collection: "orders", id: "PF-1201", step: "validate" });
  });

  it("وضعیت چک نامعتبر رد می‌شود", () => {
    const data = baseData();
    data.cheques[0]!.status = "unknown";
    const result = validateMapped(data, ids(data));
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]!.collection).toBe("order_cheques");
  });

  it("نوع حرکت نامعتبر رد می‌شود", () => {
    const data = baseData();
    data.moves[0]!.kind = "teleport";
    const result = validateMapped(data, ids(data));
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]).toMatchObject({ collection: "moves", id: "mv0" });
  });

  it("تاریخ پرداخت غیرقالب‌دار رد می‌شود", () => {
    const data = baseData();
    data.payments[0]!.date = "۱۴۰۵/۰۸/۱۹";
    const result = validateMapped(data, ids(data));
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]).toMatchObject({ collection: "order_payments" });
  });
});

describe("مرحله ۵ — ارجاعات", () => {
  it("حساب مرجع ناموجود → رد سرنخ", () => {
    const data = baseData();
    data.leads[0]!.accountId = "AC-999";
    const result = validateMapped(data, ids(data));
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]).toMatchObject({ collection: "leads", id: "LD-1001" });
    expect(result.rejected[0]!.reason).toContain("AC-999");
  });

  it("محصول مرجع ناموجود → رد قلم سفارش", () => {
    const data = baseData();
    data.items[0]!.productId = "pX";
    const result = validateMapped(data, ids(data));
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]).toMatchObject({ collection: "order_items", id: "i1" });
  });

  it("کاربر نرم ناموجود (مثل sys) → null + گزارش شفاف", () => {
    const data = baseData();
    data.followups[0]!.byUserId = "sys";
    const result = validateMapped(data, ids(data));
    expect(result.rejected).toEqual([]);
    expect(data.followups[0]!.byUserId).toBeNull();
    expect(result.referentialIssues).toEqual([
      { collection: "lead_followups", id: "LD-1001/f1", ref: "sys", kind: "byUserId/owner" },
    ]);
  });

  it("تأمین‌کننده ناموجود → null + گزارش", () => {
    const data = baseData();
    data.buys[0]!.supplierId = "sX";
    const result = validateMapped(data, ids(data));
    expect(result.rejected).toEqual([]);
    expect(data.buys[0]!.supplierId).toBeNull();
    expect(result.referentialIssues).toHaveLength(1);
  });

  it("شناسه تکراری رد می‌شود", () => {
    const data = baseData();
    data.accounts.push({ ...data.accounts[0]! });
    const result = validateMapped(data, ids(data));
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]!.reason).toContain("تکراری");
  });
});
