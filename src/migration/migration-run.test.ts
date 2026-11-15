/**
 * اجرای کامل مهاجرت Demo → پایگاه داده تازه — PHASE_08 §۱۲ / دروازه خروج ۱.
 *
 * **این فایل خود اسکریپت مهاجرت است** (قابل‌اجراء با vitest):
 *   npx vitest run src/migration/migration-run.test.ts
 *
 * مراحل (MIGRATION_STRATEGY §۳): extract → mapMeta → map → validate →
 * load (تراکنش کامل) → verify. خروجی‌ها:
 *   - گزارش Markdown در docs/reports/MIGRATION_REPORT.md
 *   - انتقال ZIP معکوس (دروازه خروج ۴) خوانده و صحه‌گذاری می‌شود
 *
 * پایگاه داده: یک فایل SQLite تازه در هر اجرا (DATABASE_URL موقت) —
 * Schema با `prisma db push` ساخته می‌شود. اگر MIGRATION_TEST_DB تنظیم
 * شود از آن مسیر استفاده می‌شود.
 *
 * **هیچ فایلی در Demo نوشته نمی‌شود** — فقط خواندن.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const DEMO_DATA = join(process.cwd(), "پلتفرم نهایی تیم بارمان", "data");
const REPORT_OUT = process.env["MIGRATION_REPORT_OUT"] ?? join(process.cwd(), "docs", "reports", "MIGRATION_REPORT.md");
const DB_FILE = process.env["MIGRATION_TEST_DB"] ?? join(tmpdir(), `barman-migration-${Date.now()}.db`);
const DB_URL = `file:${DB_FILE}`;

type RunResult = {
  report: {
    loaded: Record<string, number>;
    rejected: unknown[];
    referentialIssues: { ref: string }[];
    verification: {
      countDiffs: { collection: string; expected: number; actual: number }[];
      sampling: { matched: boolean }[];
      samplingCoverage: number;
    };
  };
  markdown: string;
};

/** holder مشترک برای mock کلاینت singleton — export snapshot از آن استفاده می‌کند. */
const holder = vi.hoisted(() => ({ client: null as unknown as PrismaClient }));
vi.mock("@core/database/client", () => ({ prisma: holder.client }));

describe("مهاجرت کامل Demo — ۱۴۸ سند (PHASE_08 دروازه ۱/۳/۴)", () => {
  let prisma: PrismaClient;
  let tempDir: string;
  let run: RunResult | null = null;

  beforeAll(() => {
    if (existsSync(DB_FILE)) rmSync(DB_FILE, { force: true });
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      env: { ...process.env, DATABASE_URL: DB_URL },
      stdio: "pipe",
      cwd: process.cwd(),
      timeout: 180_000,
    });
    prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
    holder.client = prisma;
    tempDir = mkdtempSync(join(tmpdir(), "barman-mig-"));
  }, 240_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    rmSync(DB_FILE, { force: true });
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it("استخراج: تمام اسناد Demo خوانده می‌شوند (accounts ۲۳، leads ۲۹، orders ۱۹، buys ۶، jobs ۱، moves ۷۰)", async () => {
    const { extractData } = await import("./extract");
    const { snapshot, report } = extractData(DEMO_DATA);
    expect(report.invalidJson).toEqual([]);
    expect(snapshot.docs.accounts).toHaveLength(23);
    expect(snapshot.docs.leads).toHaveLength(29);
    expect(snapshot.docs.orders).toHaveLength(19);
    expect(snapshot.docs.buys).toHaveLength(6);
    expect(snapshot.docs.jobs).toHaveLength(1);
    expect(snapshot.docs.moves).toHaveLength(70);
    expect(snapshot.seq).toMatchObject({ PF: 1219, BY: 306, AC: 222, LD: 1032, PJ: 501 });
  });

  it("بارگذاری تراکنشی کامل — شمارش دقیق جداول هدف", async () => {
    const { runMigration } = await import("./run");
    const reader = await makeReader(prisma);
    const result = await runMigration({ dataDir: DEMO_DATA, prisma: prisma as never, reader });
    run = result as unknown as RunResult;
    const report = run.report;

    expect(report.rejected).toEqual([
      { collection: "buys", id: "BY-303", step: "map", reason: expect.stringContaining("آژانسی") },
    ]);
    expect(report.referentialIssues.some((i) => i.ref === "sys")).toBe(true);

    const loaded = report.loaded;
    // --- شمارش تطبیقی اصلی (PHASE_08 §۱۲) ---
    expect(loaded["accounts"]).toBe(23);
    expect(loaded["leads"]).toBe(29);
    expect(loaded["orders"]).toBe(19);
    expect(loaded["buys"]).toBe(5); // ۶ سند — یک خرید آژانسی رد شد (گزارش شده)
    expect(loaded["jobs"]).toBe(1);
    expect(loaded["moves"]).toBe(70);

    // --- جداول مشتق‌شده ---
    expect(loaded["users"]).toBe(8);
    expect(loaded["roles"]).toBe(7);
    expect(loaded["userRoles"]).toBe(8);
    expect(loaded["products"]).toBe(46);
    expect(loaded["materials"]).toBe(16);
    expect(loaded["suppliers"]).toBe(7);
    expect(loaded["bom"]).toBe(210);
    expect(loaded["lists"]).toBe(7);
    expect(loaded["settings"]).toBe(1);
    expect(loaded["phones"]).toBe(23);
    expect(loaded["contacts"]).toBe(21);
    expect(loaded["interests"]).toBe(23);
    expect(loaded["followups"]).toBe(84 + 29); // hist + next
    expect(loaded["items"]).toBe(20);
    expect(loaded["payments"]).toBe(7);
    expect(loaded["cheques"]).toBe(9);
    expect(loaded["stageLogs"]).toBe(83);
    expect(loaded["handoffs"]).toBe(3);
    expect(loaded["buyItems"]).toBe(9); // ۱۱ سطر — ۲ سطر خرید آژانسی رد شد
    expect(loaded["buyCheques"]).toBe(4);
    expect(loaded["buyStatusLogs"]).toBe(14 - 2); // log خرید آژانسی رد شد

    // --- شمارش تطبیقی: اختلاف خرید آژانسی یک ردیف گزارش می‌شود ---
    const buyDiff = report.verification.countDiffs.find((d) => d.collection === "buys");
    expect(buyDiff).toEqual({ collection: "buys", expected: 6, actual: 5 });

    // --- نمونه‌گیری ۱۰٪: همه نمونه‌ها تطابق دارند ---
    const mismatched = report.verification.sampling.filter((s) => !s.matched);
    expect(mismatched, JSON.stringify(mismatched)).toEqual([]);
    expect(report.verification.samplingCoverage).toBeGreaterThan(0.09);
  });

  it("R-12: آخرین شماره هر series در Rev ثبت و ادامه series درست است", async () => {
    const revs = await prisma.rev.findMany({ where: { key: { startsWith: "seq:" } } });
    const map = new Map(revs.map((r) => [r.key, r.value]));
    expect(map.get("seq:AC")).toBe(222);
    expect(map.get("seq:LD")).toBe(1032);
    expect(map.get("seq:PF")).toBe(1219);
    expect(map.get("seq:BY")).toBe(306);
    expect(map.get("seq:PJ")).toBe(501);
    expect(map.get("seq:TR")).toBe(1210);

    const { nextPrefixedId } = await import("@core/database");
    const orderIds = (await prisma.order.findMany({ select: { id: true } })).map((o) => o.id);
    expect(nextPrefixedId("PF", orderIds)).toBe("PF-1220");
    const leadIds = (await prisma.lead.findMany({ select: { id: true } })).map((l) => l.id);
    expect(nextPrefixedId("LD", leadIds)).toBe("LD-1033");
    const accountIds = (await prisma.account.findMany({ select: { id: true } })).map((a) => a.id);
    expect(nextPrefixedId("AC", accountIds)).toBe("AC-223");
  });

  it("noMoney: نقش‌های بدون money.view مبلغی در داده بارگذاری‌شده ندارند (R-32 روی مهاجرت)", async () => {
    // کاتالوگ محصول/ماده قیمت عمومی دارد — فیلتر پولی روی جزئیات سفارش
    // اعمال می‌شود (getOrder با hideMoney = true).
    const { getOrder } = await import("@modules/orders/services/order.service");
    const order = await getOrder("PF-1201", true);
    expect((order as Record<string, unknown>)["calc"]).toBeUndefined();
    expect((order as Record<string, unknown>)["paid"]).toBeUndefined();
    const items = (order as { items: Array<Record<string, unknown>> }).items;
    expect(items.every((i) => !("price" in i))).toBe(true);
  });

  it("داده‌های نمونه: سفارش PF-1213 با مراحل پرش‌شده درست بارگذاری شده", async () => {
    const order = await prisma.order.findUnique({ where: { id: "PF-1213" } });
    expect(order).not.toBeNull();
    expect(order!.skipped).toEqual([6, 7, 8]);
    expect(order!.preset).toBe("custom");
    const planBuilder = order!.planBuilder as Record<string, unknown> | null;
    expect(planBuilder).toBeNull(); // Demo مقدار pb ندارد — اسناد دیگر ممکن است داشته باشند
    const logs = await prisma.orderStageLog.findMany({ where: { orderId: "PF-1213" }, orderBy: { at: "asc" } });
    expect(logs).toHaveLength(9);
    expect(logs.some((l) => l.kind === "skip")).toBe(true);
    // سه چک ناقص (بدون sayad) بارگذاری شده‌اند
    const cheques = await prisma.orderCheque.findMany({ where: { orderId: "PF-1213" } });
    expect(cheques).toHaveLength(3);
    expect(cheques.filter((c) => c.sayad === "").length).toBe(3);
  });

  it("PF-1217: planBuilder برنامه سفارشی منتقل شده", async () => {
    const order = await prisma.order.findUnique({ where: { id: "PF-1217" } });
    expect(order!.planBuilder).toMatchObject({ pre: 30, rest: "cheque", n: 3 });
  });

  it("کاربر sys: ارجاع Followup به null و گزارش شده (بدون FK شکسته)", async () => {
    const followups = await prisma.leadFollowup.findMany({ where: { leadId: "LD-1031" }, orderBy: { at: "asc" } });
    expect(followups).toHaveLength(6); // ۵ hist + ۱ next
    const sysEntry = followups.filter((f) => f.note.includes("خرید قطعی"));
    expect(sysEntry).toHaveLength(1);
    expect(sysEntry[0]!.byUserId).toBeNull();
  });

  it("گزارش Markdown نوشته می‌شود و شمارش‌های اصلی را دارد", async () => {
    if (run === null) throw new Error("بارگذاری انجام نشده است");
    const markdown = run.markdown;
    writeFileSync(REPORT_OUT, markdown, "utf-8");
    const written = readFileSync(REPORT_OUT, "utf-8");
    expect(written).toContain("MIGRATION_REPORT");
    expect(written).toContain("| accounts | 23 | 23 |");
    expect(written).toContain("| buys | 6 | 5 |");
    expect(written).toContain("BY-303");
    expect(written).toContain("barman1405");
  });

  it("دروازه ۴ — مهاجرت معکوس: خروجی ZIP برنامه جدید با ابزار مهاجرت خوانده می‌شود", async () => {
    const { buildSnapshot } = await import("@modules/export/services/snapshot.service");
    const { snapshotEntries, zipOf } = await import("@modules/export/services/zip");
    const { extractZipToTemp, cleanupExtracted } = await import("./zip");
    const { extractData } = await import("./extract");

    const snapshot = await buildSnapshot();
    const zip = zipOf(snapshotEntries(snapshot));
    const zipPath = join(tempDir, "barman-export.zip");
    writeFileSync(zipPath, zip);

    const extracted = extractZipToTemp(zipPath);
    try {
      const { snapshot: snapshot2, report } = extractData(extracted);
      expect(report.invalidJson).toEqual([]);
      // چیدمان پوشه data: همان شمارش ردیف‌های پایگاه داده
      expect(snapshot2.docs.accounts).toHaveLength(23);
      expect(snapshot2.docs.leads).toHaveLength(29);
      expect(snapshot2.docs.orders).toHaveLength(19);
      expect(snapshot2.docs.buys).toHaveLength(5);
      expect(snapshot2.docs.jobs).toHaveLength(1);
      expect(snapshot2.docs.moves).toHaveLength(70);
      // seq-*.txt بازنویسی شده‌اند
      const seqEntries = Object.keys(snapshot2.seq).filter((k) => snapshot2.seq[k] !== undefined);
      expect(seqEntries.sort()).toEqual(["AC", "BY", "LD", "PF", "PJ"].sort());
    } finally {
      cleanupExtracted(extracted);
    }
  });
});

/** خواننده ردیف پایگاه داده — برای صحه‌گذاری نمونه‌گیری (مرحله ۷). */
async function makeReader(prisma: PrismaClient) {
  return {
    account: (id: string) =>
      prisma.account.findUnique({ where: { id }, select: { name: true, kind: true, createdAt: true } }) as never,
    lead: (id: string) =>
      prisma.lead.findUnique({
        where: { id },
        select: { accountId: true, line: true, stage: true, title: true, amount: true, source: true, createdAt: true, updatedAt: true },
      }) as never,
    order: (id: string) =>
      prisma.order.findUnique({
        where: { id },
        select: {
          accountId: true, contactId: true, leadId: true, line: true, stage: true, status: true,
          validDays: true, discPct: true, createdAt: true, stageAt: true, due: true,
        },
      }) as never,
    buy: (id: string) =>
      prisma.buy.findUnique({ where: { id }, select: { supplierId: true, status: true, total: true, createdAt: true } }) as never,
    move: (id: string) =>
      prisma.move.findUnique({ where: { id }, select: { wh: true, item: true, qty: true, kind: true, ref: true, at: true } }) as never,
  };
}
