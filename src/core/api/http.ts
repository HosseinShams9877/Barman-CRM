/**
 * کمک‌کننده‌های HTTP — سمت سرور و کلاینت (CD-04 / BACKEND_AND_API_ARCHITECTURE §۲.۳).
 *
 * سمت سرور: `jsonOk` / `jsonError` برای پاسخ‌های یکدست.
 * سمت کلاینت: `apiFetch` که پاکت خطای سرور را به ApiError تبدیل می‌کند تا
 * React Query با کد خطا تصمیم بگیرد نه با پیام.
 */
import { ApiError, errorToResponse, type ErrorResponsePayload } from "../errors";

/** پاسخ موفق ۲۰۰ با بدنه JSON. */
export function jsonOk<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

/** پاسخ موفق بدون بدنه (۲۰۴). */
export function jsonNoContent(): Response {
  return new Response(null, { status: 204 });
}

/** تبدیل مستقیم یک ApiError (یا هر خطای ناشناخته) به پاسخ استاندارد. */
export function jsonError(error: unknown): Response {
  return errorToResponse(error);
}

/** خواندن پاکت خطا از یک Response — برای fetch در کلاینت. */
export async function readApiError(res: Response): Promise<ApiError> {
  if (res.status === 401) {
    return new ApiError(401, "UNAUTHORIZED", "نشست معتبر نیست. لطفاً دوباره وارد شوید.");
  }
  try {
    const payload = (await res.json()) as ErrorResponsePayload;
    if (payload?.error?.code) {
      return new ApiError(res.status, payload.error.code, payload.error.message, payload.error.fields);
    }
  } catch {
    // بدنه JSON نیست — پیام عمومی
  }
  return new ApiError(res.status, "INTERNAL", "خطای غیرمنتظره در ارتباط با سرور.");
}

type FetchOptions = RequestInit & {
  /** json helper: بدنه را به JSON تبدیل و هدر Content-Type را تنظیم می‌کند. */
  json?: unknown;
};

/** fetch با پاکت خطای یکدست — برای استفاده در queryهای کلاینت. */
export async function apiFetch<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const init: RequestInit = {
    ...options,
    headers: { Accept: "application/json", ...options.headers },
  };
  if (options.json !== undefined) {
    init.body = JSON.stringify(options.json);
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    delete (init as { json?: unknown }).json;
  }
  const res = await fetch(url, init);
  if (res.status === 204) return undefined as T;
  if (!res.ok) throw await readApiError(res);
  return (await res.json()) as T;
}
