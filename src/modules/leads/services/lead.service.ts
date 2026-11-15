/**
 * سرویس سرنخ‌ها — منطق کسب‌وکار (CD-04 گام ۴ / CD-02 / PHASE_03 §۵).
 *
 * قوانین کسب‌کار (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - شماره سرنخ جدید باید نرمال‌شده ۱۱ رقم و آغازشده با ۰ باشد
 *    (app/lead-core.js:54).
 *  - شماره تکراری بین **همه** حساب‌ها پذیرفته نمی‌شود → ۴۰۹ با پیام Demo
 *    (app/leads.js:334: «این شماره قبلاً ثبت شده؛ سرنخ تکراری ساخته نمی‌شود»).
 *  - سرنخ جدید: حساب ناشناس (kind = unknown) + مرحله raw + رویداد ورود
 *    با kind = "in" و متن «ورود شماره — منبع: …» (app/lead-core.js:57-61).
 *  - جابه‌جایی مرحله یک رویداد kind = "stage" با متن
 *    «<از> ← <به> — <دلیل>» ثبت می‌کند (app/lead-core.js:73).
 *  - ورود به lost نیازمند دلیل است و مرحله قبل در lostFrom ذخیره می‌شود
 *    (app/leads.js:474-475).
 *  - بازگرداندن سرنخ lost به lostFrom (یا opp اگر lostFrom برابر pf باشد)
 *    با پاک‌کردن دلیل (app/leads.js:539).
 *  - مبلغ تخمینی قبل از ذخیره به ۱۰۰٬۰۰۰ گرد می‌شود (R-08).
 *  - محدوده دید نقش sales: فقط سرنخ‌های خودش — فیلتر در سرور
 *    (PHASE_03 §۸ / app/leads.js:15: ALLV = R !== "sales").
 *
 * تفاوت‌های مستند با Demo:
 *  - بورد Demo قابل تنظیم توسط کاربر بود (COLS0/leadCols — app/lead-core.js:76).
 *    فاز ۳ ستون‌های ثابت ۵‌گانه را پیاده می‌کند (PHASE_03 §۱۰)؛ ستون‌های
 *    سفارشی جزو دامنه نیست.
 *  - در Demo جابه‌جایی مرحله از روی نتیجه پیگیری با بازشدن دیالوگ تأیید
 *    انجام می‌شد (app/leads.js:414-417)؛ در فاز ۳ جابه‌جایی فقط از طریق
 *    PATCH صریح صورت می‌گیرد (R-30).
 */
import { z } from "zod";
import { prisma } from "@core/database/client";
import { nextPrefixedId, SEQ_START } from "@core/database";
import { conflict, notFound } from "@core/errors";
import { isValidIranPhone, normalizePhone, roundToStep } from "@core/formatting";
import type { Prisma } from "@prisma/client";
import { stageLabel } from "../constants/STAGE";
import type { LeadStageKey } from "../constants/STAGE";
export { reviveTarget } from "../constants/STAGE";
import type { LeadLineKey } from "../constants/LINE";
import { LEAD_SOURCES } from "../constants/lists";
import type {
  FollowupRow,
  LeadDetail,
  LeadListItem,
  LeadListResult,
} from "../types/lead.types";
import {
  createLeadSchema,
  listLeadsQuerySchema,
  moveStageSchema,
  updateLeadSchema,
} from "../schemas/lead.schema";
import { importLeadsSchema } from "../schemas/import.schema";
import type { ImportResult, ImportRowResult } from "../schemas/import.schema";

type CreateInput = z.infer<typeof createLeadSchema>;
type UpdateInput = z.infer<typeof updateLeadSchema>;
type ListQuery = z.infer<typeof listLeadsQuerySchema>;
type MoveInput = z.infer<typeof moveStageSchema>;
type ImportInput = z.infer<typeof importLeadsSchema>;

/**
 * محدوده دید لیست سرنخ‌ها — توسط Route Handler از مجوز `leads.viewAll`
 * ساخته می‌شود (CD-04: منبع حقیقت سرور است، نه کلاینت).
 */
export type LeadListScope = {
  /** true یعنی کاربر فقط سرنخ‌های خودش را می‌بیند (نقش sales). */
  restrictToOwner: boolean;
  userId: string;
};

type LeadRow = Prisma.LeadGetPayload<{
  include: {
    account: { include: { phones: { select: { number: true } }; contacts: { select: { name: true; phone: true } } } };
    owner: { select: { name: true } };
  };
}>;

/** تبدیل رکورد Prisma به آیتم لیست — مهر زمان‌ها به UTC ms (CD-07). */
function toListItem(row: LeadRow, nextAt: string | null): LeadListItem {
  const a = row.account;
  return {
    id: row.id,
    line: row.line as LeadLineKey,
    stage: row.stage as LeadStageKey,
    title: row.title,
    amount: row.amount,
    source: row.source,
    note: row.note,
    accountId: row.accountId,
    account: a ? { phones: a.phones.map((p) => p.number), name: a.name } : null,
    ownerId: row.ownerId,
    ownerName: row.owner?.name ?? null,
    lostReason: row.lostReason,
    lostFrom: row.lostFrom as LeadStageKey | null,
    nextAt,
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
  };
}

/**
 * آخرین تاریخ پیگیری بعدی به ازای هر سرنخ — `distinct` روی leadId با
 * ترتیب نزولی `at`، یعنی جدیدترین رویداد هر سرنخ ملاک است.
 */
async function nextAtMap(leadIds: string[]): Promise<Map<string, string>> {
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

/**
 * لیست سرنخ‌ها — فیلتر خط/مرحله/کارشناس + جستجو + صفحه‌بندی.
 *
 * جستجو روی نام حساب، شماره‌ها، مخاطبان و شناسه سرنخ انجام می‌شود
 * (app/leads.js:45-47). نقش sales محدود به سرنخ‌های خودش می‌شود.
 */
export async function listLeads(query: ListQuery, scope: LeadListScope): Promise<LeadListResult> {
  const where: Prisma.LeadWhereInput = {};
  if (query.line) where.line = query.line;
  if (query.stage) where.stage = query.stage;
  if (scope.restrictToOwner) {
    where.ownerId = scope.userId;
  } else if (query.ownerId) {
    where.ownerId = query.ownerId;
  }
  if (query.q.length > 0) {
    where.OR = [
      { id: { contains: query.q } },
      { account: { name: { contains: query.q } } },
      { account: { phones: { some: { number: { contains: query.q } } } } },
      { account: { contacts: { some: { name: { contains: query.q } } } } },
      { account: { contacts: { some: { phone: { contains: query.q } } } } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        account: { include: { phones: { select: { number: true } }, contacts: { select: { name: true, phone: true } } } },
        owner: { select: { name: true } },
      },
    }),
  ]);

  const nextAt = await nextAtMap(rows.map((r) => r.id));

  return {
    items: rows.map((r) => toListItem(r, nextAt.get(r.id) ?? null)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/** سرنخ کامل با تاریخچه و محصولات موردنظر — ۴۰۴ اگر نبود. */
export async function getLead(id: string): Promise<LeadDetail> {
  const row = await prisma.lead.findUnique({
    where: { id },
    include: {
      account: { include: { phones: { select: { number: true } }, contacts: { select: { name: true, phone: true } } } },
      owner: { select: { name: true } },
      followups: { orderBy: [{ at: "desc" }] },
      interest: { select: { productId: true } },
    },
  });
  if (!row) throw notFound("سرنخ مورد نظر پیدا نشد.");

  const byNames = await ownerNamesByUserId(row.followups.map((f) => f.byUserId).filter((x): x is string => x !== null));

  return {
    ...toListItem(row, null),
    followups: row.followups.map((f) => ({
      id: f.id,
      at: Number(f.at),
      kind: f.kind,
      result: f.result,
      note: f.note,
      nextAt: f.nextAt,
      byUserId: f.byUserId,
      byName: f.byUserId ? byNames.get(f.byUserId) ?? null : null,
    })),
    interest: row.interest.map((i) => i.productId),
  };
}

/** نقشه userId → نام کاربر (برای `byName` در تاریخچه). */
async function ownerNamesByUserId(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(userIds)] } },
    select: { id: true, name: true },
  });
  for (const u of users) map.set(u.id, u.name);
  return map;
}

/**
 * ایجاد سرنخ — حساب ناشناس جدید + مرحله raw + رویداد ورود (lead-core.js:52).
 *
 * شماره نرمال‌شده باید یکتا باشد؛ در غیر این صورت ۴۰۹ با پیام Demo
 * (leads.js:334). شناسه‌ها `AC-<n>` و `LD-<n>` (app/core.js:365).
 */
export async function createLead(input: CreateInput, byUserId: string): Promise<LeadDetail> {
  const phone = normalizePhone(input.phone);

  const dup = await prisma.accountPhone.findFirst({
    where: { number: phone },
    select: { accountId: true },
  });
  if (dup) {
    throw conflict("این شماره قبلاً ثبت شده؛ سرنخ تکراری ساخته نمی‌شود.");
  }

  const accountIds = await prisma.account.findMany({ select: { id: true } });
  const accountId = nextPrefixedId("AC", accountIds.map((a) => a.id));
  const leadIds = await prisma.lead.findMany({ select: { id: true } });
  const leadId = nextPrefixedId("LD", leadIds.map((l) => l.id));
  const now = Date.now();
  const ownerId = input.ownerId ?? byUserId;

  await prisma.$transaction(async (tx) => {
    await tx.account.create({
      data: {
        id: accountId,
        name: "",
        kind: "unknown",
        active: true,
        address: "",
        note: "",
        createdAt: now,
        updatedAt: now,
        phones: { create: [{ kind: "", number: phone }] },
      },
    });
    await tx.lead.create({
      data: {
        id: leadId,
        accountId,
        line: input.line,
        stage: "raw",
        title: input.title,
        amount: input.amount === null || input.amount === undefined ? null : roundToStep(input.amount),
        ownerId,
        source: input.source,
        note: input.note,
        createdAt: now,
        updatedAt: now,
      },
    });
    await tx.leadFollowup.create({
      data: {
        leadId,
        at: now,
        kind: "in",
        result: "",
        note: `ورود شماره — منبع: ${input.source}`,
        byUserId,
      },
    });
  });

  return getLead(leadId);
}

/**
 * ویرایش سرنخ — فیلدهای ارسالی `undefined` یعنی «تغییر نده».
 *
 * `ownerId` فقط با مجوز `leads.assign` قابل تغییر است (CD-23) — بررسی
 * مجوز در Route Handler انجام می‌شود.
 */
export async function updateLead(id: string, input: UpdateInput): Promise<LeadDetail> {
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) throw notFound("سرنخ مورد نظر پیدا نشد.");

  await prisma.lead.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.amount !== undefined
        ? { amount: input.amount === null ? null : roundToStep(input.amount) }
        : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
      updatedAt: Date.now(),
    },
  });

  return getLead(id);
}

/**
 * جابه‌جایی مرحله سرنخ — رویداد kind = "stage" با مهر زمان ثبت می‌کند
 * (app/lead-core.js:73: «<از> ← <به> — <دلیل>»).
 *
 * ورود به lost نیازمند دلیل است (اعتبارسنجی در Zod) و مرحله قبل در
 * `lostFrom` ذخیره می‌شود (app/leads.js:475). خروج از lost (بازگرداندن)
 * دلیل و مرحله قبل را پاک می‌کند (app/leads.js:539).
 *
 * @param byUserId کاربری که جابه‌جایی را انجام داده (برای رویداد تاریخچه).
 */
export async function moveLeadStage(
  id: string,
  input: MoveInput,
  byUserId: string,
): Promise<LeadDetail> {
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) throw notFound("سرنخ مورد نظر پیدا نشد.");

  const from = existing.stage as LeadStageKey;
  const to = input.to;
  if (from === to) return getLead(id);

  const now = Date.now();
  const reason = input.lostReason ?? input.reason ?? "";
  const note = `${stageLabel(from)} ← ${stageLabel(to)}${reason.length > 0 ? " — " + reason : ""}`;

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id },
      data: {
        stage: to,
        updatedAt: now,
        ...(to === "lost"
          ? { lostReason: input.lostReason ?? null, lostFrom: from }
          : from === "lost"
            ? { lostReason: null, lostFrom: null }
            : {}),
      },
    });
    await tx.leadFollowup.create({
      data: {
        leadId: id,
        at: now,
        kind: "stage",
        result: "",
        note,
        byUserId,
      },
    });
  });

  return getLead(id);
}

/**
 * مرحله‌هدف برای بازگرداندن یک سرنخ lost — قانون Demo:
 * `lostFrom` مگر اینکه pf باشد، که در آن حالت opp (app/leads.js:539).
 *
 * تعریف در `constants/STAGE.ts`؛ این re-export برای مصرف سرویس‌محور است.
 */

/* ---------------- ورود گروهی (CSV) — PHASE_03 §۳.۷ ---------------- */

type CsvRow = {
  /** شماره خط در فایل (بدون احتساب سرتیتر). */
  row: number;
  phoneRaw: string;
  source: string;
  line: LeadLineKey;
  title: string;
  note: string;
};

/** ستون‌های شناسایی‌شده در سرتیتر CSV — کلیدهای کوچک‌شده. */
const COLUMN_KEYS = ["phone", "source", "line", "title", "note"] as const;

/**
 * تجزیه متن CSV — سرتیتر اجباری، جداکننده ویرگول.
 *
 * مقادیر داخل کوتیشن پشتیبانی نمی‌شوند (دمو-only ساده‌سازی، R-30):
 * فیلدها روی `,` شکسته و trim می‌شوند. خطوط خالی نادیده گرفته می‌شوند.
 */
function parseCsv(csv: string): { headerFound: boolean; rows: CsvRow[] } {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { headerFound: false, rows: [] };

  const first = lines[0];
  if (first === undefined) return { headerFound: false, rows: [] };
  const header = first
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0);
  const phoneIdx = header.indexOf("phone");
  if (phoneIdx < 0) return { headerFound: false, rows: [] };

  const idx = (key: string): number => {
    const i = header.indexOf(key);
    return i < 0 ? -1 : i;
  };
  const sourceIdx = idx("source");
  const lineIdx = idx("line");
  const titleIdx = idx("title");
  const noteIdx = idx("note");

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined) continue;
    const cells = line.split(",").map((c) => c.trim());
    const at = (k: number): string => (k >= 0 && k < cells.length ? cells[k] ?? "" : "");
    rows.push({
      row: i,
      phoneRaw: at(phoneIdx),
      source: at(sourceIdx),
      line: at(lineIdx) === "agency" ? "agency" : "prod",
      title: at(titleIdx).slice(0, 192),
      note: at(noteIdx).slice(0, 2048),
    });
  }
  return { headerFound: true, rows };
}

/**
 * واردات دسته‌ای سرنخ‌ها از CSV — PHASE_03 §۳.۷ / §۷ (`leads.import`).
 *
 * همه ردیف‌ها ابتدا اعتبارسنجی می‌شوند (شماره، منبع، تکرار درون‌فایلی)،
 * سپس شماره‌های باقی‌مانده یک‌جا در برابر پایگاه داده بررسی می‌شوند و
 * ردیف‌های معتبر در یک تراکنش ساخته می‌شوند. هر ردیف گزارش فارسی مختص
 * به خود را برمی‌گرداند (A-3.x / درگاه خروج ۴).
 *
 * اگر برچسب ستون پیدا نشود، کل فایل رد می‌شود (یک پیام خطا).
 */
export async function importLeads(
  input: ImportInput,
  byUserId: string,
): Promise<ImportResult> {
  const parsed = parseCsv(input.csv);
  if (!parsed.headerFound) {
    return {
      created: 0,
      failed: 1,
      rows: [
        {
          row: 1,
          phone: "",
          ok: false,
          error: "ستون phone در سرتیتر CSV پیدا نشد (phone, source, line, title, note).",
        },
      ],
    };
  }

  const ownerId = input.ownerId ?? byUserId;
  const results: ImportRowResult[] = [];
  const valid: CsvRow[] = [];

  const phoneSeen = new Set<string>();
  for (const r of parsed.rows) {
    const phone = normalizePhone(r.phoneRaw);
    const base: ImportRowResult = { row: r.row, phone: r.phoneRaw, ok: false };
    if (!isValidIranPhone(phone)) {
      results.push({ ...base, error: "شماره را کامل و درست وارد کنید (مثلاً ۰۹۱۲۱۲۳۴۵۶۷)." });
      continue;
    }
    if (r.source.length === 0 || !(LEAD_SOURCES as readonly string[]).includes(r.source)) {
      results.push({ ...base, error: "منبع ورود را انتخاب کنید؛ برای گزارش لازم است." });
      continue;
    }
    if (phoneSeen.has(phone)) {
      results.push({ ...base, error: "این شماره در همین فایل تکرار شده است." });
      continue;
    }
    phoneSeen.add(phone);
    valid.push(r);
  }

  if (valid.length > 0) {
    const dupPhones = await prisma.accountPhone.findMany({
      where: { number: { in: valid.map((r) => normalizePhone(r.phoneRaw)) } },
      select: { number: true },
    });
    const dupSet = new Set(dupPhones.map((d) => d.number));

    const toCreate = valid.filter((r) => !dupSet.has(normalizePhone(r.phoneRaw)));
    for (const r of valid.filter((r) => dupSet.has(normalizePhone(r.phoneRaw)))) {
      results.push({
        row: r.row,
        phone: r.phoneRaw,
        ok: false,
        error: "این شماره قبلاً ثبت شده؛ سرنخ تکراری ساخته نمی‌شود.",
      });
    }

    if (toCreate.length > 0) {
      const accountIds = await prisma.account.findMany({ select: { id: true } });
      const leadIds = await prisma.lead.findMany({ select: { id: true } });
      let acSeq = maxSeq("AC", accountIds.map((a) => a.id));
      let ldSeq = maxSeq("LD", leadIds.map((l) => l.id));
      const now = Date.now();

      await prisma.$transaction(async (tx) => {
        for (const r of toCreate) {
          acSeq += 1;
          ldSeq += 1;
          const accountId = `AC-${acSeq}`;
          const leadId = `LD-${ldSeq}`;
          const phone = normalizePhone(r.phoneRaw);
          await tx.account.create({
            data: {
              id: accountId,
              name: "",
              kind: "unknown",
              active: true,
              address: "",
              note: "",
              createdAt: now,
              updatedAt: now,
              phones: { create: [{ kind: "", number: phone }] },
            },
          });
          await tx.lead.create({
            data: {
              id: leadId,
              accountId,
              line: r.line,
              stage: "raw",
              title: r.title,
              amount: null,
              ownerId,
              source: r.source,
              note: r.note,
              createdAt: now,
              updatedAt: now,
            },
          });
          await tx.leadFollowup.create({
            data: {
              leadId,
              at: now,
              kind: "in",
              result: "",
              note: `ورود شماره — منبع: ${r.source}`,
              byUserId,
            },
          });
          results.push({ row: r.row, phone: r.phoneRaw, ok: true });
        }
      });
    }
  }

  results.sort((a, b) => a.row - b.row);
  return {
    created: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    rows: results,
  };
}

/** بزرگترین شماره سریال موجود برای پیشوند (یا SEQ_START از ids.ts). */
function maxSeq(prefix: string, ids: string[]): number {
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = SEQ_START[prefix] ?? 100;
  for (const id of ids) {
    const m = re.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}
