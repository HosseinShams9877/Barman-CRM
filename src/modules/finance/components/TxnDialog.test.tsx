/**
 * آزمون فرم ثبت هزینه/دریافت متفرقه — PHASE_06 §۶ (UI: حداقل یک تست به ازای فرم).
 *
 * apiFetch فقط POST /api/txns را مسیریابی می‌کند (useCreateTxnMutation).
 *
 * پوشش:
 *  - هر ۸ نوع ثابت Demo در منوی کشویی موجود است (app/fin.js:145)؛
 *  - ارسال payload صحیح (kind، amount عددی، at، who، note)؛
 *  - kind = «دریافت متفرقه» نیز قابل انتخاب است (درآمد)؛
 *  - فیلد مبلغ برای نقش noMoney پنهان می‌شود (R-32)؛
 *  - خطای سروور زیر فرم نشان داده می‌شود و دیالوگ باز می‌ماند.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ToastProvider } from "@components/feedback";
import { ApiError } from "@core/errors";
import { TxnDialog } from "./TxnDialog";

vi.mock("@modules/auth/hooks/useAuth", () => ({
  useMeQuery: vi.fn(),
}));

vi.mock("@core/api", () => ({
  apiFetch: vi.fn(),
}));

const { useMeQuery } = await import("@modules/auth/hooks/useAuth");
const { apiFetch } = await import("@core/api");

const mockedUseMeQuery = vi.mocked(useMeQuery);

function setUser(permissions: string[]): void {
  mockedUseMeQuery.mockReturnValue({
    data: { id: "u1", name: "ali", title: "کارشناس", roles: ["finance"], permissions, noMoney: false },
    isLoading: false,
  } as never);
}

/** POST ناموفق برای آزمون نمایش خطای سروور. */
let failMutation = false;

function mockApi(): void {
  vi.mocked(apiFetch).mockImplementation(
    async (url: string, init?: { method?: string; json?: unknown }) => {
      if (url === "/api/txns" && init?.method === "POST") {
        if (failMutation) {
          throw new ApiError(400, "BAD_REQUEST", "مبلغ باید عدد صحیح مثبت باشد.");
        }
        return {
          id: "tx1",
          kind: "هزینه — اجاره",
          direction: "expense",
          amount: 40000,
          at: "1405/09/01",
          who: "مالک",
          note: null,
          byName: "علی",
          createdAt: "2026-11-01T00:00:00.000Z",
        };
      }
      throw new ApiError(500, "INTERNAL", "x");
    },
  );
}

function renderDialog(onClose: Mock = vi.fn()): Mock {
  setUser(["finance.edit", "money.view"]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <TxnDialog open onClose={onClose} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return onClose;
}

/** پر کردن فرم با مقادیر معتبر. */
function fill(overrides: { amount?: string } = {}): void {
  fireEvent.change(screen.getByLabelText("مبلغ (ریال)"), {
    target: { value: overrides.amount ?? "40000" },
  });
  // برچسب دارای نشانگر اجباری « *» است — تطبیق با عبارت منظم
  fireEvent.change(screen.getByLabelText(/تاریخ تراکنش/), {
    target: { value: "1405/09/01" },
  });
  fireEvent.change(screen.getByLabelText("طرف مقابل"), { target: { value: "مالک" } });
  fireEvent.change(screen.getByLabelText("یادداشت"), { target: { value: "اجاره آبان" } });
}

/** ارسال فرم — دکمه submit بیرون عنصر form است. */
function submitForm(): void {
  fireEvent.submit(document.getElementById("txn-kind")?.closest("form") as HTMLFormElement);
}

/** آخرین فراخوانی POST /api/txns. */
function lastPost(): { url: string; init: { method?: string; json?: unknown } } {
  const calls = vi.mocked(apiFetch).mock.calls as Array<[string, { method?: string; json?: unknown }]>;
  const post = calls.find(([u, init]) => u === "/api/txns" && init?.method === "POST");
  expect(post, "POST /api/txns فراخوانی نشد").toBeDefined();
  return { url: post![0], init: post![1] };
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  mockedUseMeQuery.mockReset();
  failMutation = false;
  mockApi();
});

describe("TxnDialog", () => {
  it("هر ۸ نوع ثابت Demo در منوی کشویی موجود است (app/fin.js:145)", () => {
    renderDialog();
    const select = screen.getByLabelText("نوع تراکنش");
    expect(select).toBeInTheDocument();
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toHaveLength(8);
    expect(options).toContain("هزینه: حقوق پرسنل");
    expect(options).toContain("هزینه: اجاره");
    expect(options).toContain("هزینه: آب، برق، گاز و تلفن");
    expect(options).toContain("هزینه: حمل و بارگیری");
    expect(options).toContain("هزینه: تبلیغات");
    expect(options).toContain("هزینه: تعمیرات و ابزار");
    expect(options).toContain("هزینه: سایر");
    expect(options).toContain("دریافت متفرقه");
  });

  it("فرم پرشده → POST /api/txns با payload صحیح", async () => {
    const onClose = renderDialog();
    fill();
    submitForm();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const { url, init } = lastPost();
    expect(url).toBe("/api/txns");
    expect(init.method).toBe("POST");
    expect(init.json).toMatchObject({
      kind: "هزینه: حقوق پرسنل",
      amount: 40000,
      at: "1405/09/01",
      who: "مالک",
      note: "اجاره آبان",
    });
  });

  it("kind = «دریافت متفرقه» قابل انتخاب است (درآمد)", async () => {
    const onClose = renderDialog();
    fireEvent.change(screen.getByLabelText("نوع تراکنش"), { target: { value: "دریافت متفرقه" } });
    fill({ amount: "25000" });
    submitForm();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(lastPost().init.json).toMatchObject({ kind: "دریافت متفرقه", amount: 25000 });
  });

  it("فیلدهای اختیاری خالی در payload قرار نمی‌گیرند", async () => {
    const onClose = renderDialog();
    fill();
    fireEvent.change(screen.getByLabelText("طرف مقابل"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("یادداشت"), { target: { value: "" } });
    submitForm();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(lastPost().init.json).toMatchObject({ who: undefined, note: undefined });
  });

  it("فیلد مبلغ برای نقش noMoney پنهان می‌شود (R-32)", () => {
    setUser(["finance.edit"]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <TxnDialog open onClose={vi.fn()} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(screen.queryByLabelText("مبلغ (ریال)")).not.toBeInTheDocument();
    // بقیه فیلدها موجود است
    expect(screen.getByLabelText("نوع تراکنش")).toBeInTheDocument();
    expect(screen.getByLabelText(/تاریخ تراکنش/)).toBeInTheDocument();
  });

  it("خطای سروور زیر فرم نشان داده می‌شود و دیالوگ باز می‌ماند", async () => {
    failMutation = true;
    const onClose = renderDialog();
    fill();
    submitForm();

    expect(await screen.findByText(/مبلغ باید عدد صحیح مثبت باشد/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
