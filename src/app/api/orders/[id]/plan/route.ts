/**
 * /api/orders/[id]/plan — تولید برنامه پرداخت پیشنهادی (PHASE_04 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوز: orders.view **به‌علاوان** دیدن مبالغ (money.view — R-32).
 *
 * برنامه پرداخت تماماً مبالغ است؛ نقش‌های بدون money.view (production،
 * depot و سایر نقش‌های فاقد مجوز) حق دسترسی به این مسیر را ندارند.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { forbidden, errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { faErrorMap, idParamSchema, parseOrFail } from "@core/validation";
import { generatePlanSchema } from "@modules/orders/schemas/order.schema";
import { generateOrderPlan } from "@modules/orders/services/plan.service";

/** POST /api/orders/[id]/plan — پیشنهاد برنامه نقد/چک با preset یا builder. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — orders.view + دیدن مبالغ (R-32)
    requirePermission(session, "orders.view");
    if (shouldHideMoney(session)) {
      throw forbidden("نقش شما مجوز مشاهده مبالغ و برنامه پرداخت را ندارد.");
    }

    // ۳) اعتبارسنجی — پارامتر مسیر + بدنه
    const { id } = parseOrFail(idParamSchema, await ctx.params, faErrorMap);
    const raw = await readJsonBody(req);
    const input = parseOrFail(generatePlanSchema, raw, faErrorMap);

    // ۴) سرویس — محاسبه خالص، بدون ذخیره‌سازی (PHASE_04 §۳.۵)
    const plan = await generateOrderPlan(id, input);

    // ۵) پاسخ
    return NextResponse.json(plan, { status: 200 });
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
