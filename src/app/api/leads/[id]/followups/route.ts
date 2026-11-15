/**
 * /api/leads/[id]/followups — تاریخچه و ثبت پیگیری سرنخ (PHASE_03 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: GET → leads.view، POST → leads.edit (CD-23).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission } from "@core/permissions";
import {
  idParamSchema,
  parseOrFail,
  faErrorMap,
} from "@core/validation";
import { createFollowupSchema } from "@modules/leads/schemas/lead.schema";
import { addFollowup, listFollowups } from "@modules/leads/services/followup.service";

/** GET /api/leads/[id]/followups — تاریخچه پیگیری به ترتیب جدیدترین. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "leads.view");

    // ۳) اعتبارسنجی — پارامتر مسیر
    const { id } = parseOrFail(idParamSchema, await ctx.params, faErrorMap);

    // ۴) سرویس
    const rows = await listFollowups(id);

    // ۵) پاسخ
    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** POST /api/leads/[id]/followups — ثبت پیگیری («چی شد؟») با تاریخ پیگیری بعدی. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "leads.edit");

    // ۳) اعتبارسنجی — پارامتر مسیر + بدنه
    const { id } = parseOrFail(idParamSchema, await ctx.params, faErrorMap);
    const raw = await readJsonBody(req);
    const input = parseOrFail(createFollowupSchema, raw, faErrorMap);

    // ۴) سرویس — canonicalسازی nextAt در اینجا انجام می‌شود (CD-06)
    const row = await addFollowup(id, input, session.userId);

    // ۵) پاسخ
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** خواندن بدنه JSON با مدیریت بدنه خالی/نامعتبر (۴۰۰). */
async function readJsonBody(req: Request): Promise<unknown> {
  try {
    const text = await req.text();
    return text.length === 0 ? {} : JSON.parse(text);
  } catch {
    return {};
  }
}
