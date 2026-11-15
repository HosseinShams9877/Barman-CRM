/**
 * /api/jobs/[id] — جزئیات و گذار وضعیت کار تولید (PHASE_05 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04. مجوزها: GET → production.view،
 * PATCH → production.edit (CD-26 dotted).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission } from "@core/permissions";
import { faErrorMap, parseOrFail } from "@core/validation";
import { jobIdParamSchema, updateJobSchema } from "@modules/production/schemas/job.schema";
import { getJob, updateJob } from "@modules/production/services/job.service";

/** GET /api/jobs/[id] — جزئیات کار با پیش‌نمایش BOM ذخیره‌شده. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "production.view");

    // ۳) اعتبارسنجی — params
    const { id } = parseOrFail(jobIdParamSchema, await ctx.params, faErrorMap);

    // ۴) سرویس
    const job = await getJob(id);

    // ۵) پاسخ
    return NextResponse.json(job, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** PATCH /api/jobs/[id] — گذار وضعیت طبق state machine (run → qc). */
export async function PATCH(
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
    const input = parseOrFail(updateJobSchema, await readJsonBody(req), faErrorMap);

    // ۴) سرویس — محدودیت گذار اینجا اجرا می‌شود
    const job = await updateJob(id, input, { userId: session.userId, roles: session.roles });

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
