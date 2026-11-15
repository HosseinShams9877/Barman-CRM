/**
 * هماهنگ‌کننده ۷ مرحله مهاجرت (MIGRATION_STRATEGY §۳).
 *
 * extract → split meta → normalize/map → validate → load → verify → report.
 *
 * مراحل ۱ تا ۵ خالص هستند (بدون پایگاه داده) و جداگانه قابل آزمون؛
 * مراحل ۶/۷ به Prisma نیاز دارند. ردیف‌های نامعتبر (مرحله ۵) از بارگذاری
 * حذف و در گزارش فهرست می‌شوند — **اصلاح ساکت ممنوع** (R-27).
 */
import { extractData } from "./extract";
import { mapEntities, mapMeta, type MappedData } from "./map";
import { validateMapped, type ValidationResult } from "./validate";
import { loadAll, seqNumbers, countAll, type MigrationPrismaClient } from "./load";
import { verifyMigration } from "./verify";
import { reportToMarkdown } from "./report";
import type { MigrationReport, RejectedRecord, VerificationReport } from "./types";

export type RunResult = {
  report: MigrationReport;
  markdown: string;
};

/** خواننده ردیف پایگاه داده برای صحه‌گذاری (prisma واقعی در CLI). */
export type DbReader = {
  account: (id: string) => Promise<Record<string, unknown> | null>;
  lead: (id: string) => Promise<Record<string, unknown> | null>;
  order: (id: string) => Promise<Record<string, unknown> | null>;
  buy: (id: string) => Promise<Record<string, unknown> | null>;
  move: (id: string) => Promise<Record<string, unknown> | null>;
};

/**
 * اجرای کامل مهاجرت — همه ۷ مرحله.
 *
 * @param dataDir پوشه data (Demo یا ZIP استخراج‌شده)
 * @param prisma کلاینت Prisma (یا mock در آزمون‌ها)
 * @param reader خواننده ردیف برای نمونه‌گیری
 * @param load بارگذاری واقعی (پیش‌فرض true؛ false = dry-run)
 */
export async function runMigration(args: {
  dataDir: string;
  prisma: MigrationPrismaClient;
  reader: DbReader;
  load?: boolean;
}): Promise<RunResult> {
  const startedAt = Date.now();
  const shouldLoad = args.load !== false;

  // مرحله ۱ — استخراج snapshot کامل
  const { snapshot, report: extraction } = extractData(args.dataDir);

  // مرحله ۲ — تجزیه meta (کاربران، نقش‌ها، کاتالوگ، فهرست‌ها، تنظیمات)
  const meta = mapMeta(snapshot.meta);

  // مراحل ۳+۴ — نرمال‌سازی تاریخ و نقشه‌گذاری موجودیت‌ها
  const entityResult = mapEntities(snapshot.docs, {
    products: meta.products,
    materials: meta.materials,
    bom: meta.bom,
  });
  const data: MappedData = {
    ...meta,
    ...entityResult.data,
    droppedFields: [...meta.droppedFields, ...entityResult.data.droppedFields],
  };

  // مرحله ۵ — اعتبارسنجی Zod + بررسی ارجاعات
  const ids = {
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
  const validation: ValidationResult = validateMapped(data, ids);

  // aggregating همه رد‌شده‌ها — استخراج + نقشه‌گذاری + اعتبارسنجی
  const rejected: RejectedRecord[] = [
    ...extraction.invalidJson.map((file) => {
      const [collection, name] = file.split("/");
      return {
        collection: collection ?? "unknown",
        id: name ?? file,
        step: "extract" as const,
        reason: "JSON نامعتبر",
      };
    }),
    ...entityResult.rejected,
    ...validation.rejected,
  ];
  removeRejected(data, rejected);

  const seqs = seqNumbers(data, snapshot.seq);
  const now = Date.now();

  // مرحله ۶ — بارگذاری تراکنشی (fail-fast → rollback کامل)
  let loaded: Record<string, number> = {};
  if (shouldLoad) {
    loaded = await loadAll(args.prisma, data, seqs, now);
  }

  // مرحله ۷ — صحه‌گذاری (شمارش تطبیقی + نمونه‌گیری ۱۰٪)
  // توجه: تعداد اسناد Demo به‌عنوان مبنای «مورد انتظار» گزارش می‌شود —
  // هر اختلاف (مثل خرید آژانسی رد‌شده) یک ردیف شفاف در گزارش می‌شود.
  const expectedDocCounts: Record<string, number> = {
    accounts: snapshot.docs.accounts.length,
    leads: snapshot.docs.leads.length,
    orders: snapshot.docs.orders.length,
    buys: snapshot.docs.buys.length,
    jobs: snapshot.docs.jobs.length,
    moves: snapshot.docs.moves.length,
  };
  const countsForVerify = shouldLoad ? loaded : countMapped(data);
  if (!shouldLoad) {
    countsForVerify["userRoles"] = data.users.reduce((sum, u) => sum + u.roles.length, 0);
    countsForVerify["settings"] = data.settings !== null ? 1 : 0;
  }
  const verification: VerificationReport = await verifyMigration({
    counts: countsForVerify,
    data,
    expectedDocCounts,
    seqs,
    reader: args.reader,
  });

  const report: MigrationReport = {
    startedAt: new Date(startedAt).toISOString(),
    source: args.dataDir,
    extraction,
    mapped: countMapped(data),
    rejected,
    referentialIssues: validation.referentialIssues,
    droppedFields: data.droppedFields,
    loaded,
    seqs,
    verification,
    durationMs: Date.now() - startedAt,
  };

  return { report, markdown: reportToMarkdown(report, data) };
}

/** شمارش هر جدول نقشه‌شده. */
function countMapped(data: MappedData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) out[key] = value.length;
  }
  return out;
}

/**
 * حذف ردیف‌های رد‌شده از داده بارگذاری — شامل ردیف‌های فرزند وابسته.
 *
 * سفارش/خرید رد‌شده → اقلام، پرداخت‌ها، چک‌ها و تاریخچه آن هم حذف
 * می‌شوند (نباید ردیف یتیم بارگذاری شود).
 */
function removeRejected(data: MappedData, rejected: RejectedRecord[]): void {
  const byCollection = new Map<string, Set<string>>();
  for (const r of rejected) {
    const set = byCollection.get(r.collection) ?? new Set<string>();
    set.add(r.id);
    byCollection.set(r.collection, set);
  }
  const rejectedIds = (collection: string): Set<string> => byCollection.get(collection) ?? new Set<string>();

  // ردیف‌های فرزند مستقیماً رد‌شده (مثلاً رسید با تاریخ غیرقابل تجزیه)
  data.phones = data.phones.filter((p) => !rejectedIds("account_phones").has(p.id));
  data.contacts = data.contacts.filter((c) => !rejectedIds("account_contacts").has(c.id));
  data.followups = data.followups.filter((f) => !rejectedIds("lead_followups").has(f.id));
  data.items = data.items.filter((i) => !rejectedIds("order_items").has(i.id));
  data.payments = data.payments.filter((p) => !rejectedIds("order_payments").has(p.id));
  data.cheques = data.cheques.filter((c) => !rejectedIds("order_cheques").has(c.id));
  data.stageLogs = data.stageLogs.filter((s) => !rejectedIds("order_stage_log").has(s.id));
  data.handoffs = data.handoffs.filter((h) => !rejectedIds("order_handoffs").has(h.id));
  data.buyItems = data.buyItems.filter((i) => !rejectedIds("buy_items").has(i.id));
  data.buyCheques = data.buyCheques.filter((c) => !rejectedIds("buy_cheques").has(c.id));
  data.buyStatusLogs = data.buyStatusLogs.filter((s) => !rejectedIds("buy_status_log").has(s.id));

  data.accounts = data.accounts.filter((a) => !rejectedIds("accounts").has(a.id));
  data.leads = data.leads.filter((l) => !rejectedIds("leads").has(l.id));
  const deadLeads = rejectedIds("leads");
  data.followups = data.followups.filter((f) => !deadLeads.has(f.leadId));
  data.interests = data.interests.filter((i) => !deadLeads.has(i.leadId));

  data.orders = data.orders.filter((o) => !rejectedIds("orders").has(o.id));
  const deadOrders = rejectedIds("orders");
  data.items = data.items.filter((i) => !deadOrders.has(i.orderId));
  data.payments = data.payments.filter((p) => !deadOrders.has(p.orderId));
  data.cheques = data.cheques.filter((c) => !deadOrders.has(c.orderId));
  data.stageLogs = data.stageLogs.filter((s) => !deadOrders.has(s.orderId));
  data.handoffs = data.handoffs.filter((h) => !deadOrders.has(h.orderId));

  data.buys = data.buys.filter((b) => !rejectedIds("buys").has(b.id));
  const deadBuys = rejectedIds("buys");
  data.buyItems = data.buyItems.filter((i) => !deadBuys.has(i.buyId));
  data.buyCheques = data.buyCheques.filter((c) => !deadBuys.has(c.buyId));
  data.buyStatusLogs = data.buyStatusLogs.filter((s) => !deadBuys.has(s.buyId));

  data.jobs = data.jobs.filter((j) => !rejectedIds("jobs").has(j.id));
  data.moves = data.moves.filter((m) => !rejectedIds("moves").has(m.id));
}

export { reportToMarkdown, countAll };
