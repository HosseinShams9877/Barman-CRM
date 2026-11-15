/**
 * /api/admin/lists — ویرایشگر ۷ فهرست ثابت (PHASE_07 §۷)
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: GET/PUT → admin.lists (فقط admin/management — FULL در admin.js:9)
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { parseOrFail, faErrorMap } from "@core/validation";
import { listLists, saveLists } from "@modules/admin/services/lists.service";
import { listsSaveSchema } from "@modules/admin/schemas/admin.schema";

/** GET /api/admin/lists — ۷ فهرست با برچسب فارسی. */
export async function GET(): Promise<Response> {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requirePermission(session, "admin.lists");

    const items = await listLists();

    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** PUT /api/admin/lists — ذخیره همه فهرست‌ها (admin.js:174). */
export async function PUT(req: Request): Promise<Response> {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requirePermission(session, "admin.lists");

    const raw = await req.json().catch(() => null);
    const input = parseOrFail(listsSaveSchema, raw, faErrorMap);

    const items = await saveLists(input);

    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
