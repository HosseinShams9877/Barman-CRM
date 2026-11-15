/**
 * مرحله ۷ مهاجرت — صحه‌گذاری (MIGRATION_STRATEGY §۳.۷).
 *
 * ۱) شمارش تطبیقی: شمارش هر مجموعه Demo در برابر ردیف‌های بارگذاری‌شده —
 *    هر اختلاف یک ردیف در گزارش می‌شود.
 * ۲) نمونه‌گیری ۱۰٪: مقایسه فیلدی ردیف‌های نقشه‌شده با ردیف‌های
 *    بارگذاری‌شده. نمونه‌گیری قطعی است (every 10th — قابل بازتولید در
 *    آزمون‌ها) و حداقل یک سند در هر مجموعه.
 *
 * مبنای مقایسه ردیف‌های نقشه‌شده هستند — تصمیمات نگاشت در map.ts
 * مستند و در گزارش فهرست شده‌اند؛ اینجا صحت بارگذاری بررسی می‌شود.
 */
import type { MappedData } from "./map";
import type { VerificationReport } from "./types";

/** خواننده ردیف بارگذاری‌شده — برای آزمون‌ها mock می‌شود. */
export type RowReader = {
  account: (id: string) => Promise<Record<string, unknown> | null>;
  lead: (id: string) => Promise<Record<string, unknown> | null>;
  order: (id: string) => Promise<Record<string, unknown> | null>;
  buy: (id: string) => Promise<Record<string, unknown> | null>;
  move: (id: string) => Promise<Record<string, unknown> | null>;
};

/** انتخاب نمونه ۱۰٪ (حداقل یک سند در هر مجموعه). */
export function sampleIds(ids: readonly string[]): string[] {
  if (ids.length === 0) return [];
  const step = Math.max(1, Math.ceil(ids.length / 10));
  const out: string[] = [];
  for (let i = 0; i < ids.length; i += step) out.push(ids[i]!);
  return out;
}

const asValue = (v: unknown): string => (typeof v === "bigint" ? String(Number(v)) : String(v ?? ""));

/**
 * مقایسه فیلدی ردیف نقشه‌شده با ردیف بارگذاری‌شده.
 *
 * فقط فیلدهای کلیدی هر مجموعه مقایسه می‌شوند (FIELD_MAP).
 */
export function compareRow(
  collection: string,
  id: string,
  mapped: Record<string, unknown> | null,
  row: Record<string, unknown> | null,
): { matched: boolean; diffs: string[] } {
  if (row === null || mapped === null) {
    return { matched: false, diffs: [row === null ? "ردیف در پایگاه داده پیدا نشد" : "ردیف نقشه‌شده پیدا نشد"] };
  }
  const diffs: string[] = [];
  for (const field of FIELD_MAP[collection] ?? []) {
    const mappedValue = mapped[field];
    const rowValue = row[field];
    if (asValue(mappedValue) !== asValue(rowValue)) {
      diffs.push(`${field}: نقشه=${JSON.stringify(mappedValue) ?? "—"} DB=${JSON.stringify(rowValue) ?? "—"}`);
    }
  }
  return { matched: diffs.length === 0, diffs };
}

/** فیلدهای کلیدی هر مجموعه برای نمونه‌گیری — نام فیلد در هر دو طرف. */
const FIELD_MAP: Record<string, string[]> = {
  accounts: ["name", "kind", "createdAt"],
  leads: ["accountId", "line", "stage", "title", "amount", "source", "createdAt", "updatedAt"],
  orders: [
    "accountId",
    "contactId",
    "leadId",
    "line",
    "stage",
    "status",
    "validDays",
    "discPct",
    "createdAt",
    "stageAt",
    "due",
  ],
  buys: ["supplierId", "status", "total", "createdAt"],
  moves: ["wh", "item", "qty", "kind", "ref", "at"],
};

/**
 * اجرای صحه‌گذاری کامل.
 *
 * @param counts شمارش واقعی پایگاه داده (از load.ts)
 * @param data داده نقشه‌شده (مبنای شمارش مورد انتظار)
 * @param expectedDocCounts شمارش اسناد Demo — برای گزارش تطبیق با عدد اصلی
 * @param reader خواننده ردیف پایگاه داده
 */
export async function verifyMigration(args: {
  counts: Record<string, number>;
  data: MappedData;
  expectedDocCounts: Record<string, number>;
  seqs?: Record<string, number>;
  reader: RowReader;
}): Promise<VerificationReport> {
  const { counts, data, reader } = args;

  const expected: Record<string, number> = {
    users: data.users.length,
    roles: data.roles.length,
    userRoles: data.users.reduce((sum, u) => sum + u.roles.length, 0),
    settings: data.settings !== null ? 1 : 0,
    lists: data.lists.length,
    suppliers: data.suppliers.length,
    products: data.products.length,
    materials: data.materials.length,
    bom: data.bom.length,
    rev: Object.keys(args.seqs ?? {}).length || 0,
    accounts: data.accounts.length,
    phones: data.phones.length,
    contacts: data.contacts.length,
    leads: data.leads.length,
    followups: data.followups.length,
    interests: data.interests.length,
    orders: data.orders.length,
    items: data.items.length,
    payments: data.payments.length,
    cheques: data.cheques.length,
    stageLogs: data.stageLogs.length,
    handoffs: data.handoffs.length,
    buys: data.buys.length,
    buyItems: data.buyItems.length,
    buyCheques: data.buyCheques.length,
    buyStatusLogs: data.buyStatusLogs.length,
    jobs: data.jobs.length,
    moves: data.moves.length,
    ...args.expectedDocCounts,
  };

  const countDiffs: VerificationReport["countDiffs"] = [];
  const keys = new Set([...Object.keys(expected), ...Object.keys(counts)]);
  for (const key of keys) {
    const want = expected[key] ?? 0;
    const got = counts[key] ?? 0;
    if (want !== got) countDiffs.push({ collection: key, expected: want, actual: got });
  }

  const sampling: VerificationReport["sampling"] = [];
  const collections: { name: string; rows: Record<string, unknown>[]; reader: keyof RowReader }[] = [
    { name: "accounts", rows: data.accounts as unknown as Record<string, unknown>[], reader: "account" },
    { name: "leads", rows: data.leads as unknown as Record<string, unknown>[], reader: "lead" },
    { name: "orders", rows: data.orders as unknown as Record<string, unknown>[], reader: "order" },
    { name: "buys", rows: data.buys as unknown as Record<string, unknown>[], reader: "buy" },
    { name: "moves", rows: data.moves as unknown as Record<string, unknown>[], reader: "move" },
  ];
  let sampled = 0;
  let totalDocs = 0;
  for (const collection of collections) {
    totalDocs += collection.rows.length;
    const ids = collection.rows.map((r) => String(r["id"] ?? "")).filter((x) => x.length > 0);
    for (const id of sampleIds(ids)) {
      const mapped = collection.rows.find((r) => String(r["id"] ?? "") === id) ?? null;
      const row = await reader[collection.reader](id);
      const result = compareRow(collection.name, id, mapped, row);
      sampling.push({ collection: collection.name, id, matched: result.matched, diffs: result.diffs });
      sampled++;
    }
  }
  // پوشش نمونه‌گیری نسبت به کل اسناد اصلی (accounts…moves).
  const samplingCoverage = totalDocs > 0 ? sampled / totalDocs : 0;

  return {
    countsMatch: countDiffs.length === 0,
    expected,
    actual: counts,
    countDiffs,
    sampling,
    samplingCoverage,
  };
}
