/**
 * /api/suppliers — فهرست تأمین‌کنندگان (فقط‌خواندن — PHASE_06 §۵).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مدیریت تأمین‌کنندگان (ایجاد/ویرایش) فاز ۷ است؛ این فاز فقط خواندن.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission } from "@core/permissions";
import { listSuppliers } from "@modules/purchasing/services/supplier.service";

/** GET /api/suppliers — فهرست تأمین‌کنندگان مواد خام. */
export async function GET(): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور (R-02)
    requirePermission(session, "purchasing.view");

    // ۳) اعتبارسنجی — بدون ورودی
    // ۴) سرویس
    const suppliers = await listSuppliers();

    // ۵) پاسخ
    return NextResponse.json(suppliers, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
