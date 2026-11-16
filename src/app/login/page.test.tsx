/**
 * آزمون صفحه ورود — PHASE_02 §۱۰.
 *
 * apiFetch موک می‌شود؛ صفحه باید خطای فارسی سرور را نشان دهد،
 * اعتبارسنجی کلاینت (فیلد خالی) را انجام دهد و در موفقیت به / هدایت کند.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@core/errors";
import { ToastProvider } from "@components/feedback";
import LoginPage from "./page";

vi.mock("@core/api", () => ({
  apiFetch: vi.fn(),
}));

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const { apiFetch } = await import("@core/api");

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <LoginPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function field(label: string): HTMLElement {
  // برچسب شامل نشان * اجباری است — جستجو با عبارت منظم
  const el = screen.getByLabelText(new RegExp(label));
  if (!el) throw new Error(`فیلد ${label} پیدا نشد`);
  return el;
}

function submit(): void {
  fireEvent.click(screen.getByRole("button", { name: "ورود" }));
}

const ADMIN_USER = {
  id: "u1",
  name: "ali",
  title: null,
  roles: ["admin"],
  permissions: [],
  noMoney: false,
};

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  replace.mockReset();
});

describe("صفحه ورود", () => {
  it("برچسب‌های فارسی و دکمه ورود", () => {
    renderPage();
    expect(screen.getByText("ورود به سامانه بارمان")).toBeInTheDocument();
    expect(screen.getByText("رمز عبور")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ورود" })).toBeInTheDocument();
  });

  it("فیلد خالی → پیام فارسی کلاینت بدون فراخوانی API", () => {
    renderPage();
    submit();
    expect(screen.getByText("نام کاربری الزامی است.")).toBeInTheDocument();
    expect(screen.getByText("رمز عبور الزامی است.")).toBeInTheDocument();
    expect(vi.mocked(apiFetch)).not.toHaveBeenCalled();
  });

  it("خطای ۴۰۱ سرور → پیام یکسان فارسی", async () => {
    vi.mocked(apiFetch).mockImplementation(async () => {
      throw new ApiError(401, "UNAUTHORIZED", "نام کاربری یا رمز عبور نادرست است.");
    });
    renderPage();

    fireEvent.change(field("نام کاربری"), { target: { value: "ali" } });
    fireEvent.change(field("رمز عبور"), { target: { value: "wrong-pass" } });
    submit();

    expect(await screen.findByText("نام کاربری یا رمز عبور نادرست است.")).toBeInTheDocument();
  });

  it("ورود موفق ادمین → هدایت یک‌بار به /admin", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ user: ADMIN_USER } as never);
    renderPage();

    fireEvent.change(field("نام کاربری"), { target: { value: "ali" } });
    fireEvent.change(field("رمز عبور"), { target: { value: "pass" } });
    submit();

    await screen.findByText("خوش آمدید، ali");
    expect(replace).toHaveBeenCalledWith("/admin");
    expect(replace).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("خوش آمدید، ali")).toHaveLength(1);
  });
});
