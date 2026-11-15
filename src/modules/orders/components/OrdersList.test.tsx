/**
 * آزمون لیست سفارش‌ها — PHASE_04 §۱۲ (UI: حداقل یک تست به ازای لیست).
 *
 * apiFetch بر اساس URL مسیریابی می‌شود:
 *   /api/auth/me → نشست، /api/orders?... → لیست سفارش‌ها.
 *
 * پوشش: حالت بارگذاری/خطا/خالی، ستون‌های جدول، ستون‌های پولی فقط برای
 * نقش‌های دارای money.view (R-32)، فیلتر مرحله ۱۱گانه، مجوز دکتهای (CD-05)،
 * و صفحه‌بندی (CD-09).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@components/feedback";
import { ApiError } from "@core/errors";
import type { OrderListItem } from "../types/order.types";
import { OrdersList } from "./OrdersList";

vi.mock("@core/api", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@core/api");

const ME = (permissions: string[]) => ({
  user: {
    id: "u1",
    name: "ali",
    title: "کارشناس",
    roles: [{ roleKey: "sales" }],
    permissions,
    noMoney: permissions.includes("money.view") === false,
  },
});

const ORDER: OrderListItem = {
  id: "PF-1201",
  stage: 1,
  stageKey: "draft",
  status: "open",
  line: "prod",
  accountId: "acc-1",
  accountName: "شرکت نمونه",
  contactName: null,
  leadId: null,
  ownerId: "u1",
  ownerName: "علی",
  discPct: 0,
  calc: { sub: 2_000_000, disc: 0, extra: 0, net: 2_000_000, vat: 200_000, total: 2_200_000 },
  paid: 1_000_000,
  balance: 1_200_000,
  itemCount: 2,
  dueDate: "1405/09/20",
  stageAt: 1,
  createdAt: 1,
  updatedAt: 1,
};

const ORDER_NO_MONEY = {
  ...ORDER,
  calc: undefined,
  paid: undefined,
  balance: undefined,
  discPct: undefined,
} as unknown as OrderListItem;

const FULL_PERMS = [
  "orders.view",
  "orders.create",
  "orders.edit",
  "orders.status.change",
  "money.view",
];

function renderList(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <OrdersList />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

function mockList(items: OrderListItem[], total = items.length, me = ME(FULL_PERMS)) {
  vi.mocked(apiFetch).mockImplementation(async (url: string) => {
    if (url.includes("/api/auth/me")) return me;
    if (url.startsWith("/api/orders?")) return { items, total, page: 1, pageSize: 20 };
    throw new ApiError(500, "INTERNAL", "x");
  });
}

describe("حالت‌های کوئری (CD-09)", () => {
  it("بارگذاری → جدول با ستون‌ها و صفحه‌بندی", async () => {
    mockList([ORDER], 25);
    renderList();

    expect(screen.getByText("در حال بارگذاری سفارش‌ها…")).toBeInTheDocument();
    await screen.findByText("شرکت نمونه");

    expect(screen.getByText("PF-1201")).toBeInTheDocument();
    expect(screen.getAllByText(/ثبت پیش‌فاکتور/).length).toBeGreaterThan(0);
    expect(screen.getByText("علی")).toBeInTheDocument();
    expect(screen.getByText(/صفحه ۱ از ۲/)).toBeInTheDocument();
    expect(screen.getByText(/۲۵ سفارش/)).toBeInTheDocument();
  });

  it("لیست خالی → EmptyState", async () => {
    mockList([]);
    renderList();
    expect(await screen.findByText("سفارشی وجود ندارد")).toBeInTheDocument();
    expect(screen.getByText(/پیش‌فاکتوری ثبت نشده/)).toBeInTheDocument();
  });

  it("لیست خالی با فیلتر → راهنمای فیلتر", async () => {
    mockList([]);
    renderList();
    await screen.findByText("سفارشی وجود ندارد");
    fireEvent.change(screen.getByLabelText("جستجو"), { target: { value: "xyz" } });
    const btn = await screen.findByRole("button", { name: "جستجو" });
    fireEvent.click(btn);
    await screen.findByText("سفارشی وجود ندارد");
    expect(screen.getByText(/نتیجه‌ای برای فیلترهای شما/)).toBeInTheDocument();
  });

  it("خطای سرور → ErrorState", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url: string) => {
      if (url.includes("/api/auth/me")) return ME(FULL_PERMS);
      throw new ApiError(500, "INTERNAL", "خطای دیتابیس.");
    });
    renderList();
    expect(await screen.findByText("بارگذاری ناموفق")).toBeInTheDocument();
    expect(screen.getByText("خطای دیتابیس.")).toBeInTheDocument();
  });
});

describe("ستون‌های پولی (R-32)", () => {
  it("نقش با money.view → ستون‌های مبلغ نهایی و مانده", async () => {
    mockList([ORDER]);
    renderList();
    await screen.findByText("شرکت نمونه");
    expect(screen.getByText("مبلغ نهایی")).toBeInTheDocument();
    expect(screen.getByText("مانده")).toBeInTheDocument();
    expect(screen.getByText(/۲٬۲۰۰٬۰۰۰/)).toBeInTheDocument();
    expect(screen.getByText(/۱٬۲۰۰٬۰۰۰/)).toBeInTheDocument();
  });

  it("نقش بدون money.view → بدون ستون‌های پولی", async () => {
    mockList([ORDER_NO_MONEY], 1, ME(["orders.view"]));
    renderList();
    await screen.findByText("شرکت نمونه");
    expect(screen.queryByText("مبلغ نهایی")).not.toBeInTheDocument();
    expect(screen.queryByText("مانده")).not.toBeInTheDocument();
    // ستون‌های غیرپولی همچنان موجودند
    expect(screen.getByText("اقلام")).toBeInTheDocument();
    expect(screen.getByText("سررسید")).toBeInTheDocument();
  });
});

describe("فیلتر مرحله (۱۱ مرحله) و وضعیت", () => {
  it("انتخاب مرحله → پارامتر stage در کوئری", async () => {
    mockList([ORDER]);
    renderList();
    await screen.findByText("شرکت نمونه");
    const select = screen.getByLabelText("مرحله");
    fireEvent.change(select, { target: { value: "6" } });
    await waitFor(() => {
      const url = vi.mocked(apiFetch).mock.calls
        .map((c) => String(c[0]))
        .find((u) => u.includes("stage=6"));
      expect(url).toBeDefined();
    });
  });

  it("انتخاب وضعیت → پارامتر status در کوئری", async () => {
    mockList([ORDER]);
    renderList();
    await screen.findByText("شرکت نمونه");
    fireEvent.change(screen.getByLabelText("وضعیت"), { target: { value: "done" } });
    await waitFor(() => {
      const url = vi.mocked(apiFetch).mock.calls
        .map((c) => String(c[0]))
        .find((u) => u.includes("status=done"));
      expect(url).toBeDefined();
    });
  });

  it("برچسب مرحله فارسی نمایش داده می‌شود", async () => {
    mockList([{ ...ORDER, stage: 6, stageKey: "paccept" }]);
    renderList();
    await screen.findByText(/قبول و زمان‌بندی تولید/);
  });
});

describe("مجوزها در UI (CD-05)", () => {
  it("بدون orders.create → دکمه «پیش‌فاکتور جدید» پنهان است", async () => {
    mockList([ORDER], 1, ME(["orders.view", "money.view"]));
    renderList();
    await screen.findByText("شرکت نمونه");
    expect(screen.queryByRole("button", { name: /پیش‌فاکتور جدید/ })).not.toBeInTheDocument();
  });

  it("با orders.create → دکمه «پیش‌فاکتور جدید» دیده می‌شود", async () => {
    mockList([ORDER]);
    renderList();
    await screen.findByText("شرکت نمونه");
    expect(screen.getByRole("button", { name: /پیش‌فاکتور جدید/ })).toBeInTheDocument();
  });
});

describe("صفحه‌بندی (CD-09)", () => {
  it("دکمه «صفحه بعد» صفحه را افزایش می‌دهد", async () => {
    mockList([ORDER], 40);
    renderList();
    await screen.findByText("شرکت نمونه");
    fireEvent.click(screen.getByRole("button", { name: "صفحه بعد" }));
    await waitFor(() => {
      const url = vi.mocked(apiFetch).mock.calls
        .map((c) => String(c[0]))
        .find((u) => u.includes("page=2"));
      expect(url).toBeDefined();
    });
  });

  it("در صفحه آخر «صفحه بعد» غیرفعال است", async () => {
    mockList([ORDER], 1);
    renderList();
    await screen.findByText("شرکت نمونه");
    expect(screen.getByRole("button", { name: "صفحه بعد" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "صفحه قبل" })).toBeDisabled();
  });
});
