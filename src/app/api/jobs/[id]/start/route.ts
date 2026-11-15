/**
 * /api/jobs/[id]/start — شروع تولید با کسر مواد (PHASE_05 §۳.۶/§۷).
 *
 * الگوی ۵ مرحله‌ای CD-04. مجوز: production.edit.
 * repr: data-jstart در Demo (app/prod.js:121-122) — guard کسری BOM،
 * سپس حرکت‌های `use` در همان تراکنش با انتقال وضعیت.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission } from "@core/permissions";
import { faErrorMap, parseOrFail } from "@core/validation";
import { jobIdParamSchema } from "@modules/production/schemas/job.schema";
import { startJob } from "@modules/production/services/job.service";

/** POST /api/jobs/[id]/start — plan → run + حرکت‌های use. */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "production.edit");

    // ۳) اعتبارسنجی — params
    const { id } = parseOrFail(jobIdParamSchema, await ctx.params, faErrorMap);

    // ۴) سرویس — guard موجودی و کسر مواد اینجا اجرا می‌شود
    const job = await startJob(id, { userId: session.userId, roles: session.roles });

    // ۵) پاسخ
    return NextResponse.json(job, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
