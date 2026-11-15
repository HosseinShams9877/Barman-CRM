/**
 * /api/orders/[id]/payments — ثبت پرداخت‌های دریافتی (PHASE_04 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوز: finance.edit یا orders.status.change (ثبت پرداخت توسط مالی یا
 * کارشناس فروش مجاز است — Demo: app/order.js PAY).
 *
 * مقررات در سرویس اجرا می‌شود: سفارش لغو‌نشده، جمع دریافتی‌ها ≤ مبلغ کل
 * (تلورانس ۱ ریال — order.js:147 ok4).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requireAnyPermission, shouldHideMoney } from "@core/permissions";
import { faErrorMap, idParamSchema, parseOrFail } from "@core/validation";
import { createPaymentSchema } from "@modules/orders/schemas/order.schema";
import { createPayment } from "@modules/orders/services/payment.service";

/** POST /api/orders/[id]/payments — ثبت پرداخت نقدی/کارتی. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — مالی یا تغییر وضعیت سفارش
    requireAnyPermission(session, ["finance.edit", "orders.status.change"]);

    // ۳) اعتبارسنجی — پارامتر مسیر + بدنه
    const { id } = parseOrFail(idParamSchema, await ctx.params, faErrorMap);
    const raw = await readJsonBody(req);
    const input = parseOrFail(createPaymentSchema, raw, faErrorMap);

    // ۴) سرویس — سقف جمع دریافتی‌ها اینجا اجرا می‌شود
    const order = await createPayment(id, input, session, shouldHideMoney(session));

    // ۵) پاسخ
    return NextResponse.json(order, { status: 201 });
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
