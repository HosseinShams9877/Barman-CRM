/**
 * /api/export/zip — خروجی ZIP کامل داده (PHASE_07 §۷ / دروازه خروج ۷).
 *
 * الگوی ۵ مرحله‌ای CD-04. مجوز: `admin.settings` (دسترسی کامل طبق
 * FULL در admin.js:9 — خروجی کامل داده فقط مدیر).
 *
 * ساختار ZIP معادل پوشه data در Demo (server/export.js:39): meta.json،
 * orders/*.json، collections، seq-*.txt و README.txt.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission } from "@core/permissions";
import { buildSnapshot } from "@modules/export/services/snapshot.service";
import { zipOf, snapshotEntries } from "@modules/export/services/zip";

/** POST /api/export/zip — فایل ZIP کامل داده. */
export async function POST(): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور (R-02)
    requirePermission(session, "admin.settings");

    // ۳/۴) ساخت snapshot و ZIP
    const snapshot = await buildSnapshot();
    const bytes = zipOf(snapshotEntries(snapshot));
    const body = new Blob([new Uint8Array(bytes)], { type: "application/zip" });

    // ۵) پاسخ — فایل باینری
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="barman-export.zip"',
      },
    });
  } catch (error) {
    return errorToResponse(error);
  }
}
