/**
 * /api/leads — لیست و ایجاد سرنخ (PHASE_03 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: GET → leads.view، POST → leads.create (CD-23).
 *
 * دامنه دید: نقش‌های بدون `leads.viewAll` (مثلاً sales) فقط سرنخ‌های
 * خودشان را می‌بینند — فیلتر در سرور (PHASE_03 §۸ / R-02).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, rolesHavePermission } from "@core/permissions";
import {
  parseOrFail,
  faErrorMap,
} from "@core/validation";
import { createLeadSchema, listLeadsQuerySchema } from "@modules/leads/schemas/lead.schema";
import { createLead, listLeads } from "@modules/leads/services/lead.service";
import type { LeadListScope } from "@modules/leads/services/lead.service";

/** GET /api/leads — لیست سرنخ‌ها با فیلتر خط/مرحله/کارشناس و جستجو. */
export async function GET(req: Request): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور (R-02)
    requirePermission(session, "leads.view");

    // ۳) اعتبارسنجی — query string
    const url = new URL(req.url);
    const query = parseOrFail(
      listLeadsQuerySchema,
      {
        page: url.searchParams.get("page") ?? undefined,
        pageSize: url.searchParams.get("pageSize") ?? undefined,
        q: url.searchParams.get("q") ?? undefined,
        line: url.searchParams.get("line") ?? undefined,
        stage: url.searchParams.get("stage") ?? undefined,
        ownerId: url.searchParams.get("ownerId") ?? undefined,
      },
      faErrorMap,
    );

    // ۴) سرویس — محدوده دید sales: فقط سرنخ‌های خودش (PHASE_03 §۸)
    const scope: LeadListScope = {
      restrictToOwner: !rolesHavePermission(session.roles, "leads.viewAll"),
      userId: session.userId,
    };
    const result = await listLeads(query, scope);

    // ۵) پاسخ
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** POST /api/leads — ایجاد سرنخ جدید (شماره نرمال‌شده، حساب ناشناس، مرحله raw). */
export async function POST(req: Request): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "leads.create");

    // ۳) اعتبارسنجی — بدنه JSON
    const raw = await readJsonBody(req);
    const input = parseOrFail(createLeadSchema, raw, faErrorMap);

    // تخصیص به کاربر دیگر نیازمند leads.assign است (CD-23)
    if (input.ownerId !== undefined && input.ownerId !== session.userId) {
      requirePermission(session, "leads.assign");
    }

    // ۴) سرویس — قانون تکرار شماره در اینجا اجرا می‌شود (۴۰۹)
    const lead = await createLead(input, session.userId);

    // ۵) پاسخ
    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** خواندن بدنه JSON با مدیریت بدنه خالی/نامعتبر (۴۰۰). */
async function readJsonBody(req: Request): Promise<unknown> {
  try {
    const text = await req.text();
    return text.length === 0 ? {} : JSON.parse(text);
  } catch {
    return {};
  }
}
