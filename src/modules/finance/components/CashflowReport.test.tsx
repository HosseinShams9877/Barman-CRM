/**
 * آزمون گزارش جریان نقدی ماهانه — PHASE_06 §۶ (UI: حداقل یک تست به ازای لیست).
 *
 * apiFetch بر اساس URL مسیردهی می‌شود: GET /api/finance/cashflow[?month=YYYY/MM].
 *
 * پوشش:
 *  - رویدادهای پولی با جهت، شرح، مبلغ و تاریخ؛
 *  - کارت‌های جمع و خلاصه ماهانه فقط برای نقش‌های دارای money.view (R-32)؛
 *  - فیلتر ماه `YYYY/MM` و دکمه «همه ماه‌ها»؛
 *  - حالت‌های Loading/Error/Empty (CD-09).
 *
 * نکته: متن «دریافت»/«پرداخت» هم در سرستون خلاصه ماهانه و هم در ایرچیپ
 * رویدادها ظاهر می‌شود — از getAllByText استفاده می‌شود. پس از اعمال فیلتر
 * کامپوننت دوباره وارد حالت Loading می‌شود (کوئری جدید) — قبل از جستجوی
 * دکمه‌ها باید ردیف‌ها دوباره رندر شوند.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@components/feedback";
import { ApiError } from "@core/errors";
import { CashflowReport } from "./CashflowReport";

vi.mock("@modules/auth/hooks/useAuth", () => ({
  useMeQuery: vi.fn(),
}));

vi.mock("@core/api", () => ({
  apiFetch: vi.fn(),
}));

const { useMeQuery } = await import("@modules/auth/hooks/useAuth");
const { apiFetch } = await import("@core/api");

const mockedUseMeQuery = vi.mocked(useMeQuery);

/** پاسخ کامل با مبلغ — دو رویداد در یک ماه. */
const FULL = {
  months: [{ month: "1405/09", income: 100000, expense: 40000, net: 60000 }],
  rows: [
    { month: "1405/09", label: "هزینه: اجاره", direction: "expense", amount: 40000, at: "1405/09/01" },
    { month: "1405/09", label: "دریافت سفارش ۱۰۰۲", direction: "income", amount: 100000, at: "1405/09/05" },
  ],
  totalIncome: 100000,
  totalExpense: 40000,
  totalNet: 60000,
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
    if (url.startsWith("/api/finance/cashflow")) {
      if (error) throw error;
      return payload;
    }
    throw new ApiError(500, "INTERNAL", "x");
  });
}

function renderView(permissions: string[] = ["finance.view", "money.view"]): void {
  setUser(permissions);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <CashflowReport />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** آخرین فراخوانی GET /api/finance/cashflow. */
function lastCashflowUrl(): string {
  const calls = vi.mocked(apiFetch).mock.calls as Array<[string, unknown?]>;
  const call = calls.filter(([url]) => url.startsWith("/api/finance/cashflow")).at(-1);
  expect(call, "GET /api/finance/cashflow فراخوانی نشد").toBeDefined();
  return call![0];
}

/** انتظار برای ردیف رویداد — شرح فقط در جدول رویدادها وجود دارد. */
async function awaitRow(): Promise<void> {
  await screen.findByText("دریافت سفارش ۱۰۰۲");
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  mockedUseMeQuery.mockReset();
  payload = FULL;
  error = null;
  mockApi();
});

describe("CashflowReport", () => {
  it("رویدادهای جریان نقدی با جهت، شرح، مبلغ و تاریخ نمایش داده می‌شوند", async () => {
    renderView();
    await awaitRow();
    expect(screen.getByText("هزینه: اجاره")).toBeInTheDocument();
    // «پرداخت»: سرستون خلاصه + رویداد هزینه؛ «دریافت»: سرستون + رویداد درآمد
    expect(screen.getAllByText("پرداخت")).toHaveLength(2);
    expect(screen.getAllByText("دریافت")).toHaveLength(2);
    expect(screen.getByText(/۱۴۰۵\/۰۹\/۰۱/)).toBeInTheDocument();
  });

  it("کارت‌های جمع و خلاصه ماهانه برای نقش دارای money.view نمایش داده می‌شود", async () => {
    renderView();
    await awaitRow();
    expect(screen.getByText("دریافت‌ها")).toBeInTheDocument();
    expect(screen.getByText("پرداخت‌ها")).toBeInTheDocument();
    expect(screen.getByText("خالص جریان نقدی")).toBeInTheDocument();
    expect(screen.getByText("خلاصه ماهانه")).toBeInTheDocument();
    // ۱۰۰٬۰۰۰: کارت جمع + خلاصه ماهانه + ردیف رویداد
    expect(screen.getAllByText(/۱۰۰٬۰۰۰/)).toHaveLength(3);
    // ۶۰٬۰۰۰: کارت جمع + خلاصه ماهانه
    expect(screen.getAllByText(/۶۰٬۰۰۰/)).toHaveLength(2);
  });

  it("فیلتر ماه پارامتر month را در کوئری قرار می‌دهد و دکمه همه ماه‌ها ظاهر می‌شود", async () => {
    renderView();
    await awaitRow();
    fireEvent.change(screen.getByLabelText("ماه"), { target: { value: "1405/09" } });
    fireEvent.click(screen.getByRole("button", { name: "اعمال فیلتر" }));

    await waitFor(() => expect(lastCashflowUrl()).toContain("month="));
    expect(lastCashflowUrl()).toContain(encodeURIComponent("1405/09"));
    // کوئری جدید → Loading → ردیف‌ها دوباره رندر می‌شوند
    await awaitRow();
    fireEvent.click(screen.getByRole("button", { name: "همه ماه‌ها" }));
    await waitFor(() => expect(lastCashflowUrl()).not.toContain("month="));
  });

  it("ماه نامعتبر فیلتر را خالی می‌کند (قرارداد normalizeMonth)", async () => {
    renderView();
    await awaitRow();
    fireEvent.change(screen.getByLabelText("ماه"), { target: { value: "99" } });
    fireEvent.click(screen.getByRole("button", { name: "اعمال فیلتر" }));
    // normalizeMonth("99") → null → کوئری بدون پارامتر ماه
    await waitFor(() => expect(lastCashflowUrl()).not.toContain("month="));
    await awaitRow();
  });

  it("نسخه noMoney مبالغ و خلاصه ماهانه را ندارد اما رویدادها نمایش داده می‌شوند (R-32)", async () => {
    payload = {
      months: [{ month: "1405/09" }],
      rows: [
        { month: "1405/09", label: "هزینه: اجاره", direction: "expense", at: "1405/09/01" },
        { month: "1405/09", label: "دریافت سفارش ۱۰۰۲", direction: "income", at: "1405/09/05" },
      ],
    };
    renderView(["finance.view"]);
    await awaitRow();
    expect(screen.getByText("هزینه: اجاره")).toBeInTheDocument();
    // عنوان کارت + caption جدول
    expect(screen.getAllByText("رویدادهای جریان نقدی")).toHaveLength(2);
    expect(screen.queryByText(/ریال/)).not.toBeInTheDocument();
    expect(screen.queryByText("خلاصه ماهانه")).not.toBeInTheDocument();
    expect(screen.queryByText("دریافت‌ها")).not.toBeInTheDocument();
  });

  it("حالت خالی — توضیح پیش‌فرض", async () => {
    payload = { months: [], rows: [] };
    renderView();
    expect(await screen.findByText("رویداد پولی ثبت نشده است")).toBeInTheDocument();
    expect(screen.getByText("هنوز تراکنش، چک پاس‌شده یا دریافت سفارشی ثبت نشده است.")).toBeInTheDocument();
  });

  it("حالت خطا — پیام سرور و دکمه تلاش مجدد (CD-09)", async () => {
    error = new ApiError(500, "INTERNAL", "خطا در دریافت جریان نقدی.");
    renderView();
    expect(await screen.findByText(/خطا در دریافت جریان نقدی/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /تلاش مجدد/ })).toBeInTheDocument();
  });
});
