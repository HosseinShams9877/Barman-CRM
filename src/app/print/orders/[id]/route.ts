/**
 * GET /print/orders/[id]?t=… — صفحه چاپ توکن‌دار سفارش (R-01).
 *
 * این مسیر **بدون کوکی نشست** اجرا می‌شود و فقط بر اساس توکن چاپ
 * (query param `t`) داده همان سفارش را نمایش می‌دهد. توکن از
 * `POST /api/orders/[id]/print-token` صادر می‌شود و مقید است به
 * `orderId` + کاربر درخواست‌کننده با TTL کوتاه (پیش‌فرض ۵ دقیقه).
 *
 * کدهای وضعیت HTTP (PHASE_08 Part A — دستور مالک، رفع fallback ۲۰۰ی فاز ۴):
 *  - ۴۰۱: توکن غایب، نامعتبر یا منقضی
 *  - ۴۰۳: توکن مربوط به سفارش دیگری (cross-order)
 *  - ۴۰۴: سفارش وجود ندارد
 *  - ۲۰۰: فاکتور کامل (نقش‌های noMoney نسخه بدون مبالغ — R-32)
 *
 * پیام کاربرپسند فارسی حفظ شده ولی کد وضعیت صحیح تنظیم می‌شود.
 * خروجی HTML مستقل است (بدون وابستگی به hydration کلاینت).
 */
import { getPrintOrder } from "@modules/orders/services/print.service";
import { renderPrintOrder, renderPrintError } from "@modules/orders/services/printHtml";
import { ApiError } from "@core/errors";

type Ctx = { params: Promise<{ id: string }> };

const HTML_HEADERS = { "Content-Type": "text/html; charset=utf-8" } as const;

/** پیام فارسی برای هر نوع خطا — بدون نشت داده. */
const ERROR_MESSAGES: Readonly<Record<number, string>> = {
  401: "لینک چاپ معتبر نیست یا منقضی شده است. از صفحه سفارش دوباره توکن چاپ بگیرید (مدت اعتبار توکن ۵ دقیقه است).",
  403: "این لینک چاپ برای سفارش دیگری صادر شده است.",
  404: "سفارش مورد نظر پیدا نشد.",
};

/** توکن از query string — فقط `t` پذیرفته می‌شود. */
function tokenFrom(url: URL): string | null {
  const t = url.searchParams.get("t");
  return t && t.length > 0 ? t : null;
}

export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const token = tokenFrom(new URL(req.url));

  try {
    const order = await getPrintOrder(id, token);
    return new Response(renderPrintOrder(order), {
      status: 200,
      headers: HTML_HEADERS,
    });
  } catch (error) {
    // پیام فارسی + کد وضعیت صحیح — بدون fallback ۲۰۰.
    const status = error instanceof ApiError ? error.status : 500;
    const message =
      status in ERROR_MESSAGES
        ? ERROR_MESSAGES[status]!
        : "خطای غیرمنتظره — لطفاً دوباره توکن چاپ بگیرید.";
    return new Response(renderPrintError(id, message), {
      status,
      headers: HTML_HEADERS,
    });
  }
}
