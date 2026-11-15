/**
 * /api/leads/[id] — جزئیات، ویرایش و جابه‌جایی مرحله یک سرنخ (PHASE_03 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: GET → leads.view، PATCH → leads.edit (CD-23).
 *
 * بدنه PATCH یا ویرایش فیلدهاست (updateLeadSchema) یا جابه‌جایی مرحله
 * (moveStageSchema با فیلد `to`). تشخیص با حضور `to` انجام می‌شود —
 * `to` در updateLeadSchema وجود ندارد.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse, badRequest } from "@core/errors";
import { requirePermission } from "@core/permissions";
import {
  idParamSchema,
  parseOrFail,
  faErrorMap,
} from "@core/validation";
import { moveStageSchema, updateLeadSchema } from "@modules/leads/schemas/lead.schema";
import { getLead, moveLeadStage, updateLead } from "@modules/leads/services/lead.service";

/** GET /api/leads/[id] — جزئیات سرنخ شامل تاریخچه پیگیری. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "leads.view");

    // ۳) اعتبارسنجی — پارامتر مسیر
    const { id } = parseOrFail(idParamSchema, await ctx.params, faErrorMap);

    // ۴) سرویس
    const lead = await getLead(id);

    // ۵) پاسخ
    return NextResponse.json(lead, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** PATCH /api/leads/[id] — ویرایش فیلدها یا جابه‌جایی مرحله (شامل lost/بازگرداندن). */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "leads.edit");

    // ۳) اعتبارسنجی — پارامتر مسیر + بدنه
    const { id } = parseOrFail(idParamSchema, await ctx.params, faErrorMap);
    const raw = await readJsonBody(req);
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      throw badRequest("ورودی نامعتبر است.");
    }

    // ۴) سرویس — شکل بدنه تصمیم می‌گیرد ویرایش است یا جابه‌جایی مرحله
    let lead;
    if ("to" in raw) {
      const input = parseOrFail(moveStageSchema, raw, faErrorMap);
      lead = await moveLeadStage(id, input, session.userId);
    } else {
      const input = parseOrFail(updateLeadSchema, raw, faErrorMap);
      // تخصیص مجدد نیازمند leads.assign است (CD-23)
      if (input.ownerId !== undefined) {
        requirePermission(session, "leads.assign");
      }
      lead = await updateLead(id, input);
    }

    // ۵) پاسخ
    return NextResponse.json(lead, { status: 200 });
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
