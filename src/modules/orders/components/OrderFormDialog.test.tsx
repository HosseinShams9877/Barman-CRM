/**
 * آزمون فرم ایجاد/ویرایش پیش‌فاکتور — PHASE_04 §۱۲ (UI: حداقل یک تست به ازای فرم).
 *
 * apiFetch بر اساس URL مسیریابی می‌شود:
 *   /api/customers?... → لیست حساب‌ها، /api/orders (POST) → ایجاد،
 *   /api/orders/PF-... (PATCH) → ویرایش.
 *
 * پوشش: ارسال payload صحیح (اقلام عددی، تخفیف، اعتبار)، اعتبارسنجی
 * فارسی Zod روی فیلدها (CD-28)، افزودن/حذف قلم، leadId در payload،
 * ویرایش با مقادیر موجود + id قلم، و نمایش خطای سروور.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ToastProvider } from "@components/feedback";
import { ApiError } from "@core/errors";
import type { OrderDetail } from "../types/order.types";
import { OrderFormDialog } from "./OrderFormDialog";

vi.mock("@core/api", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@core/api");

const ACC = { id: "acc-1", name: "شرکت نمونه", kind: "customer", active: true, phones: [], ownerName: null, balance: 0, createdAt: 1, updatedAt: 1 };

const ORDER: OrderDetail = {
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
  paid: 0,
  balance: 2_200_000,
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
  preset: "",
  skipped: [],
  backNote: null,
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
  stageLog: [],
  handoffs: [],
  stageWho: "sales",
  stageDue: 1_758_000_000_000,
};

/** POST/PATCH ناموفق برای آزمون نمایش خطای سروور. */
let failMutation = false;

function mockApi(): void {
  vi.mocked(apiFetch).mockImplementation(async (url: string, init?: { method?: string; json?: unknown }) => {
    if (url.startsWith("/api/customers?")) {
      return { items: [ACC], total: 1, page: 1, pageSize: 200 };
    }
    if (url === "/api/orders" && init?.method === "POST") {
      if (failMutation) throw new ApiError(400, "BAD_REQUEST", "مبلغ تخفیف از سقف مجاز بیشتر است.");
      return ORDER;
    }
    if (url.startsWith("/api/orders/") && init?.method === "PATCH") {
      if (failMutation) throw new ApiError(400, "BAD_REQUEST", "مبلغ تخفیف از سقف مجاز بیشتر است.");
      return ORDER;
    }
    throw new ApiError(500, "INTERNAL", "x");
  });
}

function renderDialog(
  props: { order?: OrderDetail | null; leadId?: string | null; accountId?: string | null },
  onClose: Mock = vi.fn(),
): ReturnType<typeof vi.fn> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <OrderFormDialog
          open
          onClose={onClose}
          order={props.order ?? null}
          leadId={props.leadId ?? null}
          accountId={props.accountId ?? null}
        />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return onClose;
}

/** پر کردن قلم اول با مقادیر معتبر. */
function fillItem(): void {
  fireEvent.change(screen.getByLabelText("شناسه محصول"), { target: { value: "P1" } });
  fireEvent.change(screen.getByLabelText("تعداد"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("قیمت (ریال)"), { target: { value: "1000000" } });
}

/** ارسال فرم (دکمه submit با form= خارج از عنصر form است). */
function submitForm(): void {
  fireEvent.submit(document.getElementById("order-form") as HTMLFormElement);
}

/** آخرین فراخوانی mutation را برمی‌گرداند. */
function lastCall(): { url: string; init: { method?: string; json?: unknown } } {
  const calls = vi.mocked(apiFetch).mock.calls as Array<[string, { method?: string; json?: unknown }]>;
  const mutation = calls.find(([u, init]) => (u === "/api/orders" || u.startsWith("/api/orders/")) && init?.method !== undefined);
  expect(mutation, "هیچ فراخوانی mutationای ثبت نشد").toBeDefined();
  return { url: mutation![0], init: mutation![1] };
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  failMutation = false;
  mockApi();
});

describe("ایجاد پیش‌فاکتور", () => {
  it("فرم پرشده → POST /api/orders با payload صحیح", async () => {
    const onClose = renderDialog({});
    expect(screen.getByText("پیش‌فاکتور جدید")).toBeInTheDocument();

    fillItem();
    await screen.findByText("شرکت نمونه");
    fireEvent.change(screen.getByLabelText("مشتری (حساب)"), { target: { value: "acc-1" } });
    submitForm();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const { url, init } = lastCall();
    expect(url).toBe("/api/orders");
    expect(init.method).toBe("POST");
    expect(init.json).toMatchObject({
      accountId: "acc-1",
      line: "prod",
      items: [{ productId: "P1", qty: 2, price: 1_000_000, discount: 0, color: "" }],
      discPct: 0,
      discAmt: 0,
      ship: 0,
      install: 0,
      validDays: 3,
      noVat: false,
      note: "",
      preset: "",
    });
  });

  it("حساب‌ها در منوی کشویی بارگذاری می‌شوند", async () => {
    renderDialog({});
    expect(await screen.findByText("شرکت نمونه")).toBeInTheDocument();
  });

  it("قلم بدون قیمت → خطای فارسی و عدم ارسال به سرور", async () => {
    renderDialog({});
    await screen.findByText("شرکت نمونه");
    fireEvent.change(screen.getByLabelText("شناسه محصول"), { target: { value: "P1" } });
    fireEvent.change(screen.getByLabelText("تعداد"), { target: { value: "2" } });
    // قیمت خالی باقی می‌ماند
    submitForm();

    expect(await screen.findByText(/نامعتبر/)).toBeInTheDocument();
    const posts = vi.mocked(apiFetch).mock.calls.filter(
      ([u, init]) => u === "/api/orders" && init?.method === "POST",
    );
    expect(posts).toHaveLength(0);
  });

  it("تخفیف کل بیش از ۱۰۰ → پیام خطای فارسی (CD-28)", async () => {
    renderDialog({});
    await screen.findByText("شرکت نمونه");
    fillItem();
    fireEvent.change(screen.getByLabelText("تخفیف کل (٪)"), { target: { value: "101" } });
    submitForm();

    expect(await screen.findByText(/باید کوچک‌تر یا مساوی ۱۰۰ باشد/)).toBeInTheDocument();
  });

  it("اعتبار پیش‌فاکتور کمتر از ۱ → خطای فارسی", async () => {
    renderDialog({});
    await screen.findByText("شرکت نمونه");
    fillItem();
    fireEvent.change(screen.getByLabelText("اعتبار پیش‌فاکتور (روز)"), { target: { value: "0" } });
    submitForm();

    expect(await screen.findByText(/باید بزرگ‌تر از ۰ باشد/)).toBeInTheDocument();
  });

  it("افزودن قلم جدید و حذف آن — ردیف آخر قابل حذف نیست", async () => {
    renderDialog({});
    await screen.findByText("شرکت نمونه");

    fireEvent.click(screen.getByRole("button", { name: /افزودن قلم/ }));
    expect(screen.getAllByLabelText("تعداد")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "حذف قلم ۲" }));
    expect(screen.getAllByLabelText("تعداد")).toHaveLength(1);

    // تنها قلم باقی‌مانده — دکمه حذف غیرفعال است
    expect(screen.getByRole("button", { name: "حذف قلم ۱" })).toBeDisabled();
  });

  it("leadId در payload ایجاد قرار می‌گیرد (تبدیل سرنخ)", async () => {
    renderDialog({ leadId: "LD-7" });
    await screen.findByText("شرکت نمونه");
    fillItem();
    submitForm();

    await waitFor(() => expect(lastCall().init.method).toBe("POST"));
    expect(lastCall().init.json).toMatchObject({ leadId: "LD-7" });
  });

  it("خطای سروور زیر فرم نشان داده می‌شود و دیالوگ باز می‌ماند", async () => {
    failMutation = true;
    const onClose = renderDialog({});
    await screen.findByText("شرکت نمونه");
    fillItem();
    submitForm();

    expect(await screen.findByText(/سقف مجاز/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("ویرایش پیش‌فاکتور", () => {
  it("فرم با مقادیر سفارش موجود پر می‌شود", async () => {
    renderDialog({ order: ORDER });
    expect(screen.getByText("ویرایش پیش‌فاکتور PF-1201")).toBeInTheDocument();
    await screen.findByText("شرکت نمونه");
    expect(screen.getByLabelText("شناسه محصول")).toHaveValue("P1");
    expect(screen.getByLabelText("تعداد")).toHaveValue(2);
    expect(screen.getByLabelText("قیمت (ریال)")).toHaveValue(1_000_000);
    expect(screen.getByLabelText("رنگ")).toHaveValue("سفید");
    expect(screen.getByLabelText("مشتری (حساب)")).toHaveValue("acc-1");
  });

  it("ارسال → PATCH /api/orders/PF-1201 با id اقلام موجود", async () => {
    renderDialog({ order: ORDER });
    await screen.findByText("شرکت نمونه");
    submitForm();

    await waitFor(() => expect(lastCall().init.method).toBe("PATCH"));
    expect(lastCall().url).toBe("/api/orders/PF-1201");
    expect(lastCall().init.json).toMatchObject({
      items: [{ id: "i1", productId: "P1", qty: 2, price: 1_000_000, discount: 0, color: "سفید" }],
    });
  });
});
