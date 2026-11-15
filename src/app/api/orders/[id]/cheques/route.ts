/**
 * /api/orders/[id]/cheques — ثبت چک‌های دریافتی (PHASE_04 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوز: finance.edit (ثبت چک وظیفه مالی است — Demo: app/order.js، بخش چک‌ها).
 *
 * مقررات در سرویس اجرا می‌شود: سفارش لغو‌نشده، شماره صیادی ۱۶ رقم
 * (order.js:622)، وضعیت اولیه «hand» — فقط چک «clear» جزو دریافتی‌ها
 * است (core.js:245-250).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { faErrorMap, idParamSchema, parseOrFail } from "@core/validation";
import { createChequeSchema } from "@modules/orders/schemas/order.schema";
import { createCheque } from "@modules/orders/services/payment.service";

/** POST /api/orders/[id]/cheques — ثبت چک دریافتی. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "finance.edit");

    // ۳) اعتبارسنجی — پارامتر مسیر + بدنه
    const { id } = parseOrFail(idParamSchema, await ctx.params, faErrorMap);
    const raw = await readJsonBody(req);
    const input = parseOrFail(createChequeSchema, raw, faErrorMap);

    // ۴) سرویس
    const order = await createCheque(id, input, session, shouldHideMoney(session));

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
