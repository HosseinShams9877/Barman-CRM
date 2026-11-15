/**
 * /api/orders/[id]/stage — انتقال مرحله در خط لوله ۱۱‌مرحله‌ای (PHASE_04 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوز: orders.status.change.
 *
 * اقدامات مجاز (stageActionSchema — ۱۳ اقدام): submit, approve, return,
 * send, finalize, paccept, startProduction, made, qc, receive, daccept,
 * prep, deliver.
 *
 * مقررات انتقال مرحله در سرویس اجرا می‌شود: نقش مسئول مرحله (canActOnStage
 * — core.js:156-168)، فیلدهای اجباری هر مرحله، ورودی تاریخچه per transition
 * و lostFrom/lostReason.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { faErrorMap, idParamSchema, parseOrFail } from "@core/validation";
import { stageActionSchema } from "@modules/orders/schemas/order.schema";
import { applyStageAction } from "@modules/orders/services/order.service";

/** POST /api/orders/[id]/stage — انجام یک اقدام مرحله‌ای. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — تغییر وضعیت در سرور اجرا می‌شود (R-02)
    requirePermission(session, "orders.status.change");

    // ۳) اعتبارسنجی — پارامتر مسیر + بدنه (action discriminated)
    const { id } = parseOrFail(idParamSchema, await ctx.params, faErrorMap);
    const raw = await readJsonBody(req);
    const action = parseOrFail(stageActionSchema, raw, faErrorMap);

    // ۴) سرویس — همه مقررات انتقال در اینجا
    const order = await applyStageAction(id, action, session, shouldHideMoney(session));

    // ۵) پاسخ
    return NextResponse.json(order, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** خواندن بدنه JSON با مدیریت بدنه خالی/نامعتبر. */
async function readJsonBody(req: Request): Promise<unknown> {
  try {
    const text = await req.text();
    return text.length === 0 ? {} : JSON.parse(text);
  } catch {
    return {};
  }
}
