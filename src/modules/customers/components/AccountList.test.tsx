/**
 * آزمون لیست حساب‌های مشتری — PHASE_03 درگاه خروج ۵ (UI: حداقل یک تست به ازای لیست).
 *
 * apiFetch بر اساس URL مسیریابی می‌شود:
 *   /api/auth/me → نشست، /api/customers?... → لیست حساب‌ها،
 *   /api/customers/<id>/deactivate → حذف نرم.
 *
 * پوشش: حالت بارگذاری/خطا/خالی، ستون‌های جدول، مجوز دکمه‌ها (CD-05)،
 * غیرفعال‌سازی (POST بدون بدنه) و صفحه‌بندی (CD-09).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@components/feedback";
import { ApiError } from "@core/errors";
import type { AccountListItem } from "../types/account.types";
import { AccountList } from "./AccountList";

vi.mock("@core/api", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@core/api");

const ME = {
  user: {
    id: "u1",
    name: "ali",
    title: "کارشناس",
    roles: [{ roleKey: "sales" }],
    permissions: ["customers.create", "customers.edit", "customers.view"],
    noMoney: false,
  },
};

const ACCOUNTS: AccountListItem[] = [
  {
    id: "AC-101",
    name: "شرکت نمونه",
    kind: "customer",
    active: true,
    address: "تهران",
    note: "",
    phones: [{ id: "p1", kind: "همراه", number: "09121234567" }],
    contactCount: 2,
    leadCount: 3,
    createdAt: 1,
  },
  {
    id: "AC-102",
    name: "",
    kind: "unknown",
    active: false,
    address: "",
    note: "",
    phones: [],
    contactCount: 0,
    leadCount: 0,
    createdAt: 1,
  },
];

function renderList(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AccountList />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe("حالت‌های کوئری (CD-09)", () => {
  it("بارگذاری → جدول با ستون‌ها و صفحه‌بندی", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url: string) => {
      if (url.includes("/api/auth/me")) return ME;
      if (url.startsWith("/api/customers?")) return { items: ACCOUNTS, total: 25, page: 1, pageSize: 20 };
      throw new ApiError(500, "INTERNAL", "x");
    });
    renderList();

    expect(screen.getByText("در حال بارگذاری حساب‌ها…")).toBeInTheDocument();
    await screen.findByText("شرکت نمونه");

    expect(screen.getByText("AC-101")).toBeInTheDocument();
    expect(screen.getByText("همراه: ۰۹۱۲ ۱۲۳ ۴۵۶۷")).toBeInTheDocument();
    expect(screen.getByText("۲")).toBeInTheDocument();
    expect(screen.getByText("فعال")).toBeInTheDocument();
    expect(screen.getByText("غیرفعال")).toBeInTheDocument();
    expect(screen.getByText(/صفحه ۱ از ۲/)).toBeInTheDocument();
    expect(screen.getByText(/۲۵ حساب/)).toBeInTheDocument();
  });

  it("لیست خالی → EmptyState", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url: string) => {
      if (url.includes("/api/auth/me")) return ME;
      if (url.startsWith("/api/customers?")) return { items: [], total: 0, page: 1, pageSize: 20 };
      throw new ApiError(500, "INTERNAL", "x");
    });
    renderList();

    expect(await screen.findByText("حسابی وجود ندارد")).toBeInTheDocument();
  });

  it("خطای سرور → ErrorState", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url: string) => {
      if (url.includes("/api/auth/me")) return ME;
      throw new ApiError(500, "INTERNAL", "خطای دیتابیس.");
    });
    renderList();

    expect(await screen.findByText("بارگذاری ناموفق")).toBeInTheDocument();
    expect(screen.getByText("خطای دیتابیس.")).toBeInTheDocument();
  });
});

describe("غیرفعال‌سازی (حذف نرم)", () => {
  it("کلیک → POST /api/customers/AC-101/deactivate بدون بدنه و اعلام موفقیت", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url: string, opts?: { method?: string }) => {
      if (url.includes("/api/auth/me")) return ME;
      if (url.startsWith("/api/customers?")) return { items: ACCOUNTS, total: 2, page: 1, pageSize: 20 };
      if (url.endsWith("/deactivate") && opts?.method === "POST") return undefined;
      throw new ApiError(500, "INTERNAL", "x");
    });
    renderList();

    const buttons = await screen.findAllByRole("button", { name: "غیرفعال‌سازی" });
    expect(buttons.length).toBe(1); // فقط حساب فعال
    fireEvent.click(buttons[0] as HTMLElement);

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/api/customers/AC-101/deactivate", { method: "POST" }),
    );
    expect(await screen.findByText(/غیرفعال شد/)).toBeInTheDocument();
  });
});

describe("مجوزها در UI (CD-05)", () => {
  it("بدون customers.create → دکمه «حساب جدید» پنهان است", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url: string) => {
      if (url.includes("/api/auth/me")) {
        return { user: { ...ME.user, permissions: ["customers.view"] } };
      }
      if (url.startsWith("/api/customers?")) return { items: ACCOUNTS, total: 2, page: 1, pageSize: 20 };
      throw new ApiError(500, "INTERNAL", "x");
    });
    renderList();
    await screen.findByText("شرکت نمونه");
    expect(screen.queryByRole("button", { name: /حساب جدید/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ویرایش" })).not.toBeInTheDocument();
  });
});
