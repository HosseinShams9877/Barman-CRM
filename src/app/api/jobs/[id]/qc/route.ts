/**
 * /api/jobs/[id]/qc — ثبت کنترل کیفیت (PHASE_05 §۳.۷/§۷).
 *
 * الگوی ۵ مرحله‌ای CD-04. مجوز: production.edit.
 * repr: data-jqc در Demo (app/prod.js:124) — good/waste + qcAt + sent.
 *
 * قانون `good + waste ≤ qty` در سرور اجرا می‌شود (دروازه خروج ۳) —
 * پیام فارسی: «مجموع سالم و ضایعات نمی‌تواند بیشتر از مقدار کار باشد».
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission } from "@core/permissions";
import { faErrorMap, parseOrFail } from "@core/validation";
import { jobIdParamSchema, qcSchema } from "@modules/production/schemas/job.schema";
import { qcJob } from "@modules/production/services/job.service";

/** POST /api/jobs/[id]/qc — qc → sent با ثبت good/waste. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "production.edit");

    // ۳) اعتبارسنجی — params و بدنه (پیام فارسی — CD-28)
    const { id } = parseOrFail(jobIdParamSchema, await ctx.params, faErrorMap);
    const input = parseOrFail(qcSchema, await readJsonBody(req), faErrorMap);

    // ۴) سرویس — قانون جمع سالم و ضایعات اینجا اجرا می‌شود
    const job = await qcJob(id, input, { userId: session.userId, roles: session.roles });

    // ۵) پاسخ
    return NextResponse.json(job, { status: 200 });
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
