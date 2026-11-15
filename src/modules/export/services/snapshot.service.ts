/**
 * سازنده snapshot کامل داده — معادل ساختار `data/` در Demo
 * (server/export.js:38-46) برای خروجی ZIP (PHASE_07 §۵ / دروازه خروج ۷).
 *
 * ساختار: `meta` (تنظیمات، فهرست‌ها، نقش‌ها، کاربران، کاتالوگ) +
 * `orders` (سفارش با اقلام/پرداخت/چک) + `docs` (مجموعه‌های مستند) +
 * `seq` (شمارنده‌های شناسه). آماده برای تست مهاجرت معکوس در فاز ۸.
 */
import { prisma } from "@core/database/client";
import type { LeadCsvRow } from "./csv";

/** snapshot کامل — معادل آرگومان `zipOf` در Demo (server/export.js:39). */
export type Snapshot = {
  meta: Record<string, unknown>;
  orders: Record<string, unknown>[];
  docs: Record<string, Record<string, unknown>[]>;
  seq: { kind: string; n: number }[];
};

/** پیشوندهای شناسه Demo — core.js:364 SEQ0. */
const ID_PREFIXES = ["PF", "LD", "AC", "BY", "PJ", "MV"] as const;

/**
 * سطرهای داده CSV سرنخ‌ها — تجمیع سمت سرور برای `leadsCsv`.
 *
 * تاریخ پیگیری بعدی و آخرین نتیجه از `lead_followup` خوانده می‌شوند
 * (جدول پیگیری فاز ۳ — معادل hist[] در Demo).
 */
export async function leadsCsvRows(): Promise<LeadCsvRow[]> {
  const leads = await prisma.lead.findMany({
    include: {
      account: { include: { phones: true, contacts: true } },
      owner: { select: { name: true } },
      interest: { include: { product: { select: { name: true } } } },
      orders: { select: { id: true } },
      followups: { orderBy: [{ at: "asc" }] },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  return leads.map((lead) => {
    const next = [...lead.followups].reverse().find((f) => f.nextAt !== null);
    const lastResult = [...lead.followups].reverse().find((f) => f.result !== "")?.result ?? "";
    const callCount = lead.followups.filter((f) => f.kind === "call").length;

    return {
      id: lead.id,
      accountName: lead.account?.name ?? "",
      accountKind: lead.account?.kind ?? "unknown",
      accountCity: "",
      phones: lead.account?.phones.map((p) => p.number) ?? [],
      contacts:
        lead.account?.contacts.map((c) => ({
          name: c.name,
          role: c.role,
          phone: c.phone,
        })) ?? [],
      line: lead.line,
      stage: lead.stage,
      ownerName: lead.owner?.name ?? "",
      source: lead.source,
      interest: lead.interest.map((i) => i.product.name),
      amount: lead.amount,
      nextAt: next?.nextAt ?? null,
      nextSubject: next?.note ?? null,
      callCount,
      lastResult,
      lostReason: lead.lostReason,
      note: lead.note,
      orderIds: lead.orders.map((o) => o.id),
      createdAt: Number(lead.createdAt),
      updatedAt: Number(lead.updatedAt),
    };
  });
}

/**
 * ساخت snapshot از همه داده برنامه.
 *
 * همه تاریخ‌ها به UTC ms (CD-07) باقی می‌مانند — تبدیل در زمان نیاز.
 */
export async function buildSnapshot(): Promise<Snapshot> {
  const [
    users,
    roles,
    settings,
    lists,
    products,
    materials,
    suppliers,
    accounts,
    leads,
    orders,
    jobs,
    moves,
    buys,
    txns,
  ] = await Promise.all([
    prisma.user.findMany({ include: { roles: { select: { roleKey: true } } } }),
    prisma.role.findMany(),
    prisma.setting.findMany(),
    prisma.list.findMany(),
    prisma.product.findMany({ include: { bom: true } }),
    prisma.material.findMany(),
    prisma.supplier.findMany(),
    prisma.account.findMany({ include: { phones: true, contacts: true } }),
    prisma.lead.findMany({ include: { interest: { include: { product: true } }, orders: true } }),
    prisma.order.findMany({
      include: { items: true, payments: true, cheques: true, stageLog: true },
    }),
    prisma.job.findMany(),
    prisma.move.findMany(),
    prisma.buy.findMany({ include: { items: true, cheques: true, statusLog: true } }),
    prisma.txn.findMany(),
  ]);

  const docs: Snapshot["docs"] = {
    accounts: accounts as unknown as Record<string, unknown>[],
    leads: leads as unknown as Record<string, unknown>[],
    jobs: jobs as unknown as Record<string, unknown>[],
    moves: moves as unknown as Record<string, unknown>[],
    buys: buys as unknown as Record<string, unknown>[],
    txns: txns as unknown as Record<string, unknown>[],
  };

  return jsonify({
    meta: {
      settings: settings,
      roles,
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        title: u.title,
        off: u.off,
        role: u.roles[0]?.roleKey ?? "",
      })),
      lists: Object.fromEntries(lists.map((l) => [l.key, l.items])),
      cat: {
        products: products.map((p) => ({
          ...p,
          bom: p.bom.map((b) => ({ m: b.materialId, q: b.qty })),
        })),
        materials,
        suppliers,
      },
    },
    orders: orders as unknown as Record<string, unknown>[],
    docs,
    seq: seqCounters([
      ...orders.map((o) => o.id),
      ...leads.map((l) => l.id),
      ...accounts.map((a) => a.id),
      ...buys.map((b) => b.id),
      ...jobs.map((j) => j.id),
      ...moves.map((m) => m.id),
    ]),
  });
}

/**
 * تبدیل عمیق BigInt → number — فیلدهای مهر زمانی در طرح داده BigInt هستند
 * و JSON.stringify آن‌ها را پشتیبانی نمی‌کند (CD-07: نمایش به‌صورت عدد).
 */
function jsonify<T>(value: T): T {
  if (typeof value === "bigint") return Number(value) as unknown as T;
  if (Array.isArray(value)) return value.map(jsonify) as unknown as T;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = jsonify(v);
    }
    return out as unknown as T;
  }
  return value;
}

/** استخراج شمارنده هر پیشوند از شناسه‌های موجود (معادل seq-*.txt). */
function seqCounters(ids: string[]): { kind: string; n: number }[] {
  const max = new Map<string, number>();
  for (const id of ids) {
    const match = /^([A-Z]{2})-?(\d+)$/.exec(id);
    if (!match) continue;
    const kind = match[1]!;
    const n = Number(match[2]);
    max.set(kind, Math.max(max.get(kind) ?? 0, n));
  }
  return ID_PREFIXES.filter((k) => max.has(k)).map((k) => ({ kind: k, n: max.get(k)! }));
}
