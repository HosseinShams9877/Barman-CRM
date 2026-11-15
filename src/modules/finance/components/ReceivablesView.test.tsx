/**
 * آزمون گزارش مطالبات — PHASE_06 §۶ (UI: حداقل یک تست به ازای لیست).
 *
 * apiFetch بر اساس URL مسیردهی می‌شود: GET /api/finance/receivables.
 *
 * پوشش:
 *  - گروه‌بندی بر اساس حساب، ردیف‌های چک دریافتی/نسیه با مبلغ و سررسید؛
 *  - جمع کل و جمع هر گروه فقط برای نقش‌های دارای money.view (R-32)؛
 *  - حالت خالی با دکمه «ثبت دریافت متفرقه» (فقط finance.edit)؛
 *  - حالت خطا با دکمه تلاش مجدد (CD-09).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ToastProvider } from "@components/feedback";
import { ApiError } from "@core/errors";
import { ReceivablesView } from "./ReceivablesView";

vi.mock("@modules/auth/hooks/useAuth", () => ({
  useMeQuery: vi.fn(),
}));

vi.mock("@core/api", () => ({
  apiFetch: vi.fn(),
}));

const { useMeQuery } = await import("@modules/auth/hooks/useAuth");
const { apiFetch } = await import("@core/api");

const mockedUseMeQuery = vi.mocked(useMeQuery);

/** پاسخ کامل با مبلغ (نقش دارای money.view) — یک حساب با چک و نسیه. */
const FULL = {
  groups: [
    {
      accountId: "acc-1",
      accountName: "حساب جاری علی",
      rows: [
        {
          accountId: "acc-1",
          accountName: "حساب جاری علی",
          orderId: "1002",
          kind: "cheque",
          amount: 500000,
          due: "1405/09/20",
        },
        {
          accountId: "acc-1",
          accountName: "حساب جاری علی",
          orderId: "1003",
          kind: "balance",
          amount: 250000,
          due: null,
        },
      ],
      chequeAmount: 500000,
      balanceAmount: 250000,
      total: 750000,
    },
  ],
  total: 750000,
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
    if (url === "/api/finance/receivables") {
      if (error) throw error;
      return payload;
    }
    throw new ApiError(500, "INTERNAL", "x");
  });
}

function renderView(
  permissions: string[] = ["finance.view", "money.view"],
  onNewIncome: Mock | undefined = vi.fn(),
): Mock | undefined {
  setUser(permissions);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ReceivablesView onNewIncome={onNewIncome} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return onNewIncome;
}

/** انتظار برای ردیف جدول — فقط در جدول وجود دارد. */
async function awaitRow(): Promise<void> {
  await screen.findByText(/۱۴۰۵\/۰۹\/۲۰/);
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  mockedUseMeQuery.mockReset();
  payload = FULL;
  error = null;
  mockApi();
});

describe("ReceivablesView", () => {
  it("گروه‌بندی بر اساس حساب با چک دریافتی و نسیه نمایش داده می‌شود", async () => {
    renderView();
    await awaitRow();
    expect(screen.getByText("حساب جاری علی")).toBeInTheDocument();
    expect(screen.getAllByText("چک دریافتی")).toHaveLength(1);
    expect(screen.getAllByText("نسیه")).toHaveLength(1);
    expect(screen.getByText(/۵۰۰٬۰۰۰/)).toBeInTheDocument();
    expect(screen.getByText(/۲۵۰٬۰۰۰/)).toBeInTheDocument();
    expect(screen.getByText(/۱۰۰۲/)).toBeInTheDocument();
  });

  it("جمع کل و جمع گروه برای نقش دارای money.view نمایش داده می‌شود", async () => {
    renderView();
    await awaitRow();
    expect(screen.getByText("جمع کل مطالبات")).toBeInTheDocument();
    expect(screen.getAllByText(/۷۵۰٬۰۰۰/)).toHaveLength(2); // گروه + جمع کل
  });

  it("نسخه noMoney مبلغ ندارد اما ساختار گروه‌ها حفظ می‌شود (R-32)", async () => {
    payload = {
      groups: [
        {
          accountId: "acc-1",
          accountName: "حساب جاری علی",
          rows: [
            {
              accountId: "acc-1",
              accountName: "حساب جاری علی",
              orderId: "1002",
              kind: "cheque",
              due: "1405/09/20",
            },
          ],
        },
      ],
    };
    renderView(["finance.view"]);
    await awaitRow();
    expect(screen.getByText("حساب جاری علی")).toBeInTheDocument();
    expect(screen.getAllByText("چک دریافتی")).toHaveLength(1);
    expect(screen.queryByText(/ریال/)).not.toBeInTheDocument();
    expect(screen.queryByText("جمع کل مطالبات")).not.toBeInTheDocument();
  });

  it("حالت خالی — دکمه ثبت دریافت متفرقه با مجوز finance.edit", async () => {
    payload = { groups: [] };
    const onNewIncome = renderView(["finance.view", "finance.edit", "money.view"]);
    expect(await screen.findByText("مطالباتی وجود ندارد")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: "ثبت دریافت متفرقه" });
    fireEvent.click(btn);
    await waitFor(() => expect(onNewIncome as Mock).toHaveBeenCalled());
  });

  it("حالت خالی بدون finance.edit دکمه ثبت ندارد", async () => {
    payload = { groups: [] };
    renderView(["finance.view"]);
    expect(await screen.findByText("مطالباتی وجود ندارد")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ثبت دریافت متفرقه" })).not.toBeInTheDocument();
  });

  it("حالت خطا — پیام سرور و دکمه تلاش مجدد (CD-09)", async () => {
    error = new ApiError(500, "INTERNAL", "خطا در دریافت مطالبات.");
    renderView();
    expect(await screen.findByText(/خطا در دریافت مطالبات/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /تلاش مجدد/ })).toBeInTheDocument();
  });
});
