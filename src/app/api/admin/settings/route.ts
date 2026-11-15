/**
 * /api/admin/settings — تنظیمات شرکت (PHASE_07 §۷)
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: GET/PATCH → admin.settings (فقط admin/management — FULL در admin.js:9)
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { parseOrFail, faErrorMap } from "@core/validation";
import { getSettings } from "@modules/settings/services/settings.service";
import { saveSettings } from "@modules/admin/services/settings.service";
import { settingsSaveSchema } from "@modules/admin/schemas/admin.schema";

/** GET /api/admin/settings — تنظیمات فعلی. */
export async function GET(): Promise<Response> {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requirePermission(session, "admin.settings");

    const settings = await getSettings();

    return NextResponse.json(settings, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** PATCH /api/admin/settings — ذخیره تنظیمات (admin.js:176-177). */
export async function PATCH(req: Request): Promise<Response> {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requirePermission(session, "admin.settings");

    const raw = await req.json().catch(() => null);
    const input = parseOrFail(settingsSaveSchema, raw, faErrorMap);

    const settings = await saveSettings(input);

    return NextResponse.json(settings, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
