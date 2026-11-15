/**
 * آزمون فرم ایجاد سرنخ — PHASE_03 درگاه خروج ۵ (UI: حداقل یک تست به ازای فرم).
 *
 * apiFetch موک شده است؛ اعتبارسنجی کلاینت (همان Zod سمت سرور — R-13)
 * و نمایش خطای ۴۰۹ سرور بررسی می‌شود.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@core/errors";
import { LeadFormDialog } from "./LeadFormDialog";

vi.mock("@core/api", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@core/api");

function renderDialog(onClose: () => void = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    onClose,
    ...render(
      <QueryClientProvider client={client}>
        <LeadFormDialog open={true} onClose={onClose} />
      </QueryClientProvider>,
    ),
  };
}

function field(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`عنصر ${id} پیدا نشد.`);
  return el;
}

function submitForm(): void {
  const form = document.getElementById("lead-form");
  if (!form) throw new Error("فرم پیدا نشد.");
  fireEvent.submit(form as HTMLFormElement);
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe("اعتبارسنجی کلاینت (R-13)", () => {
  it("ثبت بدون شماره و منبع → خطای هر دو فیلد و بدون فراخوانی API", async () => {
    const { onClose } = renderDialog();
    submitForm();

    // هر دو فیلد اجباری پیام خطای خود را نشان می‌دهند (پیام‌های ساده
    // انگلیسی هستند — دیکشنری فارسی به فاز بعد موکول شده، Q-XX deferred).
    const phoneInput = document.getElementById("lead-phone") as HTMLInputElement;
    const sourceSelect = document.getElementById("lead-source") as HTMLSelectElement;
    expect(phoneInput.getAttribute("aria-invalid")).toBe("true");
    expect(sourceSelect.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(2);
    expect(apiFetch).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("شماره کوتاه → پیام فارسی Demo (lead-core.js:54)", async () => {
    renderDialog();
    fireEvent.change(field("lead-phone"), { target: { value: "12345" } });
    submitForm();
    expect(screen.getByText(/شماره را کامل و درست وارد کنید/)).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe("ثبت موفق", () => {
  it("پر کردن شماره و منبع → POST /api/leads و بستن دیالوگ", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ id: "LD-1001" } as never);
    const { onClose } = renderDialog();

    fireEvent.change(field("lead-phone"), { target: { value: "09121234567" } });
    fireEvent.change(field("lead-source"), { target: { value: "تماس ورودی" } });
    submitForm();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(apiFetch).toHaveBeenCalledWith("/api/leads", {
      method: "POST",
      json: {
        phone: "09121234567",
        source: "تماس ورودی",
        line: "prod",
        title: "",
        amount: null,
        note: "",
      },
    });
  });

  it("مبلغ اختیاری به‌صورت number ارسال می‌شود", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ id: "LD-1002" } as never);
    renderDialog();

    fireEvent.change(field("lead-phone"), { target: { value: "09121234567" } });
    fireEvent.change(field("lead-source"), { target: { value: "تماس ورودی" } });
    fireEvent.change(field("lead-amount"), { target: { value: "5000000" } });
    submitForm();

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const call = vi.mocked(apiFetch).mock.calls[0]?.[1] as { json: { amount: number | null } };
    expect(call.json.amount).toBe(5000000);
  });
});

describe("خطای سرور", () => {
  it("۴۰۹ شماره تکراری → پیام در role=alert بدون بستن دیالوگ", async () => {
    vi.mocked(apiFetch).mockImplementation(async () => {
      throw new ApiError(409, "CONFLICT", "این شماره قبلاً ثبت شده؛ سرنخ تکراری ساخته نمی‌شود.");
    });
    const { onClose } = renderDialog();

    fireEvent.change(field("lead-phone"), { target: { value: "09121234567" } });
    fireEvent.change(field("lead-source"), { target: { value: "تماس ورودی" } });
    submitForm();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("تکراری");
    expect(onClose).not.toHaveBeenCalled();
  });
});
