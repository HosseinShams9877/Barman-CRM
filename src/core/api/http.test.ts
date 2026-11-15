/**
 * آزمون کمک‌تابع‌های HTTP — CD-04 / BACKEND_AND_API_ARCHITECTURE §۲.۳.
 *
 * پاکت خطای استاندارد: apiFetch باید پاسخ‌های غیر۲xx را به ApiError با
 * کد و فیلدهای سرور تبدیل کند و ۲۰۴ را به‌جای JSON خوردن، undefined برگرداند.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ApiError } from "../errors";
import { apiFetch, jsonError, jsonNoContent, jsonOk, readApiError } from "./http";

const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = vi.fn();
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

afterEach(() => {
  vi.mocked(globalThis.fetch).mockReset();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("jsonOk / jsonNoContent / jsonError", () => {
  it("jsonOk: بدنه با کد وضعیت دلخواه", () => {
    const res = jsonOk({ id: "x" }, 201);
    expect(res.status).toBe(201);
  });

  it("jsonNoContent: ۲۰۴ بدون بدنه", () => {
    const res = jsonNoContent();
    expect(res.status).toBe(204);
    expect(res.body).toBe(null);
  });

  it("jsonError: تبدیل ApiError به پاسخ استاندارد", async () => {
    const res = jsonError(new ApiError(409, "CONFLICT", "تکراری است."));
    expect(res.status).toBe(409);
    const payload = (await res.json()) as { error: { code: string } };
    expect(payload.error.code).toBe("CONFLICT");
  });
});

describe("readApiError", () => {
  it("۴۰۱ → ApiError با کد UNAUTHORIZED", async () => {
    const err = await readApiError(new Response(null, { status: 401 }));
    expect(err.status).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("بدنه با پاکت خطا → کد و پیام و فیلدهای سرور", async () => {
    const err = await readApiError(
      jsonResponse(400, { error: { code: "VALIDATION", message: "نامعتبر", fields: { phone: "کوتاه" } } }),
    );
    expect(err.code).toBe("VALIDATION");
    expect(err.message).toBe("نامعتبر");
    expect(err.fields).toEqual({ phone: "کوتاه" });
  });

  it("بدنه غیر JSON → خطای عمومی INTERNAL", async () => {
    const err = await readApiError(new Response("oops", { status: 500 }));
    expect(err.code).toBe("INTERNAL");
    expect(err.status).toBe(500);
  });
});

describe("apiFetch", () => {
  it("موفق → بدنه JSON پارس می‌شود و هدر JSON ست می‌شود", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(200, { id: "LD-1" }));
    const data = await apiFetch<{ id: string }>("/api/leads");
    expect(data).toEqual({ id: "LD-1" });

    const init = vi.mocked(globalThis.fetch).mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toMatchObject({ Accept: "application/json" });
    expect(init.body).toBeUndefined();
  });

  it("گزینه json → بدنه سریال‌شده با Content-Type", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(201, { id: "LD-2" }));
    await apiFetch("/api/leads", { method: "POST", json: { phone: "09121234567" } });

    const init = vi.mocked(globalThis.fetch).mock.calls[0]?.[1] as RequestInit & { json?: unknown };
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ phone: "09121234567" }));
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(init.json).toBeUndefined();
  });

  it("۲۰۴ → undefined بدون تلاش برای پارس JSON", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 204 }));
    expect(await apiFetch("/api/customers/AC-1/deactivate", { method: "POST" })).toBeUndefined();
  });

  it("خطای سرور → پرتاب ApiError با مشخصات پاکت", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(403, { error: { code: "FORBIDDEN", message: "مجوز ندارید." } }),
    );
    await expect(apiFetch("/api/leads")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
      message: "مجوز ندارید.",
    });
  });
});
