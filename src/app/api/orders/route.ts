/**
 * /api/orders — لیست و ایجاد پیش‌فاکتور (PHASE_04 §۷).
 *
 * الگوی ۵ مرحله‌ای CD-04: auth → permission → Zod → service → response.
 * مجوزها: GET → orders.view، POST → orders.create.
 *
 * دامنه دید: کارشناس فروش فقط سفارش‌های خودش را می‌بیند؛ سایر نقش‌های
 * دارای `orders.view` همه سفارش‌ها را می‌بینند — فیلتر در سرور (R-02).
 * مالک سفارش در زمان ایجاد به‌صورت پیش‌فرض کاربر درخواست‌کننده است.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, SESSION_COOKIE } from "@core/auth";
import { errorToResponse } from "@core/errors";
import { requirePermission, shouldHideMoney } from "@core/permissions";
import { faErrorMap, parseOrFail } from "@core/validation";
import { createOrderSchema, listOrdersQuerySchema } from "@modules/orders/schemas/order.schema";
import { createOrder, listOrders } from "@modules/orders/services/order.service";
import type { OrderListScope } from "@modules/orders/services/order.service";

/** GET /api/orders — لیست سفارش‌ها با فیلتر مرحله/وضعیت/مالک و جستجو. */
export async function GET(req: Request): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز — منبع حقیقت در سرور (R-02)
    requirePermission(session, "orders.view");

    // ۳) اعتبارسنجی — query string (پیام فارسی — CD-28)
    const url = new URL(req.url);
    const query = parseOrFail(
      listOrdersQuerySchema,
      {
        page: url.searchParams.get("page") ?? undefined,
        pageSize: url.searchParams.get("pageSize") ?? undefined,
        q: url.searchParams.get("q") ?? undefined,
        stage: url.searchParams.get("stage") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
        ownerId: url.searchParams.get("ownerId") ?? undefined,
      },
      faErrorMap,
    );

    // ۴) سرویس — دامنه دید (R-02):
    // کارشناس فروش فقط سفارش‌های خودش را می‌بیند (مالک در زمان ایجاد خودش
    // ثبت می‌شود)؛ finance/production/depot برای انجام مرحله‌های بعدی و
    // salesManager/management همه سفارش‌ها را می‌بینند. ماتریس مجوزها
    // (CD-05) `orders.viewAll` ندارد — بنابراین دامنه بر اساس نقش تعیین
    // می‌شود، نه مجوز.
    const scope: OrderListScope = {
      restrictToOwner: session.roles.every((r) => r === "sales"),
      userId: session.userId,
    };
    // پارامترهای اختیاری Zod به قرارداد `OrderListParams` (null به‌جای undefined)
    // نگاشت می‌شوند — service دقیقاً همین قرارداد را می‌خواند.
    const result = await listOrders(
      {
        page: query.page,
        pageSize: query.pageSize,
        q: query.q,
        stage: query.stage ?? null,
        status: query.status ?? null,
        ownerId: query.ownerId ?? null,
      },
      scope,
      shouldHideMoney(session),
    );

    // ۵) پاسخ
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** POST /api/orders — ایجاد پیش‌فاکتور جدید (مرحله ۱ — draft). */
export async function POST(req: Request): Promise<Response> {
  try {
    // ۱) احراز هویت
    const store = await cookies();
    const session = await requireSession(store.get(SESSION_COOKIE)?.value);

    // ۲) مجوز
    requirePermission(session, "orders.create");

    // ۳) اعتبارسنجی — بدنه JSON (پیام فارسی — CD-28)
    const raw = await readJsonBody(req);
    const input = parseOrFail(createOrderSchema, raw, faErrorMap);

    // ۴) سرویس — سقف تخفیف سه‌حالته اینجا اجرا می‌شود (CD-25)
    const order = await createOrder(input, { userId: session.userId, roles: session.roles });

    // ۵) پاسخ
    return NextResponse.json(order, { status: 201 });
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
