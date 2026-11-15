/**
 * /api/finance/cashflow — گزارش جریان نقدی ماهانه (PHASE_06 §۵/§۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوز: GET → finance.view.
 *
 * پارامتر اختیاری `month` با قالب `YYYY/MM` و ارقام ASCII (CD-06) — در
 * صورت ارائه فقط همان ماه برمی‌گردد.
 *
 * bucketing ماهانه بر اساس JDN با موتور JDF انجام می‌شود (R-11 — بدون
 * برش رشته‌ای تاریخ). منابع رویدادهای پولی: fin-core.js:46-57.
 *
 * noMoney (R-32): فیلدهای پولی برای نقش‌های فاقد money.view حذف می‌شوند.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { parseOrFail, faErrorMap } from "@core/validation";
import { getCashflow, cashflowQuerySchema } from "@modules/finance";

/** GET /api/finance/cashflow — جریان نقدی تجمیع‌شده بر اساس ماه شمسی. */
export async function GET(req: Request): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور (R-02)
    requirePermission(session, "finance.view");

    // ۳) اعتبارسنجی — query string
    const url = new URL(req.url);
    const query = parseOrFail(
      cashflowQuerySchema,
      { month: url.searchParams.get("month") ?? undefined },
      faErrorMap,
    );

    // ۴) سرویس — noMoney نقش‌های فاقد money.view (R-32)
    const result = await getCashflow(shouldHideMoney(session), query.month ?? null);

    // ۵) پاسخ
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
