/**
 * آزمون hookهای auth — CD-09.
 *
 * apiFetch موک می‌شود تا رفتار کوئری بر اساس پاسخ واقعی سرور بررسی شود:
 * موفقیت داده کاربر، ۴۰۱ → null (بدون retry)، ورود موفق و خطای ورود.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@core/errors";
import { useLoginMutation, useLogoutMutation, useMeQuery } from "./useAuth";
import { queryKeys } from "@core/query";

vi.mock("@core/api", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@core/api");

const ADMIN_USER = {
  id: "u1",
  name: "admin",
  title: "ادمین سیستم",
  roles: ["admin"],
  permissions: [
    "leads.view",
    "orders.view",
    "admin.users",
    "admin.settings",
    "money.view",
  ],
  noMoney: false,
};

function wrapper(): { wrapper: (p: { children: ReactNode }) => ReactNode } {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe("useMeQuery", () => {
  it("پاسخ موفق → کاربر عمومی", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ user: ADMIN_USER } as never);
    const { result } = renderHook(() => useMeQuery(), wrapper());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe("admin");
    expect(result.current.data?.roles).toEqual(["admin"]);
  });

  it("۴۰۱ → null و بدون خطا (نشست یک وضعیت است)", async () => {
    vi.mocked(apiFetch).mockImplementation(async () => {
      throw new ApiError(401, "UNAUTHORIZED", "نشست معتبر نیست.");
    });
    const { result } = renderHook(() => useMeQuery(), wrapper());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("خطای دیگر → error (نه null)", async () => {
    vi.mocked(apiFetch).mockImplementation(async () => {
      throw new ApiError(500, "INTERNAL", "خطای سرور.");
    });
    const { result } = renderHook(() => useMeQuery(), wrapper());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe("useLoginMutation", () => {
  it("تغییر کاربر داده‌های نقش قبلی را از cache حذف می‌کند", async () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.home.summary(), { total: 999 });
    client.setQueryData(queryKeys.orders.detail("PF-1"), { calc: { total: 999 } });
    vi.mocked(apiFetch).mockResolvedValue({ user: { ...ADMIN_USER, roles: ["production"], noMoney: true } });
    const { result } = renderHook(() => useLoginMutation(), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
    await act(async () => { await result.current.mutateAsync({ name: "production", password: "x" }); });
    expect(client.getQueryData(queryKeys.home.summary())).toBeUndefined();
    expect(client.getQueryData(queryKeys.orders.detail("PF-1"))).toBeUndefined();
    expect(client.getQueryData(queryKeys.auth.me())).toMatchObject({ roles: ["production"], noMoney: true });
  });
  it("ورود موفق → کاربر و ذخیره در cache کوئری me", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ user: ADMIN_USER } as never);
    const { result } = renderHook(() => useLoginMutation(), wrapper());
    await act(async () => {
      result.current.mutate({ name: "admin", password: "x" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe("admin");
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      json: { name: "admin", password: "x" },
    });
  });

  it("ورود ناموفق → خطای فارسی", async () => {
    vi.mocked(apiFetch).mockImplementation(async () => {
      throw new ApiError(401, "UNAUTHORIZED", "نام کاربری یا رمز عبور نادرست است.");
    });
    const { result } = renderHook(() => useLoginMutation(), wrapper());
    await act(async () => {
      result.current.mutate({ name: "admin", password: "wrong" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("نام کاربری یا رمز عبور نادرست است.");
  });
});

describe("useLogoutMutation", () => {
  it("فراخوانی POST /api/auth/logout", async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined as never);
    const { result } = renderHook(() => useLogoutMutation(), wrapper());
    await act(async () => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
  });
});
