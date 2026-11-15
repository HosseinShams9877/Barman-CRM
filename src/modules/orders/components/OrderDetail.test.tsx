/**
 * آزمون جزئیات سفارش — PHASE_04 §۱۲ (UI: حداقل یک تست به ازای صفحه جزئیات).
 *
 * apiFetch بر اساس URL مسیریابی می‌شود:
 *   /api/auth/me → نشست، /api/orders/PF-1201 → جزئیات،
 *   /api/orders/PF-1201/cancel (POST) → لغو،
 *   /api/orders/PF-1201/print-token (POST) → توکن چاپ (R-01).
 *
 * پوشش: بارگذاری بخش‌ها (خط لوله، خلاصه، جدول اقلام، تاریخچه، سند تحویل)،
 * نسخه noMoney (R-32)، جدول محاسبه مبالغ (CD-29)، لغو با دلیل (order.js:59)،
 * چاپ امن، و پنهان‌سازی دکمه ویرایش بدون مجوز (CD-05).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@components/feedback";
import { ApiError } from "@core/errors";
import type { OrderDetail as OrderDetailDTO, OrderDetailNoMoney } from "../types/order.types";
import { OrderDetail } from "./OrderDetail";

const { routerMocks } = vi.hoisted(() => ({
  routerMocks: { push: vi.fn(), refresh: vi.fn(), back: vi.fn() },
}));

vi.mock("@core/api", () => ({
  apiFetch: vi.fn(),
}));

// روتر اشیای پایدار برمی‌گرداند تا push در تست قابل ابطال باشد
vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

const { apiFetch } = await import("@core/api");

const ME = (permissions: string[]) => ({
  user: {
    id: "u1",
    name: "علی",
    title: "کارشناس",
    roles: [{ roleKey: "sales" }],
    permissions,
    noMoney: permissions.includes("money.view") === false,
  },
});

const FULL_PERMS = [
  "orders.view",
  "orders.edit",
  "orders.status.change",
  "money.view",
];

const ORDER: OrderDetailDTO = {
  id: "PF-1201",
  stage: 2,
  stageKey: "smgr",
  status: "open",
  line: "prod",
  accountId: "acc-1",
  accountName: "شرکت نمونه",
  contactName: null,
  leadId: null,
  ownerId: "u1",
  ownerName: "علی",
  discPct: 10,
  calc: { sub: 2_000_000, disc: 200_000, extra: 0, net: 1_800_000, vat: 180_000, total: 1_980_000 },
  paid: 500_000,
  balance: 1_480_000,
  itemCount: 1,
  dueDate: "1405/09/20",
  stageAt: 1_758_000_000_000,
  createdAt: 1_758_000_000_000,
  updatedAt: 1_758_000_000_000,
  note: "یادداشت اولیه",
  validDays: 3,
  noVat: false,
  ship: 0,
  install: 0,
  discAmt: 0,
  preset: "half",
  skipped: [],
  backNote: { by: "مدیر فروش", t: 1_758_000_000_000, text: "قیمت‌ها بررسی شود." },
  smOk: null,
  mgrOk: null,
  times: { draft: 1_758_000_000_000 },
  sent: null,
  prod: null,
  prep: null,
  delivered: null,
  agreed: null,
  cancelReason: null,
  items: [
    {
      id: "i1",
      productId: "P1",
      productName: "محصول ۱",
      productCode: "P1",
      unit: "عدد",
      qty: 2,
      price: 1_000_000,
      discount: 0,
      color: "سفید",
    },
  ],
  payments: [],
  cheques: [],
  stageLog: [
    {
      id: "l1",
      fromStage: 1,
      toStage: 2,
      at: 1_758_000_000_000,
      byName: "علی",
      note: "ارسال برای تأیید",
      kind: "stage",
    },
  ],
  handoffs: [
    {
      id: "TR-101",
      lines: [{ productId: "P1", qty: 2, color: "سفید" }],
      at: 1_758_000_000_000,
      byName: "انبار",
      note: "تحویل بخش تولید",
    },
  ],
  stageWho: "salesManager",
  stageDue: 1_758_000_000_000,
};

/** نسخه noMoney — بدون calc و بدون قیمت اقلام (R-32). */
const ORDER_NO_MONEY: OrderDetailNoMoney = {
  ...ORDER,
  items: [{ id: "i1", productId: "P1", productName: "محصول ۱", productCode: "P1", unit: "عدد", qty: 2, color: "سفید" }],
} as unknown as OrderDetailNoMoney;
delete (ORDER_NO_MONEY as Partial<OrderDetailDTO>).calc;
delete (ORDER_NO_MONEY as Partial<OrderDetailDTO>).paid;
delete (ORDER_NO_MONEY as Partial<OrderDetailDTO>).balance;
delete (ORDER_NO_MONEY as Partial<OrderDetailDTO>).discPct;

let printToken: string | null;

function mockApi(
  order: OrderDetailDTO | OrderDetailNoMoney,
  me = ME(FULL_PERMS),
): void {
  vi.mocked(apiFetch).mockImplementation(async (url: string, init?: { method?: string; json?: unknown }) => {
    if (url.includes("/api/auth/me")) return me;
    // OrderFormDialog (ویرایش) و StageActions هم لیست حساب‌ها را می‌خوانند
    if (url.startsWith("/api/customers?")) return { items: [], total: 0, page: 1, pageSize: 200 };
    if (url === "/api/orders/PF-1201" && init?.method === undefined) return order;
    if (url === "/api/orders/PF-1201/cancel" && init?.method === "POST") {
      return { ...order, status: "cancelled", cancelReason: "خرید لغو شد" };
    }
    if (url === "/api/orders/PF-1201/print-token" && init?.method === "POST") {
      return { token: printToken ?? "tok-123" };
    }
    throw new ApiError(500, "INTERNAL", "x");
  });
}

function renderDetail(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <OrderDetail id="PF-1201" />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  routerMocks.push.mockReset();
  printToken = null;
  mockApi(ORDER);
});

describe("بارگذاری بخش‌ها", () => {
  it("عنوان، چیپ مرحله، خط لوله و خلاصه نمایش داده می‌شوند", async () => {
    renderDetail();
    expect(await screen.findByText("پیش‌فاکتور PF-۱۲۰۱")).toBeInTheDocument();
    // چیپ مرحله ۲ — بررسی مدیر فروش (خط لوله هم برچسب مرحله را نشان می‌دهد)
    expect(screen.getByText(/مرحله ۲ — بررسی مدیر فروش/)).toBeInTheDocument();
    // خلاصه سفارش — سررسید و اعتبار
    expect(screen.getByText("سررسید نهایی")).toBeInTheDocument();
    expect(screen.getByText("۳ روز")).toBeInTheDocument();
    expect(screen.getByText("یادداشت اولیه")).toBeInTheDocument();
    // اطلاعات حساب و مسؤول
    expect(screen.getByText(/شرکت نمونه/)).toBeInTheDocument();
    expect(screen.getByText(/مسؤول: علی/)).toBeInTheDocument();
  });

  it("جدول اقلام و سند تحویل (TR-) نمایش داده می‌شوند", async () => {
    renderDetail();
    expect(await screen.findByText("محصول ۱")).toBeInTheDocument();
    expect(screen.getByText("سفید")).toBeInTheDocument();
    // تعداد با ارقام فارسی
    expect(screen.getByText("۲ عدد")).toBeInTheDocument();
    // سند تحویل
    expect(screen.getByText("سندهای تحویل (TR-)")).toBeInTheDocument();
    expect(screen.getByText("تحویل بخش تولید")).toBeInTheDocument();
  });

  it("تاریخچه مرحله با برچسب انتقال نمایش داده می‌شود", async () => {
    renderDetail();
    expect(await screen.findByText("تاریخچه مرحله")).toBeInTheDocument();
    expect(screen.getByText("ثبت پیش‌فاکتور ← بررسی مدیر فروش")).toBeInTheDocument();
    expect(screen.getByText("ارسال برای تأیید")).toBeInTheDocument();
  });

  it("یادداشت بازگشت نمایش داده می‌شود", async () => {
    renderDetail();
    // عنوان کارت (StageActions هم فیلدی هم‌نام دارد → نقش heading)
    expect(await screen.findByRole("heading", { name: /یادداشت بازگشت/ })).toBeInTheDocument();
    expect(screen.getByText("قیمت‌ها بررسی شود.")).toBeInTheDocument();
  });

  it("خطای بارگذاری → ErrorState", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url: string) => {
      if (url.includes("/api/auth/me")) return ME(FULL_PERMS);
      throw new ApiError(500, "INTERNAL", "خطای سرور.");
    });
    renderDetail();
    expect(await screen.findByText("بارگذاری سفارش ناموفق بود")).toBeInTheDocument();
    expect(screen.getByText("خطای سرور.")).toBeInTheDocument();
  });

  it("سفارش ناموجود → EmptyState", async () => {
    // پاسخ خالی (نه خطا) → query.data === null → حالت خالی
    vi.mocked(apiFetch).mockImplementation(async (url: string) => {
      if (url.includes("/api/auth/me")) return ME(FULL_PERMS);
      if (url.startsWith("/api/customers?")) return { items: [], total: 0, page: 1, pageSize: 200 };
      if (url === "/api/orders/PF-1201") return null;
      throw new ApiError(500, "INTERNAL", "x");
    });
    renderDetail();
    expect(await screen.findByText("سفارش پیدا نشد")).toBeInTheDocument();
  });
});

describe("بلوک پولی (R-32 / CD-29)", () => {
  it("نقش با money.view → جدول محاسبه مبالغ", async () => {
    renderDetail();
    expect(await screen.findByText("محاسبه مبالغ")).toBeInTheDocument();
    expect(screen.getByText("جمع اقلام")).toBeInTheDocument();
    expect(screen.getByText("مبلغ نهایی")).toBeInTheDocument();
    // مبلغ نهایی هم در جدول محاسبه و هم در برنامه پرداخت دیده می‌شود
    expect(screen.getAllByText(/۱٬۹۸۰٬۰۰۰/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/۱٬۸۰۰٬۰۰۰/).length).toBeGreaterThan(0);
    // ستون‌های قیمت در جدول اقلام
    expect(screen.getByText("قیمت واحد")).toBeInTheDocument();
    // یادداشت CD-29 (ذخیره نشدن مبالغ)
    expect(screen.getByText(/CD-29/)).toBeInTheDocument();
  });

  it("نقش بدون money.view → پیام R-32 و بدون مبالغ", async () => {
    mockApi(ORDER_NO_MONEY, ME(["orders.view"]));
    renderDetail();
    expect(await screen.findByText("محصول ۱")).toBeInTheDocument();
    expect(screen.getByText(/مجوز مشاهده مبالغ/)).toBeInTheDocument();
    expect(screen.queryByText("محاسبه مبالغ")).not.toBeInTheDocument();
    expect(screen.queryByText("قیمت واحد")).not.toBeInTheDocument();
    expect(screen.queryByText("مبلغ نهایی")).not.toBeInTheDocument();
  });
});

describe("لغو سفارش (order.js:59)", () => {
  it("دلیل خالی → خطای فارسی و عدم ارسال", async () => {
    renderDetail();
    expect(await screen.findByRole("heading", { name: /لغو سفارش/ })).toBeInTheDocument();
    // h2 و دکمه هم‌نام‌اند → دکمه با نقش دقیق
    fireEvent.click(screen.getByRole("button", { name: /^لغو سفارش$/ }));
    expect(await screen.findByText(/حداقل ۱ نویسه/)).toBeInTheDocument();
    const cancels = vi.mocked(apiFetch).mock.calls.filter(
      ([u, init]) => u === "/api/orders/PF-1201/cancel" && init?.method === "POST",
    );
    expect(cancels).toHaveLength(0);
  });

  it("دلیل معتبر → POST /api/orders/PF-1201/cancel", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: /لغو سفارش/ });
    fireEvent.change(screen.getByLabelText("دلیل لغو"), { target: { value: "خرید لغو شد" } });
    fireEvent.click(screen.getByRole("button", { name: /^لغو سفارش$/ }));
    await waitFor(() => {
      const cancelCall = vi.mocked(apiFetch).mock.calls.find(
        ([u, init]) => u === "/api/orders/PF-1201/cancel" && init?.method === "POST",
      );
      expect(cancelCall).toBeDefined();
    });
  });

  it("بدون orders.status.change → فرم لغو پنهان است", async () => {
    mockApi(ORDER, ME(["orders.view", "orders.edit", "money.view"]));
    renderDetail();
    await screen.findByText("محصول ۱");
    expect(screen.queryByText("دلیل لغو")).not.toBeInTheDocument();
  });

  it("سفارش در مرحله تولید (۶) → فرم لغو پنهان است", async () => {
    mockApi({ ...ORDER, stage: 6, stageKey: "paccept" }, ME(FULL_PERMS));
    renderDetail();
    await screen.findByText("محصول ۱");
    expect(screen.queryByText("دلیل لغو")).not.toBeInTheDocument();
  });
});

describe("چاپ امن (R-01) و ویرایش", () => {
  it("دکمه چاپ → POST print-token و هدایت به مسیر توکن‌دار", async () => {
    const push = vi.mocked(routerMocks.push);
    printToken = "tok-print-7";
    renderDetail();
    await screen.findByText("محصول ۱");
    fireEvent.click(screen.getByRole("button", { name: "چاپ پیش‌فاکتور" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/print/orders/PF-1201?t=tok-print-7");
    });
    const tokenCall = vi.mocked(apiFetch).mock.calls.find(
      ([u, init]) => u === "/api/orders/PF-1201/print-token" && init?.method === "POST",
    );
    expect(tokenCall).toBeDefined();
  });

  it("با orders.edit (مرحله ≤ ۵) → دکمه ویرایش موجود است", async () => {
    renderDetail();
    expect(await screen.findByRole("button", { name: "ویرایش" })).toBeInTheDocument();
  });

  it("بدون orders.edit → دکمه ویرایش پنهان است (CD-05)", async () => {
    mockApi(ORDER, ME(["orders.view", "orders.status.change", "money.view"]));
    renderDetail();
    await screen.findByText("محصول ۱");
    expect(screen.queryByRole("button", { name: "ویرایش" })).not.toBeInTheDocument();
  });
});
