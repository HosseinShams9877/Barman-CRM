/**
 * آزمون صفحه مالی — PHASE_06 §۶ (UI: حداقل یک تست به ازای صفحه).
 *
 * FinancePage صاحب دیالوگ ثبت تراکنش است و onNewIncome/onNewExpense را به
 * گزارش‌های مطالبات/پرداختنی‌ها پاس می‌دهد.
 *
 * apiFetch مسیردهی می‌شود: /api/txns، /api/finance/receivables،
 * /api/finance/payables، /api/finance/cashflow.
 *
 * پوشش:
 *  - چهار بخش (تراکنش‌ها، مطالبات، پرداختنی‌ها، جریان نقدی) وجود دارند؛
 *  - دکمه «ثبت هزینه / دریافت» دیالوگ را باز می‌کند (فقط finance.edit)؛
 *  - نقش بدون finance.edit دکمه و دیالوگ ندارد.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@components/feedback";
import { ApiError } from "@core/errors";
import { FinancePage } from "./FinancePage";

vi.mock("@modules/auth/hooks/useAuth", () => ({
  useMeQuery: vi.fn(),
}));

vi.mock("@core/api", () => ({
  apiFetch: vi.fn(),
}));

const { useMeQuery } = await import("@modules/auth/hooks/useAuth");
const { apiFetch } = await import("@core/api");

const mockedUseMeQuery = vi.mocked(useMeQuery);

/** همه اندپوینت‌ها خالی — فقط ساختار صفحه بررسی می‌شود. */
let payloads: Record<string, unknown> = {
  "/api/txns?": { items: [], total: 0, page: 1, pageSize: 20 },
  "/api/finance/receivables": { groups: [] },
  "/api/finance/payables": { groups: [] },
  "/api/finance/cashflow": { months: [], rows: [] },
  "/api/home/summary": { workspace: { now: 1794820000000 } },
};

function setUser(permissions: string[]): void {
  mockedUseMeQuery.mockReturnValue({
    data: { id: "u1", name: "ali", title: "کارشناس", roles: ["finance"], permissions, noMoney: false },
    isLoading: false,
  } as never);
}

function mockApi(): void {
  vi.mocked(apiFetch).mockImplementation(async (url: string) => {
    const entry = Object.entries(payloads).find(([prefix]) => url.startsWith(prefix));
    if (!entry) throw new ApiError(500, "INTERNAL", `unexpected ${url}`);
    return entry[1];
  });
}

function renderPage(permissions: string[] = ["finance.view", "finance.edit", "money.view"]): void {
  setUser(permissions);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <FinancePage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  mockedUseMeQuery.mockReset();
  mockApi();
});

describe("FinancePage", () => {
  it("دریافتنی و پرداختنی در تب‌های مجزا هستند", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "سررسیدها و بدهکاری‌ها", level: 1 })).toBeInTheDocument();
    // عنوان بخش‌ها بعد از بارگذاری ظاهر می‌شوند — منتظر اولین بخش می‌مانیم
    await waitFor(() => expect(screen.getByRole("tab", { name: "دریافتنی‌ها" })).toBeInTheDocument());
    expect(screen.getByRole("tab", { name: "پرداختنی‌ها" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "بدهکاران" })).toBeInTheDocument();
    expect(screen.getByText("جریان نقدی")).toBeInTheDocument();
  });

  it("دکمه ثبت هزینه/دریافت دیالوگ را باز می‌کند (finance.edit)", async () => {
    renderPage();
    const btn = await screen.findByRole("button", { name: "ثبت هزینه / دریافت" });
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByRole("dialog", { name: "ثبت هزینه / دریافت متفرقه" })).toBeInTheDocument());
    // منوی ۸ نوع ثابت در دیالوگ موجود است
    const select = screen.getByLabelText("نوع تراکنش");
    expect(Array.from(select.querySelectorAll("option"))).toHaveLength(8);
  });

  it("نقش بدون finance.edit دکمه ثبت و دیالوگ را ندارد", async () => {
    renderPage(["finance.view", "money.view"]);
    await waitFor(() => expect(screen.getByRole("tab", { name: "دریافتنی‌ها" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "ثبت هزینه / دریافت" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
