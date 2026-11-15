/**
 * آزمون دیالوگ ورود اطلاعات سرنخ‌ها — PHASE_03 درگاه خروج ۵.
 *
 *  - CSV اجباری است (importLeadsSchema).
 *  - گزارش ردیف‌به‌ردیف نمایش داده می‌شود (leads.js:539 — حذف جمع‌بندی
 *    تعدادی و گزارش دقیق هر ردیف).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportDialog } from "./ImportDialog";

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
        <ImportDialog open={true} onClose={onClose} />
      </QueryClientProvider>,
    ),
  };
}

function submitForm(): void {
  const form = document.getElementById("import-form");
  if (!form) throw new Error("فرم پیدا نشد.");
  fireEvent.submit(form as HTMLFormElement);
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe("اعتبارسنجی کلاینت", () => {
  it("ثبت بدون CSV → خطای فیلد و بدون فراخوانی API", async () => {
    const { onClose } = renderDialog();
    submitForm();

    expect((document.getElementById("import-csv") as HTMLElement).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(1);
    expect(apiFetch).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("ثبت موفق + گزارش ردیف‌به‌ردیف (leads.js:539)", () => {
  it("CSV معتبر → POST /api/leads/import و نمایش نتیجه هر ردیف", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      created: 1,
      failed: 1,
      rows: [
        { row: 1, ok: true, phone: "09121234567" },
        { row: 2, ok: false, phone: "123", error: "شماره نامعتبر" },
      ],
    } as never);
    renderDialog();

    fireEvent.change(document.getElementById("import-csv") as HTMLElement, {
      target: { value: "phone,source\n09121234567,تماس ورودی\n123,تماس ورودی" },
    });
    submitForm();

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(apiFetch).toHaveBeenCalledWith("/api/leads/import", {
      method: "POST",
      json: { csv: "phone,source\n09121234567,تماس ورودی\n123,تماس ورودی", line: "prod" },
    });

    expect(screen.getByText(/ساخته‌شد: ۱/)).toBeInTheDocument();
    expect(screen.getByText(/رد‌شده: ۱/)).toBeInTheDocument();
    const rows = document.querySelectorAll(".import-row-result");
    expect(rows.length).toBe(2);
    expect(rows[0]?.getAttribute("data-ok")).toBe("true");
    expect(rows[0]?.textContent).toContain("09121234567");
    expect(rows[1]?.getAttribute("data-ok")).toBe("false");
    expect(rows[1]?.textContent).toContain("خط ۲");
    expect(rows[1]?.textContent).toContain("شماره نامعتبر");
  });
});
