/**
 * /api/admin/leadcols — ستون‌های بورد سرنخ (فاز ۸ — بازگرداندن تب Demo).
 *
 * ذخیره حداقلی در ردیف List کلید "leadcols" (بدون تغییر schema).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: GET برای هر کسی که بورد سرنخ را می‌بیند (leads.view) یا
 * مدیریت فهرست‌ها (admin.lists)؛ PUT فقط admin.lists (admin/management).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requireAnyPermission } from "@core/permissions";
import { parseOrFail, faErrorMap } from "@core/validation";
import { getLeadCols, saveLeadCols, type LeadColumnDef } from "@modules/admin/services/leadcols.service";

const columnSchema = z.object({
  stage: z.string().min(1),
  key: z.string().min(1).max(32),
  label: z.string().trim().min(1).max(48),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

const leadColsSaveSchema = z.object({
  columns: z.array(columnSchema).max(32),
});

/** GET /api/admin/leadcols — ستون‌های بورد (پیش‌فرض‌های Demo در نبود داده). */
export async function GET(): Promise<Response> {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requireAnyPermission(session, ["leads.view", "admin.lists"]);

    const columns = await getLeadCols();
    return NextResponse.json({ columns }, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** PUT /api/admin/leadcols — ذخیره ستون‌ها (admin.lists). */
export async function PUT(req: Request): Promise<Response> {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requireAnyPermission(session, ["admin.lists"]);

    const raw = await req.json().catch(() => null);
    const input = parseOrFail(leadColsSaveSchema, raw, faErrorMap);

    const columns = await saveLeadCols(input as { columns: LeadColumnDef[] });
    return NextResponse.json({ columns }, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
