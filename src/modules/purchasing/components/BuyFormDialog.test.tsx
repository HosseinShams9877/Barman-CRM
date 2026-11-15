/**
 * آزمون فرم ثبت درخواست خرید — PHASE_06 §۶ (UI: حداقل یک تست به ازای فرم).
 *
 * apiFetch بر اساس URL مسیردهی می‌شود:
 *   GET  /api/suppliers، GET /api/catalog/materials
 *   POST /api/buys      (useCreateBuyMutation)
 *   PATCH /api/buys/[id] (useUpdateBuyMutation)
 *
 * پوشش:
 *  - منوی کشویی تأمین‌کننده و ماده خام از API پر می‌شوند؛
 *  - افزودن قلم و ارسال payload صحیح (materialId، qty، price، supplierId)؛
 *  - فیلد قیمت برای نقش noMoney پنهان می‌شود (R-32)؛
 *  - ویرایش خرید موجود در وضعیت req با rev؛
 *  - خطای سرور زیر فرم نشان داده می‌شود و دیالوگ باز می‌ماند.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ToastProvider } from "@components/feedback";
import { ApiError } from "@core/errors";
import type { BuyDetail, BuyDetailNoMoney } from "../types/buy.types";
import { BuyFormDialog } from "./BuyFormDialog";

vi.mock("@modules/auth/hooks/useAuth", () => ({
  useMeQuery: vi.fn(),
}));

vi.mock("@core/api", () => ({
  apiFetch: vi.fn(),
}));

const { useMeQuery } = await import("@modules/auth/hooks/useAuth");
const { apiFetch } = await import("@core/api");

const mockedUseMeQuery = vi.mocked(useMeQuery);

const SUPPLIERS = [
  { id: "sup-1", name: "تأمین‌کننده آریا", phone: null, note: null },
  { id: "sup-2", name: "پخش نگین", phone: null, note: null },
];
const MATERIALS = {
  items: [
    { id: "mat-1", name: "پودر کاکائو", code: "RAW-001", unit: "kg", stockQty: 10 },
    { id: "mat-2", name: "شیر خشک", code: "RAW-002", unit: "kg", stockQty: 5 },
  ],
};

let failCreate = false;
let failUpdate = false;

function setUser(permissions: string[]): void {
  mockedUseMeQuery.mockReturnValue({
    data: { id: "u1", name: "ali", title: "کارشناس", roles: ["purchasing"], permissions, noMoney: false },
    isLoading: false,
  } as never);
}

function mockApi(): void {
  vi.mocked(apiFetch).mockImplementation(
    async (url: string, init?: { method?: string; json?: unknown }) => {
      if (url === "/api/suppliers") return SUPPLIERS;
      if (url === "/api/catalog/materials") return MATERIALS;
      if (url === "/api/buys" && init?.method === "POST") {
        if (failCreate) throw new ApiError(400, "BAD_REQUEST", "حداقل یک قلم لازم است.");
        return {
          id: "BY-1001",
          status: "req",
          supplierId: "sup-1",
          supplierName: "تأمین‌کننده آریا",
          note: null,
          rev: 1,
          items: [],
          cheques: [],
          statusLog: [],
          createdAt: "1405/09/01",
        };
      }
      if (url.startsWith("/api/buys/") && init?.method === "PATCH") {
        if (failUpdate) throw new ApiError(409, "CONFLICT", "خرید توسط کاربر دیگری تغییر کرده است.");
        return {
          id: "BY-1001",
          status: "req",
          supplierId: "sup-1",
          supplierName: "تأمین‌کننده آریا",
          note: null,
          rev: 2,
          items: [],
          cheques: [],
          statusLog: [],
          createdAt: "1405/09/01",
        };
      }
      throw new ApiError(500, "INTERNAL", `unexpected ${url}`);
    },
  );
}

function renderDialog(
  permissions: string[] = ["purchasing.edit", "money.view"],
  onClose: Mock = vi.fn(),
  buy: BuyDetail | BuyDetailNoMoney | null = null,
): Mock {
  setUser(permissions);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <BuyFormDialog open onClose={onClose} buy={buy} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return onClose;
}

/** پر کردن قلم اول: ماده، مقدار و قیمت. */
function fillFirstItem(): void {
  const selects = screen.getAllByLabelText("ماده خام");
  fireEvent.change(selects[0]!, { target: { value: "mat-1" } });
  const qty = screen.getAllByLabelText("مقدار");
  fireEvent.change(qty[0]!, { target: { value: "5" } });
  const price = screen.getAllByLabelText("قیمت واحد به ریال");
  fireEvent.change(price[0]!, { target: { value: "90000" } });
}

/** ارسال فرم — دکمه submit بیرون از form در نوار ابزار است. */
function submitForm(): void {
  fireEvent.submit(document.querySelector("form") as HTMLFormElement);
}

/** آخرین فراخوانی POST /api/buys. */
function lastPost(): { url: string; json?: unknown } {
  const calls = vi.mocked(apiFetch).mock.calls as Array<[string, { method?: string; json?: unknown }]>;
  const post = calls.filter(([u, init]) => u === "/api/buys" && init?.method === "POST").at(-1);
  expect(post, "POST /api/buys فراخوانی نشد").toBeDefined();
  return { url: post![0], json: post![1].json };
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  mockedUseMeQuery.mockReset();
  failCreate = false;
  failUpdate = false;
  mockApi();
});

describe("BuyFormDialog", () => {
  it("منوی تأمین‌کننده و مواد از API پر می‌شوند", async () => {
    renderDialog();
    expect(await screen.findByText("تأمین‌کننده آریا")).toBeInTheDocument();
    expect(screen.getByText("پخش نگین")).toBeInTheDocument();
    // عنوان دیالوگ ثبت جدید
    expect(screen.getByRole("dialog", { name: "درخواست خرید جدید" })).toBeInTheDocument();
  });

  it("ثبت درخواست خرید با payload صحیح ( اقلام، supplierId)", async () => {
    const onClose = renderDialog();
    await screen.findByText("تأمین‌کننده آریا");
    fireEvent.change(screen.getByLabelText("تأمین‌کننده"), { target: { value: "sup-1" } });
    fillFirstItem();
    fireEvent.change(screen.getByLabelText("یادداشت"), { target: { value: "خرید هفته" } });
    submitForm();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(lastPost().json).toMatchObject({
      supplierId: "sup-1",
      items: [{ materialId: "mat-1", qty: 5, price: 90000 }],
      note: "خرید هفته",
    });
  });

  it("افزودن قلم دوم و حذف قلم", async () => {
    renderDialog();
    await screen.findByText("تأمین‌کننده آریا");
    expect(screen.getAllByLabelText("ماده خام")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "افزودن قلم" }));
    expect(screen.getAllByLabelText("ماده خام")).toHaveLength(2);
    // حذف قلم اول
    fireEvent.click(screen.getAllByRole("button", { name: "حذف قلم" })[0]!);
    expect(screen.getAllByLabelText("ماده خام")).toHaveLength(1);
  });

  it("قلم بدون ماده در payload ارسال نمی‌شود", async () => {
    const onClose = renderDialog();
    await screen.findByText("تأمین‌کننده آریا");
    fillFirstItem();
    fireEvent.click(screen.getByRole("button", { name: "افزودن قلم" }));
    submitForm();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(lastPost().json).toMatchObject({ items: [{ materialId: "mat-1", qty: 5, price: 90000 }] });
  });

  it("فیلد قیمت برای نقش noMoney پنهان می‌شود اما مقدار قابل ورود است (R-32)", async () => {
    renderDialog(["purchasing.edit"]);
    await screen.findByText("تأمین‌کننده آریا");
    expect(screen.queryAllByLabelText("قیمت واحد به ریال")).toHaveLength(0);
    expect(screen.getAllByLabelText("مقدار")).toHaveLength(1);
    // مبلغ کل هم نمایش داده نمی‌شود
    expect(screen.queryByText(/مبلغ کل/)).not.toBeInTheDocument();
  });

  it("ویرایش خرید موجود — PATCH با rev و آیتم implants", async () => {
    const buy = {
      id: "BY-1001",
      status: "req" as const,
      supplierId: "sup-1",
      supplierName: "تأمین‌کننده آریا",
      note: "یادداشت قدیمی",
      rev: 3,
      items: [
        {
          id: "it-1",
          materialId: "mat-1",
          materialName: "پودر کاکائو",
          qty: 2,
          price: 90000,
        },
      ],
      cheques: [],
      statusLog: [],
      createdAt: "1405/09/01",
    } as never;
    const onClose = renderDialog(["purchasing.edit", "money.view"], vi.fn(), buy);
    await screen.findByText("تأمین‌کننده آریا");
    expect(screen.getByRole("dialog", { name: /ویرایش خرید/ })).toBeInTheDocument();
    submitForm();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const calls = vi.mocked(apiFetch).mock.calls as Array<[string, { method?: string; json?: unknown }]>;
    const patch = calls.filter(([u, init]) => u === "/api/buys/BY-1001" && init?.method === "PATCH").at(-1);
    expect(patch, "PATCH /api/buys/BY-1001 فراخوانی نشد").toBeDefined();
    expect(patch![1].json).toMatchObject({
      rev: 3,
      items: [{ materialId: "mat-1", qty: 2, price: 90000 }],
    });
  });

  it("خطای سرور زیر فرم نشان داده می‌شود و دیالوگ باز می‌ماند", async () => {
    failCreate = true;
    const onClose = renderDialog();
    await screen.findByText("تأمین‌کننده آریا");
    fillFirstItem();
    submitForm();
    expect(await screen.findByText(/حداقل یک قلم لازم است/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("خطای تداخل rev (409) نمایش داده می‌شود — optimistic concurrency", async () => {
    failUpdate = true;
    const buy = {
      id: "BY-1001",
      status: "req" as const,
      supplierId: "sup-1",
      supplierName: "تأمین‌کننده آریا",
      note: null,
      rev: 5,
      items: [],
      cheques: [],
      statusLog: [],
      createdAt: "1405/09/01",
    } as never;
    const onClose = renderDialog(["purchasing.edit", "money.view"], vi.fn(), buy);
    await screen.findByText("تأمین‌کننده آریا");
    fireEvent.click(screen.getByRole("button", { name: "افزودن قلم" }));
    fillFirstItem();
    submitForm();
    expect(await screen.findByText(/توسط کاربر دیگری تغییر کرده/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
