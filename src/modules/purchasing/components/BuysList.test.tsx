/**
 * آزمون لیست درخواست‌های خرید — PHASE_06 §۶ (UI: حداقل یک تست به ازای لیست).
 *
 * apiFetch بر اساس URL مسیردهی می‌شود: GET /api/buys?...
 *
 * پوشش:
 *  - ردیف‌ها با وضعیت، تأمین‌کننده، تعداد اقلام و مبالغ (calc)؛
 *  - ستون‌های پولی برای نقش noMoney حذف می‌شوند (R-32)؛
 *  - فیلتر وضعیت پارامتر status را تغییر می‌دهد (CD-09)؛
 *  - دکمه «درخواست خرید جدید» فقط با مجوز purchasing.edit؛
 *  - حالت خالی/خطا (CD-09)؛
 *  - صفحه‌بندی.
 *
 * نکته: متن برچسب وضعیت هم در منوی فیلتر و هم در ردیف ظاهر می‌شود —
 * از getAllByText استفاده می‌شود. برچسب فیلترها از نوع labels جدا هستند
 * («جستجو»، «وضعیت») و با ردیف‌ها تداخل ندارند.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@components/feedback";
import { ApiError } from "@core/errors";
import { BuysList } from "./BuysList";

vi.mock("@modules/auth/hooks/useAuth", () => ({
  useMeQuery: vi.fn(),
}));

vi.mock("@core/api", () => ({
  apiFetch: vi.fn(),
}));

const { useMeQuery } = await import("@modules/auth/hooks/useAuth");
const { apiFetch } = await import("@core/api");

const mockedUseMeQuery = vi.mocked(useMeQuery);

const BUY = {
  id: "BY-1001",
  status: "req",
  supplierName: "تأمین‌کننده آریا",
  itemCount: 2,
  createdByName: "علی",
  calc: { total: 900000, due: 900000 },
  createdAt: "1405/09/01",
};

let listPayload: unknown = { items: [BUY], total: 1, page: 1, pageSize: 20 };
let listError: ApiError | null = null;

function setUser(permissions: string[]): void {
  mockedUseMeQuery.mockReturnValue({
    data: { id: "u1", name: "ali", title: "کارشناس", roles: ["purchasing"], permissions, noMoney: false },
    isLoading: false,
  } as never);
}

function mockApi(): void {
  vi.mocked(apiFetch).mockImplementation(async (url: string) => {
    if (url.startsWith("/api/buys?")) {
      if (listError) throw listError;
      return listPayload;
    }
    throw new ApiError(500, "INTERNAL", `unexpected ${url}`);
  });
}

function renderList(permissions: string[] = ["purchasing.view", "purchasing.edit", "money.view"]): void {
  setUser(permissions);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <BuysList />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** آخرین فراخوانی GET /api/buys. */
function lastBuysUrl(): string {
  const calls = vi.mocked(apiFetch).mock.calls as Array<[string, unknown?]>;
  const call = calls.filter(([url]) => url.startsWith("/api/buys?")).at(-1);
  expect(call, "GET /api/buys فراخوانی نشد").toBeDefined();
  return call![0];
}

/** انتظار برای ردیف جدول — نام تأمین‌کننده فقط در جدول است. */
async function awaitRow(): Promise<void> {
  await screen.findByText("تأمین‌کننده آریا");
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  mockedUseMeQuery.mockReset();
  listPayload = { items: [BUY], total: 1, page: 1, pageSize: 20 };
  listError = null;
  mockApi();
});

describe("BuysList", () => {
  it("ردیف‌ها با وضعیت، تأمین‌کننده، تعداد اقلام و مبالغ نمایش داده می‌شوند", async () => {
    renderList();
    await awaitRow();
    expect(screen.getByText(/BY-1001/)).toBeInTheDocument();
    // «درخواست خرید» هم در منوی وضعیت و هم در ردیف
    expect(screen.getAllByText("درخواست خرید")).toHaveLength(2);
    expect(screen.getByText("۲")).toBeInTheDocument(); // itemCount
    // مبلغ کل و بدهی باقی‌مانده هر دو ۹۰۰٬۰۰۰ هستند
    expect(screen.getAllByText(/۹۰۰٬۰۰۰/)).toHaveLength(2);
    expect(screen.getByText(/۱۴۰۵\/۰۹\/۰۱/)).toBeInTheDocument();
  });

  it("ستون‌های پولی برای نقش noMoney حذف می‌شوند (R-32)", async () => {
    listPayload = {
      items: [
        {
          id: "BY-1001",
          status: "req",
          supplierName: "تأمین‌کننده آریا",
          itemCount: 2,
          createdByName: "علی",
          createdAt: "1405/09/01",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    renderList(["purchasing.view"]);
    await awaitRow();
    expect(screen.getByText(/BY-1001/)).toBeInTheDocument();
    expect(screen.queryByText(/ریال/)).not.toBeInTheDocument();
  });

  it("فیلتر وضعیت پارامتر status را در کوئری قرار می‌دهد (CD-09)", async () => {
    renderList();
    await awaitRow();
    fireEvent.change(screen.getByLabelText("وضعیت"), { target: { value: "recv" } });
    await waitFor(() => expect(lastBuysUrl()).toContain("status=recv"));
    expect(lastBuysUrl()).toContain("page=1");
  });

  it("دکمه درخواست خرید جدید فقط با مجوز purchasing.edit نمایش داده می‌شود", async () => {
    renderList();
    expect(await screen.findByRole("button", { name: "درخواست خرید جدید" })).toBeInTheDocument();
  });

  it("نقش بدون purchasing.edit دکمه ثبت ندارد", async () => {
    renderList(["purchasing.view"]);
    await awaitRow();
    expect(screen.queryByRole("button", { name: "درخواست خرید جدید" })).not.toBeInTheDocument();
  });

  it("حالت خالی — توضیح پیش‌فرض و دکمه ایجاد اولین خرید", async () => {
    listPayload = { items: [], total: 0, page: 1, pageSize: 20 };
    renderList();
    expect(await screen.findByText("خریدی وجود ندارد")).toBeInTheDocument();
    expect(screen.getByText("هنوز درخواست خریدی ثبت نشده است.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ایجاد اولین خرید" })).toBeInTheDocument();
  });

  it("حالت خالی با فیلتر — توضیح نتیجه فیلتر", async () => {
    listPayload = { items: [], total: 0, page: 1, pageSize: 20 };
    renderList();
    expect(await screen.findByText("هنوز درخواست خریدی ثبت نشده است.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("وضعیت"), { target: { value: "recv" } });
    await waitFor(() => expect(screen.getByText("نتیجه‌ای برای فیلترهای شما پیدا نشد.")).toBeInTheDocument());
    expect(lastBuysUrl()).toContain("status=recv");
  });

  it("حالت خطا — پیام سرور و دکمه تلاش مجدد (CD-09)", async () => {
    listError = new ApiError(500, "INTERNAL", "خطا در دریافت خریدها.");
    renderList();
    expect(await screen.findByText(/خطا در دریافت خریدها/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /تلاش مجدد/ })).toBeInTheDocument();
  });

  it("صفحه‌بندی — دکمه بعد فعال و شمارش کل", async () => {
    listPayload = { items: [BUY], total: 25, page: 1, pageSize: 20 };
    renderList();
    await awaitRow();
    expect(screen.getByText(/از ۲ — ۲۵ خرید/)).toBeInTheDocument();
    const next = screen.getByRole("button", { name: "صفحه بعد" });
    expect(next).not.toBeDisabled();
    fireEvent.click(next);
    await waitFor(() => expect(lastBuysUrl()).toContain("page=2"));
    await awaitRow();
    expect(screen.getByRole("button", { name: "صفحه قبل" })).not.toBeDisabled();
  });
});
