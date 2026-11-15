/**
 * /api/orders/[id]/print-token — صدور توکن چاپ کوتاه‌مدت (PHASE_04 §۹ — R-01).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوز: orders.view (درگاه چاپ — orders.print در ماتریس ۲۵تایی مجوزها
 * وجود ندارد؛ orders.view تولید/انبار هم دسترسی می‌دهند ولی نسخه
 * noMoney چاپ می‌کنند — R-32).
 *
 * توکن HMAC مقید است به order + کاربر درخواست‌کننده و در TTL
 * قابل‌پیکربندی (پیش‌فرض ۵ دقیقه) منقضی می‌شود. صفحه چاپ بدون کوکی
 * اجرا می‌شود.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { faErrorMap, idParamSchema, parseOrFail } from "@core/validation";
import { issuePrintToken } from "@modules/orders/services/print.service";

/** POST /api/orders/[id]/print-token — صدور توکن چاپ. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲+۳) مجوز در سرویس صدور اجرا می‌شود (در صورت عدم مجوز
    // orders.view خطای forbidden صادر می‌شود) — پارامتر مسیر اعتبارسنجی می‌شود.
    const { id } = parseOrFail(idParamSchema, await ctx.params, faErrorMap);

    // ۴) سرویس — صدور توکن مقید به سفارش و کاربر
    const token = issuePrintToken(id, session);

    // ۵) پاسخ — توکن در بدنه JSON برگردانده می‌شود
    return NextResponse.json({ token }, { status: 201 });
  } catch (error) {
    return errorToResponse(error);
  }
}
