/**
 * /api/orders/[id]/payments/[pid] — باطل‌کردن یا یادداشت پرداخت (PHASE_04 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوز: finance.edit یا orders.status.change.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requireAnyPermission, shouldHideMoney } from "@core/permissions";
import { faErrorMap, idParamSchema, parseOrFail } from "@core/validation";
import { updatePaymentSchema } from "@modules/orders/schemas/order.schema";
import { updatePayment } from "@modules/orders/services/payment.service";

/** PATCH /api/orders/[id]/payments/[pid] — باطل‌سازی (void) یا یادداشت. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; pid: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requireAnyPermission(session, ["finance.edit", "orders.status.change"]);

    // ۳) اعتبارسنجی — پارامتر مسیر + بدنه
    const { id, pid } = parseOrFail(
      idParamSchema.extend({ pid: idParamSchema.shape.id }),
      await ctx.params,
      faErrorMap,
    );
    const raw = await readJsonBody(req);
    const input = parseOrFail(updatePaymentSchema, raw, faErrorMap);

    // ۴) سرویس
    const order = await updatePayment(id, pid, input, session, shouldHideMoney(session));

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
