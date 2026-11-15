/**
 * /api/orders/[id]/cancel — لغو سفارش (PHASE_04 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوز: orders.status.change.
 *
 * مقررات لغو در سرویس اجرا می‌شود: فقط سفارش‌های باز در stage ≤ ۵ توسط
 * management/admin/salesManager یا sales مالک قابل لغو هستند
 * (canCancel — order.js:59).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { faErrorMap, idParamSchema, parseOrFail } from "@core/validation";
import { cancelOrderSchema } from "@modules/orders/schemas/order.schema";
import { cancelOrder } from "@modules/orders/services/order.service";

/** POST /api/orders/[id]/cancel — لغو سفارش با دلیل. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "orders.status.change");

    // ۳) اعتبارسنجی — پارامتر مسیر + بدنه
    const { id } = parseOrFail(idParamSchema, await ctx.params, faErrorMap);
    const raw = await readJsonBody(req);
    const input = parseOrFail(cancelOrderSchema, raw, faErrorMap);

    // ۴) سرویس
    const order = await cancelOrder(id, input.reason, session, shouldHideMoney(session));

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
