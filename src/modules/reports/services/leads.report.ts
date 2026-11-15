/**
 * سرویس گزارش سرنخ‌ها — PHASE_07 §۹ (بازسازی reports.js:12-27).
 *
 * قوانین کسب‌وکار (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - سرنخ‌های ایجادشده در بازه روزهای اخیر (reports.js:14).
 *  - شمارش مرحله‌ای: opp = مرحله فرصت/پیش‌فاکتور/قطعی، pf = پیش‌فاکتور
 *    به بعد، won = خرید قطعی، lost = از دست رفته (reports.js:18).
 *  - فروش سرنخ won = جمع کل سفارش مرتبط (reports.js:17: X.calc(o).total).
 *  - فیلتر نقش در سرور: sales فقط سرنخ‌های خودش (PHASE_07 §۸).
 */
import { prisma } from "@core/database/client";
import { type Prisma } from "@prisma/client";
import { instantToJalaliIso } from "@core/calendar";
import { getSettings } from "@modules/settings/services/settings.service";
import { calcOrder } from "@modules/orders/services/order.service";
import { rangeFrom } from "./bucketing";

/** محدوده دید گزارش — ساخته‌شده در Route Handler از مجوزها (CD-05). */
export type ReportScope = {
  /** true یعنی فقط داده‌های خود کاربر (نقش sales بدون leads.viewAll). */
  restrictToOwner: boolean;
  userId: string;
};

export type LeadsBySource = {
  source: string;
  n: number;
  opp: number;
  pf: number;
  won: number;
  lost: number;
  /** فروش سرنخ‌های won — فقط برای نقش‌های دارای money.view. */
  rev?: number;
};

export type LeadsByOwner = {
  ownerId: string;
  ownerName: string;
  n: number;
  opp: number;
  won: number;
  rev?: number;
  /** تعداد پیگیری‌های معوق (سررسید گذشته یا امروز). */
  due: number;
};

export type LeadsReport = {
  bySource: LeadsBySource[];
  byOwner: LeadsByOwner[];
  lostReasons: { reason: string; n: number }[];
};

type LeadRow = Prisma.LeadGetPayload<{
  include: {
    owner: { select: { name: true } };
    orders: { include: { items: true } };
  };
}>;

/**
 * گزارش سرنخ‌ها — تجمیع بر اساس منبع ورود و کارشناس (reports.js:15-26).
 *
 * `hideMoney` (R-32): فیلد فروش را برای نقش‌های فاقد money.view حذف می‌کند.
 */
export async function leadsReport(input: {
  days: number;
  line: "prod" | "agency" | null;
  scope: ReportScope;
  hideMoney: boolean;
}): Promise<LeadsReport> {
  const from = rangeFrom(input.days);
  const where: Prisma.LeadWhereInput = { createdAt: { gte: from } };
  if (input.line) where.line = input.line;
  if (input.scope.restrictToOwner) where.ownerId = input.scope.userId;

  const leads = await prisma.lead.findMany({
    where,
    include: {
      owner: { select: { name: true } },
      orders: { include: { items: true } },
    },
  });

  const settings = await getSettings();

  // آخرین پیگیری بعدی هر سرنخ — برای شمارش معوق‌ها (reports.js:19: L.due).
  const nextAtMap = await latestNextAt(leads.map((l) => l.id));
  const todayIso = todayString();

  const bySource = new Map<string, LeadsBySource>();
  const byOwner = new Map<string, LeadsByOwner>();
  const lostMap = new Map<string, number>();

  for (const lead of leads) {
    const stage = lead.stage;
    const source = lead.source || "نامشخص"; // reports.js:17

    const cell = bySource.get(source) ?? {
      source,
      n: 0,
      opp: 0,
      pf: 0,
      won: 0,
      lost: 0,
      rev: 0,
    };
    cell.n += 1;
    if (stage !== "raw" && stage !== "lost") cell.opp += 1;
    if (stage === "pf" || stage === "won") cell.pf += 1;
    if (stage === "won") {
      cell.won += 1;
      cell.rev = (cell.rev ?? 0) + wonRevenue(lead, settings.vat);
    }
    if (stage === "lost") cell.lost += 1;
    bySource.set(source, cell);

    const ownerKey = lead.ownerId ?? "—";
    const owner = byOwner.get(ownerKey) ?? {
      ownerId: ownerKey,
      ownerName: lead.owner?.name ?? "بدون مالک",
      n: 0,
      opp: 0,
      won: 0,
      rev: 0,
      due: 0,
    };
    owner.n += 1;
    if (stage !== "raw" && stage !== "lost") owner.opp += 1;
    if (stage === "won") {
      owner.won += 1;
      owner.rev = (owner.rev ?? 0) + wonRevenue(lead, settings.vat);
    }
    byOwner.set(ownerKey, owner);

    if (stage === "lost") {
      const reason = lead.lostReason || "نامشخص"; // reports.js:22
      lostMap.set(reason, (lostMap.get(reason) ?? 0) + 1);
    }
    const nextAt = nextAtMap.get(lead.id);
    if (nextAt !== undefined && nextAt <= todayIso) owner.due += 1;
  }

  const sources = [...bySource.values()].sort((a, b) => b.n - a.n);
  const owners = [...byOwner.values()].sort((a, b) => b.n - a.n);

  return {
    bySource: input.hideMoney ? sources.map(stripMoney) : sources,
    byOwner: input.hideMoney ? owners.map(stripMoney) : owners,
    lostReasons: [...lostMap.entries()]
      .map(([reason, n]) => ({ reason, n }))
      .sort((a, b) => b.n - a.n),
  };
}

function stripMoney<T extends { rev?: number }>(row: T): Omit<T, "rev"> {
  const { rev: _rev, ...rest } = row;
  return rest;
}

/**
 * آخرین تاریخ پیگیری بعدی به ازای هر سرنخ — `distinct` روی leadId با
 * ترتیب نزولی `at` (جدیدترین رویداد ملاک است — الگوی فاز ۳).
 */
async function latestNextAt(leadIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (leadIds.length === 0) return map;
  const rows = await prisma.leadFollowup.findMany({
    where: { leadId: { in: leadIds }, nextAt: { not: null } },
    orderBy: [{ at: "desc" }],
    distinct: ["leadId"],
    select: { leadId: true, nextAt: true },
  });
  for (const r of rows) {
    if (r.nextAt !== null) map.set(r.leadId, r.nextAt);
  }
  return map;
}

/** تاریخ امروز به قالب قرارداد `YYYY/MM/DD` ASCII (CD-06). */
function todayString(now: number = Date.now()): string {
  return instantToJalaliIso(now);
}

/** فروش سرنخ won — جمع کل اولین سفارش لغو‌نشده مرتبط (reports.js:17). */
function wonRevenue(
  lead: { orders: { status: string; discPct: number; discAmt: number; ship: number; install: number; noVat: boolean; items: { qty: number; price: number; discount: number }[] }[] },
  vat: number,
): number {
  const order = lead.orders.find((o) => o.status !== "cancelled");
  if (!order) return 0;
  return calcOrder(order.items, {
    discPct: order.discPct,
    discAmt: order.discAmt,
    ship: order.ship,
    install: order.install,
    noVat: order.noVat,
    vat,
  }).total;
}
