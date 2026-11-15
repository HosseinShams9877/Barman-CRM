/**
 * آزمون دیالوگ «چی شد؟» — PHASE_03 درگاه خروج ۵.
 *
 *  - حداقل یکی از نتیجه یا یادداشت باید پر باشد (app/leads.js:393-399).
 *  - تاریخ پیگیری بعدی با ارقام فارسی وارد می‌شود و در قرارداد
 *    `YYYY/MM/DD` ارقام ASCII به API پاس می‌شود (CD-06 — رفت‌وبرگشت تقویم).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FollowupDialog } from "./FollowupDialog";

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
        <FollowupDialog open={true} leadId="LD-1001" onClose={onClose} />
      </QueryClientProvider>,
    ),
  };
}

function submitForm(): void {
  const form = document.getElementById("followup-form");
  if (!form) throw new Error("فرم پیدا نشد.");
  fireEvent.submit(form as HTMLFormElement);
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe("حداقل یکی از نتیجه یا یادداشت (leads.js:393)", () => {
  it("ثبت خالی → خطای فارسی و بدون فراخوانی API", async () => {
    const { onClose } = renderDialog();
    submitForm();

    expect(screen.getByText("حداقل یکی از نتیجه یا یادداشت باید پر باشد.")).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("ثبت موفق + رفت‌وبرگشت تقویمی (CD-06)", () => {
  it("یادداشت و تاریخ با ارقام فارسی → POST با nextAt استاندارد ASCII", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ id: "f9" } as never);
    const { onClose } = renderDialog();

    fireEvent.change(document.getElementById("followup-note") as HTMLElement, {
      target: { value: "تماس گرفته شد" },
    });
    const dateInput = document.getElementById("followup-next") as HTMLInputElement;
    fireEvent.focus(dateInput);
    fireEvent.change(dateInput, { target: { value: "۱۴۰۵/۸/۹" } });

    submitForm();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(apiFetch).toHaveBeenCalledWith("/api/leads/LD-1001/followups", {
      method: "POST",
      json: { result: "", note: "تماس گرفته شد", nextAt: "1405/08/09" },
    });
  });

  it("فقط نتیجه تماس (بدون یادداشت) نیز معتبر است", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ id: "f8" } as never);
    renderDialog();

    fireEvent.change(document.getElementById("followup-result") as HTMLElement, {
      target: { value: "پاسخ نداد" },
    });
    submitForm();

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const call = vi.mocked(apiFetch).mock.calls[0]?.[1] as { json: { nextAt: string | undefined } };
    expect(call.json.nextAt).toBeUndefined();
  });
});
