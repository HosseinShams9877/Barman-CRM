/**
 * /api/leads/import — واردات دسته‌ای سرنخ‌ها از CSV (PHASE_03 §۳.۷ / §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: POST → leads.import (CD-23).
 *
 * تخصیص سرنخ‌های واردشده به کاربر دیگری نیازمند leads.assign است.
 * پاسخ همیشه ۲۰۰ با گزارش ردیف‌به‌ردیف است (A-3.x درگاه خروج ۴)؛
 * ردیف‌های نامعتبر در `rows` با پیام فارسی مشخص می‌شوند.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission } from "@core/permissions";
import {
  parseOrFail,
  faErrorMap,
} from "@core/validation";
import { importLeadsSchema } from "@modules/leads/schemas/import.schema";
import { importLeads } from "@modules/leads/services/lead.service";

/** POST /api/leads/import — ذخیره ردیف‌های معتبر و گزارش همه ردیف‌ها. */
export async function POST(req: Request): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "leads.import");

    // ۳) اعتبارسنجی — بدنه JSON
    const raw = await readJsonBody(req);
    const input = parseOrFail(importLeadsSchema, raw, faErrorMap);

    // تخصیص به کاربر دیگر نیازمند leads.assign است (CD-23)
    if (input.ownerId !== undefined && input.ownerId !== session.userId) {
      requirePermission(session, "leads.assign");
    }

    // ۴) سرویس — اعتبارسنجی ردیف‌ها و ساخت در یک تراکنش
    const result = await importLeads(input, session.userId);

    // ۵) پاسخ — حتی با ردیف‌های نامعتبر، گزارش ۲۰۰ است
    return NextResponse.json(result, { status: 200 });
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
