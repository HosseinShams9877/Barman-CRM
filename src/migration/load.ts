/**
 * مرحله ۶ مهاجرت — بارگذاری تراکنشی + ثبت آخرین شماره هر series
 * (MIGRATION_STRATEGY §۳.۶ / R-12).
 *
 * همه رشتها در یک تراکنش واحد بارگذاری می‌شوند — هر خطا → rollback
 * کامل (fail-fast). پایگاه داده باید خالی باشد (شروع تمیز).
 *
 * شماره‌های series: علاوه بر اینکه شناسه‌های اصلی (PF-1219، …) با
 * مقدار max خودشان بارگذاری می‌شوند و `nextPrefixedId` را به‌درستی
 * ادامه می‌دهند، آخرین شماره هر series در جدول Rev با کلید
 * `seq:<KIND>` ثبت می‌شود (قرارداد R-12 — گزارش و حسابرسی).
 */
import type { MappedData } from "./map";

/** کلیدهای Rev برای ثبت شماره series — R-12. */
export const SEQ_REV_KEYS = ["AC", "LD", "PF", "BY", "PJ", "TR"] as const;

/** آخرین شماره هر series — از seq-*.txt Demo یا max شناسه‌های بارگذاری‌شده. */
export function seqNumbers(data: MappedData, demoSeq: Record<string, number>): Record<string, number> {
  const maxOf = (ids: Iterable<string>, prefix: string): number => {
    let max = 0;
    const re = new RegExp(`^${prefix}-(\\d+)$`);
    for (const id of ids) {
      const m = re.exec(id);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return max;
  };

  const byPrefix: Record<string, number> = {
    AC: maxOf(data.accounts.map((a) => a.id), "AC"),
    LD: maxOf(data.leads.map((l) => l.id), "LD"),
    PF: maxOf(data.orders.map((o) => o.id), "PF"),
    BY: maxOf(data.buys.map((b) => b.id), "BY"),
    PJ: maxOf(data.jobs.map((j) => j.id), "PJ"),
    TR: maxOf(data.handoffs.map((h) => h.id), "TR"),
  };

  // seq-*.txt Demo منبع حقیقت است (ممکن است جلوتر از max سند باشد).
  const out: Record<string, number> = {};
  for (const kind of SEQ_REV_KEYS) {
    const fromDemo = demoSeq[kind] ?? 0;
    out[kind] = Math.max(fromDemo, byPrefix[kind] ?? 0);
  }
  return out;
}

/**
 * بارگذاری کامل داده نقشه‌شده در یک تراکنش.
 *
 * @param tx کلاینت Prisma (با $transaction یا مستقیم — برای آزمون‌ها mock)
 * @throws در صورت وجود داده قبلی یا هر خطای پایگاه داده (rollback)
 */
export async function loadAll(
  tx: MigrationPrismaClient,
  data: MappedData,
  seqs: Record<string, number>,
  now: number,
): Promise<Record<string, number>> {
  await assertEmpty(tx);

  await tx.role.createMany({ data: data.roles.map((r) => ({ key: r.key, name: r.name })) });
  await tx.user.createMany({
    data: data.users.map((u) => ({
      id: u.id,
      name: u.name,
      title: u.title,
      passwordHash: u.passwordHash,
      createdAt: u.createdAt,
      updatedAt: u.createdAt,
      sessionVersion: 0,
      rev: 0,
    })),
  });
  await tx.userRole.createMany({
    data: data.users.flatMap((u) => u.roles.map((roleKey) => ({ userId: u.id, roleKey }))),
  });

  if (data.settings !== null) {
    await tx.setting.create({
      data: {
        id: 0,
        vat: data.settings.vat,
        validDays: data.settings.validDays,
        rate: data.settings.rate,
        discountCap: data.settings.discountCap as object,
        company: data.settings.company as object,
        updatedAt: data.settings.updatedAt,
        rev: 0,
      },
    });
  }
  if (data.lists.length > 0) {
    await tx.list.createMany({
      data: data.lists.map((l) => ({ key: l.key, items: l.items as object, updatedAt: now, rev: 0 })),
    });
  }
  await tx.supplier.createMany({
    data: data.suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      phone: s.phone,
      terms: s.terms,
      items: s.items as object,
      createdAt: s.createdAt,
      updatedAt: s.createdAt,
      rev: 0,
    })),
  });
  await tx.material.createMany({
    data: data.materials.map((m) => ({
      id: m.id,
      code: m.code,
      name: m.name,
      unit: m.unit,
      price: m.price,
      min: m.min,
      createdAt: m.createdAt,
      updatedAt: m.createdAt,
      rev: 0,
    })),
  });
  await tx.product.createMany({
    data: data.products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      line: p.line,
      category: p.category,
      unit: p.unit,
      price: p.price,
      active: p.active,
      days: p.days,
      supplierId: p.supplierId,
      colors: p.colors as object,
      createdAt: p.createdAt,
      updatedAt: p.createdAt,
      rev: 0,
    })),
  });
  if (data.bom.length > 0) {
    await tx.bomItem.createMany({
      data: data.bom.map((b) => ({ productId: b.productId, materialId: b.materialId, qty: b.qty })),
    });
  }

  await tx.account.createMany({
    data: data.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      active: a.active,
      address: a.address,
      note: a.note,
      createdAt: BigInt(a.createdAt),
      updatedAt: BigInt(a.updatedAt),
    })),
  });
  if (data.phones.length > 0) {
    await tx.accountPhone.createMany({
      data: data.phones.map((p) => ({ id: p.id, accountId: p.accountId, kind: p.kind, number: p.number })),
    });
  }
  if (data.contacts.length > 0) {
    await tx.accountContact.createMany({
      data: data.contacts.map((c) => ({
        id: c.id,
        accountId: c.accountId,
        name: c.name,
        role: c.role,
        phone: c.phone,
      })),
    });
  }

  await tx.lead.createMany({
    data: data.leads.map((l) => ({
      id: l.id,
      accountId: l.accountId,
      line: l.line,
      stage: l.stage,
      title: l.title,
      amount: l.amount,
      ownerId: l.ownerId,
      source: l.source,
      note: l.note,
      lostReason: l.lostReason,
      lostFrom: l.lostFrom,
      createdAt: BigInt(l.createdAt),
      updatedAt: BigInt(l.updatedAt),
    })),
  });
  if (data.interests.length > 0) {
    await tx.leadInterest.createMany({
      data: data.interests.map((i) => ({ leadId: i.leadId, productId: i.productId })),
    });
  }
  if (data.followups.length > 0) {
    await tx.leadFollowup.createMany({
      data: data.followups.map((f) => ({
        id: f.id,
        leadId: f.leadId,
        at: BigInt(f.at),
        kind: f.kind,
        result: f.result,
        note: f.note,
        nextAt: f.nextAt,
        byUserId: f.byUserId,
      })),
    });
  }

  await tx.order.createMany({
    data: data.orders.map((o) => ({
      id: o.id,
      accountId: o.accountId,
      contactId: o.contactId,
      leadId: o.leadId,
      line: o.line,
      stage: o.stage,
      status: o.status,
      discPct: o.discPct,
      discAmt: o.discAmt,
      ship: o.ship,
      install: o.install,
      noVat: o.noVat,
      validDays: o.validDays,
      note: o.note,
      preset: o.preset,
      skipped: o.skipped as object,
      planBuilder: o.planBuilder as object | null,
      backNote: o.backNote as object | null,
      smOk: o.smOk as object | null,
      mgrOk: o.mgrOk as object | null,
      due: BigInt(o.due),
      stageAt: BigInt(o.stageAt),
      times: o.times as object | null,
      sent: o.sent as object | null,
      prod: o.prod as object | null,
      prep: o.prep as object | null,
      delivered: o.delivered as object | null,
      agreed: o.agreed as object | null,
      cancelReason: o.cancelReason,
      ownerId: o.ownerId,
      createdById: o.createdById,
      createdAt: BigInt(o.createdAt),
      updatedAt: BigInt(o.updatedAt),
    })),
  });
  if (data.items.length > 0) {
    await tx.orderItem.createMany({
      data: data.items.map((it) => ({
        id: it.id,
        orderId: it.orderId,
        productId: it.productId,
        qty: it.qty,
        price: it.price,
        discount: it.discount,
        color: it.color,
      })),
    });
  }
  if (data.payments.length > 0) {
    await tx.orderPayment.createMany({
      data: data.payments.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        kind: p.kind,
        amount: p.amount,
        date: p.date,
        void: p.void,
        note: p.note,
        byUserId: p.byUserId,
        createdAt: BigInt(p.createdAt),
      })),
    });
  }
  if (data.cheques.length > 0) {
    await tx.orderCheque.createMany({
      data: data.cheques.map((c) => ({
        id: c.id,
        orderId: c.orderId,
        sayad: c.sayad,
        amount: c.amount,
        due: c.due,
        status: c.status,
        bank: c.bank,
        owner: c.owner,
        note: c.note,
        createdAt: BigInt(c.createdAt),
        updatedAt: BigInt(c.updatedAt),
      })),
    });
  }
  if (data.stageLogs.length > 0) {
    await tx.orderStageLog.createMany({
      data: data.stageLogs.map((s) => ({
        id: s.id,
        orderId: s.orderId,
        fromStage: s.fromStage,
        toStage: s.toStage,
        at: BigInt(s.at),
        byUserId: s.byUserId,
        note: s.note,
        kind: s.kind,
      })),
    });
  }
  if (data.handoffs.length > 0) {
    await tx.orderHandoff.createMany({
      data: data.handoffs.map((h) => ({
        id: h.id,
        orderId: h.orderId,
        lines: h.lines as object,
        at: BigInt(h.at),
        byUserId: h.byUserId,
        note: h.note,
      })),
    });
  }

  await tx.buy.createMany({
    data: data.buys.map((b) => ({
      id: b.id,
      supplierId: b.supplierId,
      status: b.status,
      total: b.total,
      note: b.note,
      createdBy: b.createdBy,
      createdAt: BigInt(b.createdAt),
      updatedAt: BigInt(b.updatedAt),
    })),
  });
  if (data.buyItems.length > 0) {
    await tx.buyItem.createMany({
      data: data.buyItems.map((bi) => ({
        id: bi.id,
        buyId: bi.buyId,
        materialId: bi.materialId,
        qty: bi.qty,
        price: bi.price,
      })),
    });
  }
  if (data.buyCheques.length > 0) {
    await tx.buyCheque.createMany({
      data: data.buyCheques.map((c) => ({
        id: c.id,
        buyId: c.buyId,
        amount: c.amount,
        due: c.due,
        sayad: c.sayad,
        status: c.status,
      })),
    });
  }
  if (data.buyStatusLogs.length > 0) {
    await tx.buyStatusLog.createMany({
      data: data.buyStatusLogs.map((s) => ({
        id: s.id,
        buyId: s.buyId,
        fromStatus: s.fromStatus,
        toStatus: s.toStatus,
        at: BigInt(s.at),
        byUserId: s.byUserId,
        note: s.note,
      })),
    });
  }

  if (data.jobs.length > 0) {
    await tx.job.createMany({
      data: data.jobs.map((j) => ({
        id: j.id,
        productId: j.productId,
        qty: j.qty,
        color: j.color,
        end: j.end !== null ? BigInt(j.end) : null,
        status: j.status,
        good: j.good,
        waste: j.waste,
        startedAt: j.startedAt !== null ? BigInt(j.startedAt) : null,
        qcAt: j.qcAt !== null ? BigInt(j.qcAt) : null,
        recvQty: j.recvQty,
        recvAt: j.recvAt !== null ? BigInt(j.recvAt) : null,
        bomSnapshot: j.bomSnapshot as object,
        createdBy: j.createdBy,
        createdAt: BigInt(j.createdAt),
        updatedAt: BigInt(j.updatedAt),
      })),
    });
  }

  if (data.moves.length > 0) {
    await tx.move.createMany({
      data: data.moves.map((m) => ({
        id: m.id,
        wh: m.wh,
        item: m.item,
        qty: m.qty,
        kind: m.kind,
        ref: m.ref,
        at: BigInt(m.at),
        byUserId: m.byUserId,
        note: m.note,
      })),
    });
  }

  // --- ثبت آخرین شماره هر series (R-12) ---
  for (const [kind, value] of Object.entries(seqs)) {
    await tx.rev.upsert({
      where: { key: `seq:${kind}` },
      create: { key: `seq:${kind}`, value, updatedAt: BigInt(now) },
      update: { value, updatedAt: BigInt(now) },
    });
  }

  return countAll(tx);
}

/** شمارش تمام جداول — برای گزارش بارگذاری. */
export async function countAll(tx: MigrationPrismaClient): Promise<Record<string, number>> {
  const entries: [string, Promise<number>][] = [
    ["roles", tx.role.count()],
    ["users", tx.user.count()],
    ["userRoles", tx.userRole.count()],
    ["settings", tx.setting.count()],
    ["lists", tx.list.count()],
    ["suppliers", tx.supplier.count()],
    ["products", tx.product.count()],
    ["materials", tx.material.count()],
    ["bom", tx.bomItem.count()],
    ["accounts", tx.account.count()],
    ["phones", tx.accountPhone.count()],
    ["contacts", tx.accountContact.count()],
    ["leads", tx.lead.count()],
    ["interests", tx.leadInterest.count()],
    ["followups", tx.leadFollowup.count()],
    ["orders", tx.order.count()],
    ["items", tx.orderItem.count()],
    ["payments", tx.orderPayment.count()],
    ["cheques", tx.orderCheque.count()],
    ["stageLogs", tx.orderStageLog.count()],
    ["handoffs", tx.orderHandoff.count()],
    ["buys", tx.buy.count()],
    ["buyItems", tx.buyItem.count()],
    ["buyCheques", tx.buyCheque.count()],
    ["buyStatusLogs", tx.buyStatusLog.count()],
    ["jobs", tx.job.count()],
    ["moves", tx.move.count()],
    ["txns", tx.txn.count()],
    ["rev", tx.rev.count()],
  ];
  const out: Record<string, number> = {};
  for (const [key, promise] of entries) out[key] = await promise;
  return out;
}

/** شمارش جداول اصلی قبل از بارگذاری — پایگاه داده باید خالی باشد. */
async function assertEmpty(tx: MigrationPrismaClient): Promise<void> {
  const counts = await Promise.all([
    tx.account.count(),
    tx.order.count(),
    tx.buy.count(),
    tx.job.count(),
    tx.move.count(),
    tx.user.count(),
  ]);
  const [accounts, orders, buys, jobs, moves, users] = counts;
  const nonEmpty: string[] = [];
  if (accounts > 0) nonEmpty.push(`accounts=${accounts}`);
  if (orders > 0) nonEmpty.push(`orders=${orders}`);
  if (buys > 0) nonEmpty.push(`buys=${buys}`);
  if (jobs > 0) nonEmpty.push(`jobs=${jobs}`);
  if (moves > 0) nonEmpty.push(`moves=${moves}`);
  if (users > 0) nonEmpty.push(`users=${users}`);
  if (nonEmpty.length > 0) {
    throw new Error(`پایگاه داده خالی نیست — مهاجرت روی پایگاه تمیز اجرا شود: ${nonEmpty.join("، ")}`);
  }
}

/**
 * رویه مورد نیاز مهاجرت از کلاینت Prisma — یک زیرمجموعه از PrismaClient
 * برای قابل‌ آزمون بودن (mock ساده در آزمون‌ها).
 */
export type MigrationPrismaClient = {
  role: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  user: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  userRole: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  setting: { count: () => Promise<number>; create: (a: { data: Record<string, unknown> }) => Promise<unknown> };
  list: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  supplier: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  material: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  product: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  bomItem: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  account: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  accountPhone: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  accountContact: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  lead: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  leadInterest: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  leadFollowup: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  order: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  orderItem: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  orderPayment: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  orderCheque: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  orderStageLog: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  orderHandoff: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  buy: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  buyItem: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  buyCheque: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  buyStatusLog: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  job: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  move: { count: () => Promise<number>; createMany: (a: { data: unknown[] }) => Promise<unknown> };
  txn: { count: () => Promise<number> };
  rev: {
    count: () => Promise<number>;
    upsert: (a: {
      where: { key: string };
      create: { key: string; value: number; updatedAt: bigint };
      update: { value: number; updatedAt: bigint };
    }) => Promise<unknown>;
  };
};
