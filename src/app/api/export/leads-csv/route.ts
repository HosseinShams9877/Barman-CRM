/**
 * /api/export/leads-csv — خروجی CSV سرنخ‌ها برای اکسل (PHASE_07 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04. مجوز: `leads.view` (منبع: server/export.js).
 * scoping: نقش‌های بدون leads.viewAll فقط سرنخ‌های خودشان (PHASE_07 §۸).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { hasPermission } from "@core/permissions";
import { leadsCsvRows } from "@modules/export/services/snapshot.service";
import { leadsCsv } from "@modules/export/services/csv";

/** POST /api/export/leads-csv — فایل CSV با BOM فارسی. */
export async function POST(): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور (R-02)
    if (!hasPermission(session, "leads.view")) {
      return NextResponse.json({ message: "دسترسی غیرمجاز است." }, { status: 403 });
    }

    // ۳/۴) سرویس — scoping نقش sales (فقط سرنخ‌های خودش)
    const scoped = await leadsCsvRows();
    const restrictToOwner =
      hasPermission(session, "leads.view") && !hasPermission(session, "leads.viewAll");
    const rows = restrictToOwner
      ? scoped.filter((r: { ownerName: string }) => r.ownerName === session.name)
      : scoped;
    const csv = leadsCsv(rows);

    // ۵) پاسخ — فایل CSV
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="leads.csv"',
      },
    });
  } catch (error) {
    return errorToResponse(error);
  }
}
