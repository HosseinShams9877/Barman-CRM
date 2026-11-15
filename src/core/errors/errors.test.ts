/**
 * آزمون پاکت خطای استاندارد — CD-04 گام ۵.
 */
import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  badRequest,
  conflict,
  errorToResponse,
  forbidden,
  internal,
  notFound,
  unauthorized,
} from "./errors";

describe("کارخانه‌های خطا", () => {
  it("نگاشت کد/وضعیت", () => {
    expect(unauthorized()).toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    expect(forbidden()).toMatchObject({ status: 403, code: "FORBIDDEN" });
    expect(badRequest()).toMatchObject({ status: 400, code: "BAD_REQUEST" });
    expect(notFound()).toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect(conflict()).toMatchObject({ status: 409, code: "CONFLICT" });
    expect(internal()).toMatchObject({ status: 500, code: "INTERNAL" });
  });

  it("پیام پیش‌فرض فارسی", () => {
    expect(forbidden().message).toContain("مجوز");
    expect(unauthorized().message).toContain("نشست");
    expect(conflict().message).toContain("کاربر دیگری");
  });

  it("badRequest فیلدها را نگه می‌دارد", () => {
    const e = badRequest("ورودی نامعتبر.", { page: "باید مثبت باشد" });
    expect(e.fields).toEqual({ page: "باید مثبت باشد" });
  });

  it("ApiError یک Error است", () => {
    const e = new ApiError(400, "BAD_REQUEST", "x");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("ApiError");
  });
});

describe("errorToResponse", () => {
  it("ApiError → Response با وضعیت و پاکت استاندارد", async () => {
    const res = errorToResponse(forbidden("عدم دسترسی"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: { code: "FORBIDDEN", message: "عدم دسترسی" } });
  });

  it("fields در پاکت گنجانده می‌شود", async () => {
    const res = errorToResponse(badRequest("نامعتبر", { name: "اجباری" }));
    const body = await res.json();
    expect(body.error.fields).toEqual({ name: "اجباری" });
  });

  it("خطای ناشناخته → ۵۰۰ INTERNAL بدون نشت جزئیات", async () => {
    const res = errorToResponse(new Error("secret-internal-stack"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL");
    expect(JSON.stringify(body)).not.toContain("secret-internal-stack");
  });

  it("log برای خطاهای ناشناخته فراخوانی می‌شود", () => {
    const log = vi.fn();
    errorToResponse(new Error("boom"), log);
    expect(log).toHaveBeenCalledTimes(1);
  });
});
