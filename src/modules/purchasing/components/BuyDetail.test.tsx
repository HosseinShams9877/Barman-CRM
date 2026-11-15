/**
 * آزمون صفحه جزئیات خرید — PHASE_06 §۷ (UI: حداقل یک تست به ازای صفحه).
 *
 * apiFetch بر اساس URL مسیردهی می‌شود:
 *   GET   /api/buys/BY-1001                       (useBuyDetailQuery)
 *   POST  /api/buys/BY-1001/approve               (req → ok)
 *   POST  /api/buys/BY-1001/finance               (ok → fin + چک‌ها)
 *   POST  /api/buys/BY-1001/receive               (fin → recv + حرکت buy)
 *   PATCH /api/buys/BY-1001/cheques/[cid]         (issued → paid)
 *
 * پوشش:
 *  - نمایش اقلام، چک‌ها، تاریخچه وضعیت و مبالغ (calc)؛
 *  - دکمه‌های گذار فقط در وضعیت مجاز و با مجوز مربوطه؛
 *  - ارسال rev در انتقال‌ها (optimistic concurrency)؛
 *  - دیالوگ تأیید مالی با ثبت چک صادره؛
 *  - پاس کردن چک؛
 *  - نسخه noMoney (R-32) — بدون فیلدهای پولی اما با ساختار کامل؛
 *  - حالت خطا (CD-09).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@components/feedback";
import { ApiError } from "@core/errors";
import { toFaDigits } from "@core/formatting";
import { instantToJalaliIso } from "@core/calendar";
import type { BuyDetail, BuyDetailNoMoney } from "../types/buy.types";
import { BuyDetail as BuyDetailView } from "./BuyDetail";

vi.mock("@modules/auth/hooks/useAuth", () => ({
  useMeQuery: vi.fn(),
}));

vi.mock("@core/api", () => ({
  apiFetch: vi.fn(),
}));

const { useMeQuery } = await import("@modules/auth/hooks/useAuth");
const { apiFetch } = await import("@core/api");

const mockedUseMeQuery = vi.mocked(useMeQuery);

const ID = "BY-1001";
/** لحظه ثبت درخواست — تاریخ شمسی آن در زمان آزمون محاسبه می‌شود (CD-06). */
const AT_MS = 1_800_000_000_000;
const AT_FA = toFaDigits(instantToJalaliIso(AT_MS));

const FULL_PERMS = [
  "purchasing.view",
  "purchasing.edit",
  "purchasing.approve",
  "finance.view",
  "finance.edit",
  "finance.approve",
  "inventory.moves",
  "money.view",
];

/** پایه‌ی خرید کامل — هر تست وضعیت مورد نظر را بازنویسی می‌کند. */
function buyBase(status: BuyDetail["status"]): BuyDetail {
  return {
    id: ID,
    status,
    supplierId: "sup-1",
    supplierName: "تأمین‌کننده آریا",
    note: "خرید هفتگی",
    createdByName: "علی",
    createdAt: "1405/09/01",
    updatedAt: AT_MS,
    rev: 3,
    items: [
      {
        id: "it-1",
        materialId: "mat-1",
        materialName: "پودر کاکائو",
        materialCode: "RM-001",
        unit: "kg",
        qty: 5,
        price: 90000,
      },
    ],
    cheques: [{ id: "chq-1", amount: 500000, due: "1405/09/15", sayad: "12345", status: "issued" }],
    statusLog: [{ id: "log-1", fromStatus: null, toStatus: "req", at: AT_MS, byName: "علی", note: "ثبت درخواست" }],
    calc: { total: 450000, paid: 0, due: 450000 },
  };
}

let detail: BuyDetail | BuyDetailNoMoney = buyBase("req");
let detailError: ApiError | null = null;
let transitionError: string | null = null;

function setUser(permissions: string[]): void {
  mockedUseMeQuery.mockReturnValue({
    data: { id: "u1", name: "ali", title: "کارشناس", roles: ["purchasing"], permissions, noMoney: false },
    isLoading: false,
  } as never);
}

function mockApi(): void {
  vi.mocked(apiFetch).mockImplementation(
    async (url: string, init?: { method?: string; json?: unknown }) => {
      const method = init?.method ?? "GET";
      if (url === `/api/buys/${ID}` && method === "GET") {
        if (detailError) throw detailError;
        return detail;
      }
      // انتقال‌ها — پاسخ، خرید با وضعیت بعدی است.
      for (const step of ["approve", "finance", "receive"] as const) {
        if (url === `/api/buys/${ID}/${step}` && method === "POST") {
          if (transitionError) throw new ApiError(409, "CONFLICT", transitionError);
          const next = { approve: "ok", finance: "fin", receive: "recv" } as const;
          return { ...detail, status: next[step], rev: detail.rev + 1 };
        }
      }
      if (url.startsWith(`/api/buys/${ID}/cheques/`) && method === "PATCH") {
        if (transitionError) throw new ApiError(409, "CONFLICT", transitionError);
        return {
          ...detail,
          cheques: detail.cheques.map((c) => (c.id === "chq-1" ? { ...c, status: "paid" as const } : c)),
        };
      }
      throw new ApiError(500, "INTERNAL", `unexpected ${method} ${url}`);
    },
  );
}

function renderDetail(permissions: string[] = FULL_PERMS): void {
  setUser(permissions);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <BuyDetailView id={ID} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** انتظار برای بارگذاری جزئیات — عنوان h1 فقط بعد از بارگذاری است. */
async function awaitLoaded(): Promise<void> {
  await screen.findByRole("heading", { name: /خرید/, level: 1 });
}

/** آخرین فراخوانی APPLY به یکی از اندپوینت‌های انتقال/چک. */
function lastCall(method: string, suffix: string): { url: string; json?: unknown } {
  const calls = vi.mocked(apiFetch).mock.calls as Array<[string, { method?: string; json?: unknown }]>;
  const call = calls
    .filter(([url, init]) => init?.method === method && url === `/api/buys/${ID}${suffix}`)
    .at(-1);
  expect(call, `${method} /api/buys/${ID}${suffix} فراخوانی نشد`).toBeDefined();
  return { url: call![0], json: call![1].json };
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  mockedUseMeQuery.mockReset();
  detailError = null;
  transitionError = null;
  detail = buyBase("req");
  mockApi();
});

describe("BuyDetail", () => {
  it("جزئیات خرید در وضعیت req — اقلام، چک، تاریخچه و مبالغ", async () => {
    renderDetail();
    await awaitLoaded();
    expect(screen.getByText("تأمین‌کننده آریا")).toBeInTheDocument();
    expect(screen.getByText(/BY-۱۰۰۱/)).toBeInTheDocument();
    // «درخواست خرید» در برچسب وضعیت و در رویداد تاریخچه — هر دو
    expect(screen.getAllByText(/درخواست خرید/)).toHaveLength(2);
    expect(screen.getByText(/پودر کاکائو/)).toBeInTheDocument();
    expect(screen.getByText(/RM-001/)).toBeInTheDocument();
    // مبلغ کل و بدهی هر دو ۴۵۰٬۰۰۰ — چک ۵۰۰٬۰۰۰
    expect(screen.getAllByText(/۴۵۰٬۰۰۰/)).toHaveLength(2);
    expect(screen.getByText(/۵۰۰٬۰۰۰/)).toBeInTheDocument();
    // چک: سررسید، صیادی، وضعیت
    expect(screen.getByText(/۱۴۰۵\/۰۹\/۱۵/)).toBeInTheDocument();
    expect(screen.getByText("۱۲۳۴۵")).toBeInTheDocument();
    expect(screen.getByText("صادر شده")).toBeInTheDocument();
    // تاریخچه وضعیت — «علی» در هدر و در رویداد تاریخچه
    expect(screen.getAllByText(/علی/)).toHaveLength(2);
    expect(screen.getByText(new RegExp(AT_FA))).toBeInTheDocument();
    expect(screen.getByText("ثبت درخواست")).toBeInTheDocument();
  });

  it("وضعیت req — دکمه‌های ویرایش و تأیید درخواست، بدون دکمه رسید/مالی", async () => {
    renderDetail();
    await awaitLoaded();
    expect(screen.getByRole("button", { name: "ویرایش" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تأیید درخواست" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "تأیید مالی" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "رسید انبار" })).not.toBeInTheDocument();
  });

  it("تأیید درخواست — POST approve با rev خرید (optimistic concurrency)", async () => {
    renderDetail();
    await awaitLoaded();
    fireEvent.click(screen.getByRole("button", { name: "تأیید درخواست" }));
    await waitFor(() => expect(lastCall("POST", "/approve").json).toEqual({ rev: 3 }));
  });

  it("تأیید مالی — دیالوگ با چک صادره و ارسال payload صحیح", async () => {
    detail = buyBase("ok");
    renderDetail();
    await awaitLoaded();
    fireEvent.click(screen.getByRole("button", { name: "تأیید مالی" }));
    // عنوان دیالوگ با شناسه فارسی
    expect(await screen.findByRole("dialog", { name: /تأیید مالی خرید/ })).toBeInTheDocument();
    fireEvent.change(screen.getAllByLabelText("مبلغ چک به ریال")[0]!, { target: { value: "450000" } });
    fireEvent.change(screen.getAllByLabelText("سررسید به فرمت YYYY/MM/DD")[0]!, {
      target: { value: "1405/09/20" },
    });
    fireEvent.change(screen.getAllByLabelText("شماره صیادی")[0]!, { target: { value: "98765" } });
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
    await waitFor(() =>
      expect(lastCall("POST", "/finance").json).toEqual({
        rev: 3,
        cheques: [{ amount: 450000, due: "1405/09/20", sayad: "98765" }],
      }),
    );
  });

  it("رسید انبار — POST receive با rev (ورود مواد به انبار)", async () => {
    detail = buyBase("fin");
    renderDetail();
    await awaitLoaded();
    fireEvent.click(screen.getByRole("button", { name: "رسید انبار" }));
    await waitFor(() => expect(lastCall("POST", "/receive").json).toEqual({ rev: 3 }));
  });

  it("وضعیت recv — هیچ دکمه گذاری وجود ندارد", async () => {
    detail = buyBase("recv");
    renderDetail();
    await awaitLoaded();
    expect(screen.getByText("وارد انبار شد")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ویرایش" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "تأیید درخواست" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "تأیید مالی" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "رسید انبار" })).not.toBeInTheDocument();
  });

  it("پاس کردن چک — PATCH چک با status paid", async () => {
    detail = buyBase("fin");
    renderDetail();
    await awaitLoaded();
    fireEvent.click(screen.getByRole("button", { name: "پاس کردن چک" }));
    await waitFor(() => expect(lastCall("PATCH", "/cheques/chq-1").json).toEqual({ status: "paid" }));
  });

  it("چک پاس شده دکمه پاس کردن ندارد", async () => {
    detail = {
      ...buyBase("fin"),
      cheques: [{ id: "chq-1", amount: 500000, due: "1405/09/15", sayad: "12345", status: "paid" }],
    };
    renderDetail();
    await awaitLoaded();
    expect(screen.getByText("پاس شد")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "پاس کردن چک" })).not.toBeInTheDocument();
  });

  it("نقش بدون مجوز — دکمه‌های گذار پنهان می‌شوند (R-02: سرور منبع حقیقت)", async () => {
    detail = buyBase("ok");
    renderDetail(["purchasing.view", "finance.view", "money.view"]);
    await awaitLoaded();
    expect(screen.queryByRole("button", { name: "ویرایش" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "تأیید درخواست" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "تأیید مالی" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "پاس کردن چک" })).not.toBeInTheDocument();
  });

  it("نسخه noMoney — ساختار کامل بدون فیلدهای پولی (R-32)", async () => {
    detail = {
      id: ID,
      status: "fin",
      supplierId: "sup-1",
      supplierName: "تأمین‌کننده آریا",
      note: null,
      createdByName: "علی",
      createdAt: "1405/09/01",
      updatedAt: AT_MS,
      rev: 3,
      items: [{ id: "it-1", materialId: "mat-1", materialName: "پودر کاکائو", materialCode: "RM-001", unit: "kg", qty: 5 }],
      cheques: [{ id: "chq-1", due: "1405/09/15", sayad: "12345", status: "issued" }],
      statusLog: [{ id: "log-1", fromStatus: null, toStatus: "req", at: AT_MS, byName: "علی", note: "" }],
    } as BuyDetailNoMoney;
    renderDetail(["purchasing.view", "finance.view", "finance.edit", "inventory.moves"]);
    await awaitLoaded();
    // اقلام و چک‌ها نمایش داده می‌شوند — بدون مبلغ
    expect(screen.getByText(/پودر کاکائو/)).toBeInTheDocument();
    expect(screen.getByText(/۱۴۰۵\/۰۹\/۱۵/)).toBeInTheDocument();
    expect(screen.getByText("صادر شده")).toBeInTheDocument();
    expect(screen.queryByText(/ریال/)).not.toBeInTheDocument();
    expect(screen.queryByText(/۴۵۰٬۰۰۰/)).not.toBeInTheDocument();
    // رسید انبار مجاز است (مجوز غیرپولی)
    expect(screen.getByRole("button", { name: "رسید انبار" })).toBeInTheDocument();
  });

  it("خطای 409 در انتقال — پیام نمایش داده می‌شود و وضعیت تغییر نمی‌کند", async () => {
    detail = buyBase("fin");
    transitionError = "خرید توسط کاربر دیگری تغییر کرده است.";
    renderDetail();
    await awaitLoaded();
    fireEvent.click(screen.getByRole("button", { name: "رسید انبار" }));
    expect(await screen.findByText(/توسط کاربر دیگری تغییر کرده/)).toBeInTheDocument();
    expect(screen.queryByText("وارد انبار شد")).not.toBeInTheDocument();
  });

  it("حالت خطا — پیام سرور و دکمه تلاش مجدد (CD-09)", async () => {
    detailError = new ApiError(404, "NOT_FOUND", "خرید پیدا نشد.");
    renderDetail();
    expect(await screen.findByText(/خرید پیدا نشد/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /تلاش مجدد/ })).toBeInTheDocument();
  });
});
