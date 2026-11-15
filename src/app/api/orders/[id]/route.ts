/**
 * /api/orders/[id] — جزئیات و ویرایش سفارش (PHASE_04 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: GET → orders.view، PATCH → orders.edit.
 *
 * حذفی وجود ندارد — لغو سفارش از طریق POST /api/orders/[id]/cancel.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { faErrorMap, idParamSchema, parseOrFail } from "@core/validation";
import { updateOrderSchema } from "@modules/orders/schemas/order.schema";
import { getOrder, updateOrder } from "@modules/orders/services/order.service";

/** GET /api/orders/[id] — جزئیات یک سفارش (اقلام، پرداخت‌ها، تاریخچه). */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "orders.view");

    // ۳) اعتبارسنجی — پارامتر مسیر
    const { id } = parseOrFail(idParamSchema, await ctx.params, faErrorMap);

    // ۴) سرویس — noMoney در سطح سرویس فیلتر می‌شود (R-32)
    const order = await getOrder(id, shouldHideMoney(session));

    // ۵) پاسخ
    return NextResponse.json(order, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** PATCH /api/orders/[id] — ویرایش سفارش باز ( قبل از تأیید نهایی). */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "orders.edit");

    // ۳) اعتبارسنجی — پارامتر مسیر + بدنه
    const { id } = parseOrFail(idParamSchema, await ctx.params, faErrorMap);
    const raw = await readJsonBody(req);
    const input = parseOrFail(updateOrderSchema, raw, faErrorMap);

    // ۴) سرویس — سقف تخفیف سه‌حالته اینجا اجرا می‌شود (CD-25)
    const order = await updateOrder(
      id,
      input,
      { userId: session.userId, roles: session.roles },
      shouldHideMoney(session),
    );

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
