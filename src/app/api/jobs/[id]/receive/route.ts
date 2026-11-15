/**
 * /api/jobs/[id]/receive — دریافت حاصل کار در دپو (PHASE_05 §۳.۸/§۷).
 *
 * الگوی ۵ مرحله‌ای CD-04. مجوز: inventory.moves — عملیات انبار (CD-26).
 * repr: jrecv در Demo (app/stock.js:73-78) — حرکت `kind: "job"` در دپو،
 * `status: "done"` + recvQty/recvAt، همه در یک تراکنش.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission } from "@core/permissions";
import { faErrorMap, parseOrFail } from "@core/validation";
import { jobIdParamSchema, receiveJobSchema } from "@modules/production/schemas/job.schema";
import { receiveJob } from "@modules/production/services/job.service";

/** POST /api/jobs/[id]/receive — sent → done + حرکت kind: job در دپو. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "inventory.moves");

    // ۳) اعتبارسنجی — params و بدنه (پیام فارسی — CD-28)
    const { id } = parseOrFail(jobIdParamSchema, await ctx.params, faErrorMap);
    const input = parseOrFail(receiveJobSchema, await readJsonBody(req), faErrorMap);

    // ۴) سرویس — حرکت انبار در همان تراکنش با بستن کار
    const result = await receiveJob(id, input, {
      userId: session.userId,
      roles: session.roles,
    });

    // ۵) پاسخ
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
