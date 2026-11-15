/**
 * آزمون لیست تراکنش‌های مالی — PHASE_06 §۶ (UI: حداقل یک تست به ازای لیست).
 *
 * apiFetch بر اساس URL مسیریابی می‌شود:
 *   /api/txns?... → لیست تراکنش‌ها (/api/finance/* برای Davis بعدی).
 *
 * پوشش:
 *  - ردیف‌ها با نوع نمایشی (toDisplayKind)، جهت، مبلغ و تاریخ فارسی؛
 *  - فیلتر نوع/جهت پارامترهای کوئری را تغییر می‌دهند (CD-09)؛
 *  - ستون مبلغ برای نقش noMoney حذف می‌شود (R-32)؛
 *  - حالت‌های Loading/Error/Empty (CD-09)؛
 *  - صفحه‌بندی.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@components/feedback";
import { ApiError } from "@core/errors";
import { TxnsView } from "./TxnsView";

vi.mock("@modules/auth/hooks/useAuth", () => ({
  useMeQuery: vi.fn(),
}));

vi.mock("@core/api", () => ({
  apiFetch: vi.fn(),
}));

const { useMeQuery } = await import("@modules/auth/hooks/useAuth");
const { apiFetch } = await import("@core/api");

const mockedUseMeQuery = vi.mocked(useMeQuery);

/** پاسخ پیش‌فرض لیست — یک هزینه اجاره. */
const TXN = {
  id: "tx1",
  kind: "هزینه — اجاره",
  direction: "expense",
  amount: 40000,
  at: "1405/09/01",
  who: "مالک",
  note: "اجاره آبان",
  byName: "علی",
  createdAt: "2026-11-01T00:00:00.000Z",
};

let listPayload: unknown = { items: [TXN], total: 1, page: 1, pageSize: 20 };
let listError: ApiError | null = null;

function setUser(permissions: string[]): void {
  mockedUseMeQuery.mockReturnValue({
    data: { id: "u1", name: "ali", title: "کارشناس", roles: ["finance"], permissions, noMoney: false },
    isLoading: false,
  } as never);
}

function mockApi(): void {
  vi.mocked(apiFetch).mockImplementation(async (url: string) => {
    if (url.startsWith("/api/txns?")) {
      if (listError) throw listError;
      return listPayload;
    }
    throw new ApiError(500, "INTERNAL", "x");
  });
}

function renderView(permissions: string[] = ["finance.edit", "money.view"]): void {
  setUser(permissions);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <TxnsView />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** آخرین فراخوانی GET /api/txns — نه اولین (فیلترها کوئری جدیدی می‌سازند). */
function lastTxnsUrl(): string {
  const calls = vi.mocked(apiFetch).mock.calls as Array<[string, unknown?]>;
  const call = calls.filter(([url]) => url.startsWith("/api/txns?")).at(-1);
  expect(call, "GET /api/txns فراخوانی نشد").toBeDefined();
  return call![0];
}

/** انتظار برای ردیف جدول — متن فقط در جدول وجود دارد، نه در منوی فیلتر. */
async function awaitRow(): Promise<void> {
  await screen.findByText("اجاره آبان");
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  mockedUseMeQuery.mockReset();
  listPayload = { items: [TXN], total: 1, page: 1, pageSize: 20 };
  listError = null;
  mockApi();
});

describe("TxnsView", () => {
  it("ردیف‌ها با نوع نمایشی، جهت، مبلغ و تاریخ فارسی نمایش داده می‌شوند", async () => {
    renderView();
    await awaitRow();
    // نوع نمایشی در جدول و در منوی فیلتر هر دو وجود دارند
    expect(screen.getAllByText("هزینه: اجاره")).toHaveLength(2); // toDisplayKind
    expect(screen.getAllByText("پرداخت")).toHaveLength(2); //chip + گزینه جهت
    expect(screen.getByText(/۴۰٬۰۰۰/)).toBeInTheDocument();
    expect(screen.getByText("مالک")).toBeInTheDocument();
    expect(screen.getByText("علی")).toBeInTheDocument();
    expect(screen.getByText(/۱۴۰۵\/۰۹\/۰۱/)).toBeInTheDocument();
  });

  it("فیلتر نوع پارامتر kind را در کوئری قرار می‌دهد (CD-09)", async () => {
    renderView();
    await awaitRow();

    fireEvent.change(screen.getByLabelText("نوع"), { target: { value: "هزینه: اجاره" } });

    await waitFor(() => expect(lastTxnsUrl()).toContain("kind="));
    expect(lastTxnsUrl()).toContain("page=1");
  });

  it("فیلتر جهت پارامتر direction را قرار می‌دهد و صفحه به ۱ برمی‌گردد", async () => {
    renderView();
    await awaitRow();

    fireEvent.change(screen.getByLabelText("جهت"), { target: { value: "expense" } });
    await waitFor(() => expect(lastTxnsUrl()).toContain("direction=expense"));
    expect(lastTxnsUrl()).toContain("page=1");
  });

  it("ستون مبلغ برای نقش noMoney حذف می‌شود (R-32)", async () => {
    setUser(["finance.view"]);
    listPayload = {
      items: [{ id: "tx1", kind: "هزینه — اجاره", direction: "expense", at: "1405/09/01", who: null, note: null, byName: "علی" }],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    renderView(["finance.view"]);
    await screen.findByText("علی");
    expect(screen.queryByText(/ریال/)).not.toBeInTheDocument();
  });

  it("حالت خالی — توضیح پیش‌فرض و دکمه ثبت اولین تراکنش", async () => {
    listPayload = { items: [], total: 0, page: 1, pageSize: 20 };
    renderView();
    expect(await screen.findByText("تراکنشی وجود ندارد")).toBeInTheDocument();
    expect(screen.getByText("هنوز هزینه یا دریافت متفرقه‌ای ثبت نشده است.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ثبت اولین تراکنش" })).toBeInTheDocument();
  });

  it("حالت خطا — پیام سرور و دکمه تلاش مجدد (CD-09)", async () => {
    listError = new ApiError(500, "INTERNAL", "خطا در دریافت تراکنش‌ها.");
    renderView();
    expect(await screen.findByText(/خطا در دریافت تراکنش‌ها/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /تلاش مجدد/ })).toBeInTheDocument();
  });

  it("صفحه‌بندی — دکمه بعد فعال و شمارش کل", async () => {
    listPayload = { items: [TXN], total: 25, page: 1, pageSize: 20 };
    renderView();
    await awaitRow();
    expect(screen.getByText(/از ۲ — ۲۵ تراکنش/)).toBeInTheDocument();

    const next = screen.getByRole("button", { name: "صفحه بعد" });
    expect(next).not.toBeDisabled();
    fireEvent.click(next);
    await waitFor(() => expect(lastTxnsUrl()).toContain("page=2"));
    await awaitRow();
    expect(screen.getByRole("button", { name: "صفحه قبل" })).not.toBeDisabled();
  });

  it("نقش بدون finance.edit دکمه ثبت در حالت خالی ندارد", async () => {
    listPayload = { items: [], total: 0, page: 1, pageSize: 20 };
    renderView(["finance.view"]);
    expect(await screen.findByText("تراکنشی وجود ندارد")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ثبت اولین تراکنش" })).not.toBeInTheDocument();
  });
});
