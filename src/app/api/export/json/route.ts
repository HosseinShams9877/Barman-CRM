/**
 * /api/export/json — خروجی JSON یکپارچه (PHASE_07 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04. مجوز: `admin.settings`.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission } from "@core/permissions";
import { buildSnapshot } from "@modules/export/services/snapshot.service";

/** POST /api/export/json — snapshot کامل به‌صورت JSON. */
export async function POST(): Promise<Response> {
  try {
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);
    requirePermission(session, "admin.settings");

    const snapshot = await buildSnapshot();

    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
