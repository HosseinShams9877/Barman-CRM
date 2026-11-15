/**
 * /api/orders/[id]/cheques/[cid] — ویرایش چک دریافتی (PHASE_04 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوز: finance.edit.
 *
 * مقررات در سرویس اجرا می‌شود: ویرایش چک روی سفارش لغو‌نشده ممنوع،
 * و تغییر وضعیت به «clear» جمع دریافتی‌ها را زیاد می‌کند و سقف کل
 * را فعال می‌کند (تلورانس ۱ ریال).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { faErrorMap, idParamSchema, parseOrFail } from "@core/validation";
import { updateChequeSchema } from "@modules/orders/schemas/order.schema";
import { updateCheque } from "@modules/orders/services/payment.service";

/** PATCH /api/orders/[id]/cheques/[cid] — وضعیت بانکی و اطلاعات چک. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; cid: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "finance.edit");

    // ۳) اعتبارسنجی — پارامتر مسیر + بدنه
    const { id, cid } = parseOrFail(
      idParamSchema.extend({ cid: idParamSchema.shape.id }),
      await ctx.params,
      faErrorMap,
    );
    const raw = await readJsonBody(req);
    const input = parseOrFail(updateChequeSchema, raw, faErrorMap);

    // ۴) سرویس
    const order = await updateCheque(id, cid, input, session, shouldHideMoney(session));

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
