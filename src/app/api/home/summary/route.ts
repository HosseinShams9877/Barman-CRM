/**
 * /api/home/summary — خلاصه داشبورد خانه (PHASE_07 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04. همه نقش‌ها داشبورد را می‌بینند (home.js:10) —
 * مجوز فقط احراز هویت است؛ scoping و فیلتر مبلغ در سرور (CD-05).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { shouldHideMoney, hasPermission } from "@core/permissions";
import { getDashboardSummary } from "@modules/home/services/summary.service";
import { getDashboardWorkspace } from "@modules/home/services/workspace.service";

/** GET /api/home/summary — خلاصه عملکرد کاربر جاری. */
export async function GET(): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — داشبورد برای همه نقش‌ها (home.js:10)؛ scoping سرور:
    // نقش‌های با leads.view بدون leads.viewAll فقط داده‌های خودشان.
    const scope = {
      restrictToOwner:
        hasPermission(session, "leads.view") && !hasPermission(session, "leads.viewAll"),
      userId: session.userId,
    };

    // ۳/۴) خواندن خلاصه — noMoney نقش‌های فاقد money.view (R-32)
    const summary = await getDashboardSummary(scope, shouldHideMoney(session));
    summary.workspace = await getDashboardWorkspace(session.roles[0] ?? "sales", session.userId, scope.restrictToOwner, shouldHideMoney(session));

    // ۵) پاسخ
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
