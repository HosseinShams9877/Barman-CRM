/**
 * /api/reports/[kind] — گزارش‌های تجمیعی (PHASE_07 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوز: `reports.view` (admin/management/finance/salesManager).
 *
 * **قانون scoping (PHASE_07 §۸):** نقش‌هایی که سرنخ می‌بینند ولی
 * `leads.viewAll` ندارند (یعنی sales) فقط داده‌های خودشان را در گزارش
 * می‌بینند — فیلتر در سرور (CD-05).
 *
 * **noMoney (R-32):** نقش‌های فاقد money.view مبالغ را در پاسخ نمی‌بینند.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney, hasPermission } from "@core/permissions";
import { parseOrFail, faErrorMap, idParamSchema } from "@core/validation";
import { reportQuerySchema, REPORT_KINDS, type ReportKind } from "@modules/reports/schemas/report-query.schema";
import { leadsReport } from "@modules/reports/services/leads.report";
import { salesReport } from "@modules/reports/services/sales.report";
import { prodReport } from "@modules/reports/services/prod.report";
import { finReport } from "@modules/reports/services/fin.report";

type Ctx = { params: Promise<{ kind: string }> };

/** GET /api/reports/[kind]?days=۹۰&line=prod — گزارش تجمیعی. */
export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور (R-02)
    requirePermission(session, "reports.view");

    // ۳) اعتبارسنجی — kind + query
    const { kind } = await ctx.params;
    parseOrFail(idParamSchema, { id: kind }, faErrorMap);
    if (!REPORT_KINDS.includes(kind as ReportKind)) {
      return NextResponse.json({ message: "نوع گزارش نامعتبر است." }, { status: 400 });
    }

    const url = new URL(req.url);
    const query = parseOrFail(
      reportQuerySchema,
      {
        days: url.searchParams.get("days") ?? undefined,
        line: url.searchParams.get("line") ?? undefined,
      },
      faErrorMap,
    );

    // محدوده دید: نقش‌های با leads.view بدون leads.viewAll (sales) فقط
    // داده‌های خودشان را می‌بینند (PHASE_07 §۸).
    const scope = {
      restrictToOwner: hasPermission(session, "leads.view") && !hasPermission(session, "leads.viewAll"),
      userId: session.userId,
    };
    const hideMoney = shouldHideMoney(session);

    // ۴) سرویس — گزارش متناسب با kind
    const line = query.line ?? null;
    if (kind === "leads") {
      const report = await leadsReport({ days: query.days, line, scope, hideMoney });
      return NextResponse.json(report, { status: 200 });
    }
    if (kind === "sales") {
      const report = await salesReport({ days: query.days, line, scope, hideMoney });
      return NextResponse.json(report, { status: 200 });
    }
    if (kind === "prod") {
      const report = await prodReport(hideMoney);
      return NextResponse.json(report, { status: 200 });
    }
    const report = await finReport({ days: query.days, hideMoney });
    return NextResponse.json(report, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
