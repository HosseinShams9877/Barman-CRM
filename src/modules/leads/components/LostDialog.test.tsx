/**
 * آزمون دیالوگ دلیل از دست رفتن — PHASE_03 درگاه خروج ۵.
 *
 * قانون Demo: انتقال به lost بدون دلیل ممنوع است (app/leads.js:474).
 * اعتبارسنجی کلاینت با همان Zod سمت سرور (R-13).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LostDialog } from "./LostDialog";

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
        <LostDialog open={true} leadId="LD-1001" onClose={onClose} />
      </QueryClientProvider>,
    ),
  };
}

function submitForm(): void {
  const form = document.getElementById("lost-form");
  if (!form) throw new Error("فرم پیدا نشد.");
  fireEvent.submit(form as HTMLFormElement);
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe("ورود به lost بدون دلیل ممنوع است (leads.js:474)", () => {
  it("ثبت بدون انتخاب دلیل → خطای فارسی و بدون فراخوانی API", async () => {
    const { onClose } = renderDialog();
    submitForm();

    expect(screen.getByText("دلیل از دست رفتن را انتخاب کنید؛ در گزارش لازم است.")).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("ثبت موفق", () => {
  it("انتخاب دلیل → PATCH /api/leads/LD-1001 با to=lost و lostReason", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ id: "LD-1001" } as never);
    const { onClose } = renderDialog();

    fireEvent.change(document.getElementById("lost-reason") as HTMLElement, {
      target: { value: "قیمت بالا" },
    });
    submitForm();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(apiFetch).toHaveBeenCalledWith("/api/leads/LD-1001", {
      method: "PATCH",
      json: { to: "lost", lostReason: "قیمت بالا" },
    });
  });
});
