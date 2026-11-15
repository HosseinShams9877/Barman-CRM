/**
 * پاکت خطای استاندارد — CD-04 گام ۵ و BACKEND_AND_API_ARCHITECTURE §۲.۳.
 *
 * هر پاسخ خطا همین شکل را دارد:
 *
 *   { error: { code: string, message: string, fields?: Record<string,string> } }
 *
 * کلاینت با خواندن `error.code` تصمیم می‌گیرد (نه با parse کردن پیام).
 */
export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION"
  | "INTERNAL";

export type FieldErrors = Record<string, string>;

export type ErrorResponsePayload = {
  error: { code: ErrorCode; message: string; fields?: FieldErrors };
};

/** خطای API — در serviceها پرتاب می‌شود، در Route Handler به Response تبدیل می‌شود. */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: ErrorCode;
  public readonly fields?: FieldErrors;

  constructor(status: number, code: ErrorCode, message: string, fields?: FieldErrors) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/** ۴۰۱ — نشست معتبر نیست. */
export function unauthorized(message = "نشست معتبر نیست. لطفاً دوباره وارد شوید."): ApiError {
  return new ApiError(401, "UNAUTHORIZED", message);
}

/** ۴۰۳ — کاربر وارد شده اما مجوز عملیات را ندارد (R-02). */
export function forbidden(message = "شما مجوز انجام این عملیات را ندارید."): ApiError {
  return new ApiError(403, "FORBIDDEN", message);
}

/** ۴۰۰ — ورودی نامعتبر. */
export function badRequest(message = "ورودی نامعتبر است.", fields?: FieldErrors): ApiError {
  return new ApiError(400, "BAD_REQUEST", message, fields);
}

/** ۴۰۴ — منبع پیدا نشد. */
export function notFound(message = "منبع مورد نظر پیدا نشد."): ApiError {
  return new ApiError(404, "NOT_FOUND", message);
}

/** ۴۰۹ — تعارض همزمانی (rev mismatch). */
export function conflict(message = "این رکورد توسط کاربر دیگری تغییر کرده است."): ApiError {
  return new ApiError(409, "CONFLICT", message);
}

/** ۵۰۰ — خطای داخلی. جزئیات فاش نمی‌شود. */
export function internal(message = "خطای داخلی سرور."): ApiError {
  return new ApiError(500, "INTERNAL", message);
}

/**
 * هر مقدار پرتاب‌شده → Response با پاکت استاندارد.
 * خطاهای ناشناخته به INTERNAL (۵۰۰) نگاشت می‌شوند بدون افشای جزئیات.
 */
export function errorToResponse(error: unknown, log?: (msg: string, err: unknown) => void): Response {
  if (error instanceof ApiError) {
    const payload: ErrorResponsePayload = {
      error: { code: error.code, message: error.message },
    };
    if (error.fields) payload.error.fields = error.fields;
    return Response.json(payload, { status: error.status });
  }
  log?.("api-error-unhandled", error);
  const payload: ErrorResponsePayload = {
    error: { code: "INTERNAL", message: "خطای داخلی سرور." },
  };
  return Response.json(payload, { status: 500 });
}
