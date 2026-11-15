/**
 * سرویس پیگیری سرنخ‌ها («چی شد؟») — منطق کسب‌وکار (CD-04 گام ۴ / PHASE_03 §۵/§۹).
 *
 * قوانین کسب‌کار (با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - هر پیگیری یک رویداد در تاریخچه سرنخ با مهر زمان UTC ms ثبت می‌کند
 *    (app/lead-core.js:72: hist).
 *  - نتیجه یا یادداشت حداقل یکی باید پر باشد (برابر با اعتبارسنجی
 *    دیالوگ «چی شد؟» در app/leads.js:۳۹۳-۳۹۹).
 *  - تاریخ پیگیری بعدی به‌صورت خالص شمسی `YYYY/MM/DD` ارقام ASCII ذخیره
 *    می‌شود (CD-06)؛ ورودی فارسی‌رقم پذیرفته و استاندارد می‌شود.
 *
 * تفاوت مستند با Demo (R-30): در Demo نتیجه «خرید کرد ✓» یا تیک
 * «نمی‌خرد» سرنخ را به won/lost منتقل می‌کرد (app/leads.js:414-417)؛
 * در فاز ۳ این جابه‌جایی‌ها فقط از طریق PATCH صریح مرحله انجام می‌شود
 * و پیگیری‌ها kind = "note" دارند. راه ارتباطی پیگیری (تلفن/پیام/حضوری)
 * در مدل فاز ۳ جایی ندارد (LeadFollowup.kind نوع رویداد است).
 */
import { z } from "zod";
import { prisma } from "@core/database/client";
import { notFound } from "@core/errors";
import { formatJalaliIso, parseJalali } from "@core/calendar";
import { createFollowupSchema } from "../schemas/lead.schema";
import type { FollowupRow } from "../types/lead.types";

type AddInput = z.infer<typeof createFollowupSchema>;

/** سرنخ باید وجود داشته باشد — در غیر این صورت ۴۰۴. */
async function requireLead(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) throw notFound("سرنخ مورد نظر پیدا نشد.");
}

/** نقشه userId → نام کاربر (برای `byName` در ردیف‌های تاریخچه). */
async function byNamesByUserId(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(userIds)] } },
    select: { id: true, name: true },
  });
  for (const u of users) map.set(u.id, u.name);
  return map;
}

/** تبدیل رکورد Prisma به ردیف تاریخچه — مهر زمان به UTC ms (CD-07). */
function toRow(f: {
  id: string;
  at: bigint;
  kind: string;
  result: string;
  note: string;
  nextAt: string | null;
  byUserId: string | null;
  byName: string | null;
}): FollowupRow {
  return {
    id: f.id,
    at: Number(f.at),
    kind: f.kind,
    result: f.result,
    note: f.note,
    nextAt: f.nextAt,
    byUserId: f.byUserId,
    byName: f.byName,
  };
}

/** تاریخچه پیگیری یک سرنخ — جدیدترین ابتدا. */
export async function listFollowups(leadId: string): Promise<FollowupRow[]> {
  await requireLead(leadId);

  const rows = await prisma.leadFollowup.findMany({
    where: { leadId },
    orderBy: [{ at: "desc" }],
  });
  const names = await byNamesByUserId(rows.map((r) => r.byUserId).filter((x): x is string => x !== null));

  return rows.map((f) => toRow({ ...f, byName: f.byUserId ? names.get(f.byUserId) ?? null : null }));
}

/**
 * ثبت پیگیری جدید — kind = "note" با مهر زمان حال.
 *
 * `nextAt` ورودی (احتمالاً با ارقام فارسی) parse و دوباره به قالب قرارداد
 * `YYYY/MM/DD` ارقام ASCII قالب‌بندی می‌شود (CD-06 — رفت‌وبرگشت تقویم).
 */
export async function addFollowup(
  leadId: string,
  input: AddInput,
  byUserId: string,
): Promise<FollowupRow> {
  await requireLead(leadId);

  const now = Date.now();
  let nextAt: string | null = null;
  if (input.nextAt) {
    const parsed = parseJalali(input.nextAt);
    if (parsed) nextAt = formatJalaliIso(parsed);
  }

  const f = await prisma.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: leadId }, data: { updatedAt: now } });
    return tx.leadFollowup.create({
      data: {
        leadId,
        at: now,
        kind: "note",
        result: input.result,
        note: input.note,
        nextAt,
        byUserId,
      },
    });
  });

  const byName = await byNamesByUserId([byUserId]);
  return toRow({ ...f, byName: byName.get(byUserId) ?? null });
}
