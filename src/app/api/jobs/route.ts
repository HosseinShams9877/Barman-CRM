/**
 * /api/jobs — لیست و ایجاد کارهای تولید (PHASE_05 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: GET → production.view، POST → production.edit (CD-26 dotted).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission } from "@core/permissions";
import { faErrorMap, parseOrFail } from "@core/validation";
import { createJobSchema, jobListQuerySchema } from "@modules/production/schemas/job.schema";
import { createJob, listJobs } from "@modules/production/services/job.service";

/** GET /api/jobs — لیست کارها با فیلتر وضعیت و جستجو. */
export async function GET(req: Request): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور
    requirePermission(session, "production.view");

    // ۳) اعتبارسنجی — query string (پیام فارسی — CD-28)
    const url = new URL(req.url);
    const query = parseOrFail(
      jobListQuerySchema,
      {
        page: url.searchParams.get("page") ?? undefined,
        pageSize: url.searchParams.get("pageSize") ?? undefined,
        q: url.searchParams.get("q") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
      },
      faErrorMap,
    );

    // ۴) سرویس
    const result = await listJobs({
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      status: query.status ?? null,
    });

    // ۵) پاسخ
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** POST /api/jobs — ایجاد کار با پیش‌نمایش BOM ذخیره‌شده. */
export async function POST(req: Request): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "production.edit");

    // ۳) اعتبارسنجی — بدنه JSON (پیام فارسی — CD-28)
    const raw = await readJsonBody(req);
    const input = parseOrFail(createJobSchema, raw, faErrorMap);

    // ۴) سرویس — guard خط تولید و BOM اینجا اجرا می‌شود
    const job = await createJob(input, { userId: session.userId, roles: session.roles });

    // ۵) پاسخ
    return NextResponse.json(job, { status: 201 });
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
