/**
 * آزمون فرم ایجاد/ویرایش حساب — PHASE_03 درگاه خروج ۵ (UI: حداقل یک تست به ازای فرم).
 *
 * قوانین Demo (با ارجاع — CLAUDE.md §۱۳):
 *  - نام حساب فقط وقتی kind !== unknown است اجباری می‌شود (lead-core.js:57).
 *  - شماره تلفن نرمال‌شده و ۱۱ رقمی (core.js:538 normPhone).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@core/errors";
import type { AccountDetail } from "../types/account.types";
import { AccountForm } from "./AccountForm";

vi.mock("@core/api", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@core/api");

function renderForm(account: AccountDetail | null, onClose: () => void = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    onClose,
    ...render(
      <QueryClientProvider client={client}>
        <AccountForm open={true} onClose={onClose} account={account} />
      </QueryClientProvider>,
    ),
  };
}

function submitForm(): void {
  const form = document.getElementById("account-form");
  if (!form) throw new Error("فرم پیدا نشد.");
  fireEvent.submit(form as HTMLFormElement);
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe("ایجاد حساب", () => {
  it("ثبت خالی (kind=customer) → خطای نام اجباری و بدون فراخوانی API (lead-core.js:57)", async () => {
    const { onClose } = renderForm(null);
    submitForm();

    expect(screen.getByText("نام حساب برای نوع غیر از unknown اجباری است.")).toBeInTheDocument();
    expect((document.getElementById("account-name") as HTMLElement).getAttribute("aria-invalid")).toBe("true");
    expect(apiFetch).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("kind=unknown بدون نام → معتبر (سرنخ بدون حساب شناخته‌شده)", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ id: "AC-101" } as never);
    renderForm(null);

    fireEvent.change(document.getElementById("account-kind") as HTMLElement, {
      target: { value: "unknown" },
    });
    submitForm();

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const call = vi.mocked(apiFetch).mock.calls[0];
    expect(call?.[0]).toBe("/api/customers");
    const json = (call?.[1] as { json: { name: string; kind: string } }).json;
    expect(json.name).toBe("");
    expect(json.kind).toBe("unknown");
  });

  it("نام + تلفن → POST /api/customers با تلفن نرمال‌شده", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ id: "AC-101" } as never);
    const { onClose } = renderForm(null);

    fireEvent.change(document.getElementById("account-name") as HTMLElement, {
      target: { value: "شرکت نمونه" },
    });
    const numberInput = document.querySelector(
      "input[id^='phone-number-']",
    ) as HTMLInputElement;
    fireEvent.change(numberInput, { target: { value: "09121234567" } });
    submitForm();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(apiFetch).toHaveBeenCalledWith("/api/customers", {
      method: "POST",
      json: {
        name: "شرکت نمونه",
        kind: "customer",
        active: true,
        address: "",
        note: "",
        phones: [{ kind: "mobile", number: "09121234567" }],
        contacts: [],
      },
    });
  });

  it("۴۰۹ شماره تکراری → پیام سرور بدون بستن دیالوگ (order.js:288)", async () => {
    vi.mocked(apiFetch).mockImplementation(async () => {
      throw new ApiError(409, "CONFLICT", "این شماره برای «شرکت رقیب» ثبت شده.");
    });
    const { onClose } = renderForm(null);

    fireEvent.change(document.getElementById("account-name") as HTMLElement, {
      target: { value: "شرکت نمونه" },
    });
    submitForm();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("شرکت رقیب");
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("ویرایش حساب", () => {
  const ACCOUNT: AccountDetail = {
    id: "AC-101",
    name: "شرکت نمونه",
    kind: "customer",
    active: true,
    address: "تهران",
    note: "یادداشت",
    phones: [{ id: "p1", kind: "mobile", number: "09121234567" }],
    contacts: [],
    contactCount: 0,
    leadCount: 0,
    createdAt: 1,
  };

  it("ذخیره → PATCH /api/customers/AC-101 با مقادیر فرم", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ id: "AC-101" } as never);
    const { onClose } = renderForm(ACCOUNT);

    fireEvent.change(document.getElementById("account-name") as HTMLElement, {
      target: { value: "شرکت نمونه (ویرایش)" },
    });
    submitForm();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(apiFetch).toHaveBeenCalledWith("/api/customers/AC-101", {
      method: "PATCH",
      json: expect.objectContaining({ name: "شرکت نمونه (ویرایش)", kind: "customer" }),
    });
  });
});
