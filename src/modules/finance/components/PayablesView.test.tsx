/**
 * آزمون گزارش پرداختنی‌ها — PHASE_06 §۶ (UI: حداقل یک تست به ازای لیست).
 *
 * apiFetch بر اساس URL مسیردهی می‌شود: GET /api/finance/payables.
 *
 * پوشش:
 *  - گروه‌بندی بر اساس تأمین‌کننده، ردیف‌های چک صادره/نسیه با مبلغ و سررسید؛
 *  - جمع کل و جمع هر گروه فقط برای نقش‌های دارای money.view (R-32)؛
 *  - حالت خالی با دکمه «ثبت هزینه» (فقط finance.edit)؛
 *  - حالت خطا با دکمه تلاش مجدد (CD-09).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ToastProvider } from "@components/feedback";
import { ApiError } from "@core/errors";
import { PayablesView } from "./PayablesView";

vi.mock("@modules/auth/hooks/useAuth", () => ({
  useMeQuery: vi.fn(),
}));

vi.mock("@core/api", () => ({
  apiFetch: vi.fn(),
}));

const { useMeQuery } = await import("@modules/auth/hooks/useAuth");
const { apiFetch } = await import("@core/api");

const mockedUseMeQuery = vi.mocked(useMeQuery);

/** پاسخ کامل با مبلغ — یک تأمین‌کننده با چک صادره و نسیه. */
const FULL = {
  groups: [
    {
      supplierId: "sup-1",
      supplierName: "تأمین‌کننده آریا",
      rows: [
        {
          supplierId: "sup-1",
          supplierName: "تأمین‌کننده آریا",
          buyId: "BY-1001",
          kind: "cheque",
          amount: 600000,
          due: "1405/08/15",
        },
        {
          supplierId: "sup-1",
          supplierName: "تأمین‌کننده آریا",
          buyId: "BY-1001",
          kind: "balance",
          amount: 300000,
          due: null,
        },
      ],
      chequeAmount: 600000,
      balanceAmount: 300000,
      total: 900000,
    },
  ],
  total: 900000,
};

let payload: unknown = FULL;
let error: ApiError | null = null;

function setUser(permissions: string[]): void {
  mockedUseMeQuery.mockReturnValue({
    data: { id: "u1", name: "ali", title: "کارشناس", roles: ["finance"], permissions, noMoney: false },
    isLoading: false,
  } as never);
}

function mockApi(): void {
  vi.mocked(apiFetch).mockImplementation(async (url: string) => {
    if (url === "/api/finance/payables") {
      if (error) throw error;
      return payload;
    }
    throw new ApiError(500, "INTERNAL", "x");
  });
}

function renderView(
  permissions: string[] = ["finance.view", "money.view"],
  onNewExpense: Mock | undefined = vi.fn(),
): Mock | undefined {
  setUser(permissions);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <PayablesView onNewExpense={onNewExpense} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return onNewExpense;
}

/** انتظار برای ردیف جدول — سررسید فقط در جدول وجود دارد. */
async function awaitRow(): Promise<void> {
  await screen.findByText(/۱۴۰۵\/۰۸\/۱۵/);
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  mockedUseMeQuery.mockReset();
  payload = FULL;
  error = null;
  mockApi();
});

describe("PayablesView", () => {
  it("گروه‌بندی بر اساس تأمین‌کننده با چک صادره و نسیه نمایش داده می‌شود", async () => {
    renderView();
    await awaitRow();
    expect(screen.getByText("تأمین‌کننده آریا")).toBeInTheDocument();
    expect(screen.getAllByText("چک صادره")).toHaveLength(1);
    expect(screen.getAllByText("نسیه")).toHaveLength(1);
    expect(screen.getByText(/۶۰۰٬۰۰۰/)).toBeInTheDocument();
    expect(screen.getByText(/۳۰۰٬۰۰۰/)).toBeInTheDocument();
    // شناسه خرید با ارقام فارسی نمایش داده می‌شود — هر دو ردیف
    expect(screen.getAllByText(/BY-۱۰۰۱/)).toHaveLength(2);
  });

  it("جمع کل و جمع گروه برای نقش دارای money.view نمایش داده می‌شود", async () => {
    renderView();
    await awaitRow();
    expect(screen.getByText("جمع کل پرداختنی‌ها")).toBeInTheDocument();
    expect(screen.getAllByText(/۹۰۰٬۰۰۰/)).toHaveLength(2); // گروه + جمع کل
  });

  it("نسخه noMoney مبلغ ندارد اما ساختار گروه‌ها حفظ می‌شود (R-32)", async () => {
    payload = {
      groups: [
        {
          supplierId: "sup-1",
          supplierName: "تأمین‌کننده آریا",
          rows: [
            {
              supplierId: "sup-1",
              supplierName: "تأمین‌کننده آریا",
              buyId: "BY-1001",
              kind: "cheque",
              due: "1405/08/15",
            },
          ],
        },
      ],
    };
    renderView(["finance.view"]);
    await awaitRow();
    expect(screen.getByText("تأمین‌کننده آریا")).toBeInTheDocument();
    expect(screen.getAllByText("چک صادره")).toHaveLength(1);
    expect(screen.queryByText(/ریال/)).not.toBeInTheDocument();
    expect(screen.queryByText("جمع کل پرداختنی‌ها")).not.toBeInTheDocument();
  });

  it("حالت خالی — دکمه ثبت هزینه با مجوز finance.edit", async () => {
    payload = { groups: [] };
    const onNewExpense = renderView(["finance.view", "finance.edit", "money.view"]);
    expect(await screen.findByText("پرداختنی‌ای وجود ندارد")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: "ثبت هزینه" });
    fireEvent.click(btn);
    await waitFor(() => expect(onNewExpense as Mock).toHaveBeenCalled());
  });

  it("حالت خالی بدون finance.edit دکمه ثبت ندارد", async () => {
    payload = { groups: [] };
    renderView(["finance.view"]);
    expect(await screen.findByText("پرداختنی‌ای وجود ندارد")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ثبت هزینه" })).not.toBeInTheDocument();
  });

  it("حالت خطا — پیام سرور و دکمه تلاش مجدد (CD-09)", async () => {
    error = new ApiError(500, "INTERNAL", "خطا در دریافت پرداختنی‌ها.");
    renderView();
    expect(await screen.findByText(/خطا در دریافت پرداختنی‌ها/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /تلاش مجدد/ })).toBeInTheDocument();
  });
});
