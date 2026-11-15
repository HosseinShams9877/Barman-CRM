/**
 * آزمون بورد سرنخ‌ها — PHASE_03 درگاه خروج ۵ (UI: حداقل یک تست به ازای لیست).
 *
 * apiFetch بر اساس URL مسیریابی می‌شود:
 *   /api/auth/me → نشست با مجوزها، /api/leads?... → لیست سرنخ‌ها،
 *   /api/leads/<id> (PATCH) → جابه‌جایی مرحله.
 *
 * پوشش: حالت بارگذاری/خطا/خالی، رندر ستون‌ها و کارت‌ها، مجوز دکمه‌ها
 * (CD-05) و انتقال مرحله (شامل lost → دیالوگ دلیل — leads.js:474).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@components/feedback";
import { ApiError } from "@core/errors";
import type { LeadListItem } from "../types/lead.types";
import { LeadBoard } from "./LeadBoard";

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
    permissions: ["leads.create", "leads.edit", "leads.view", "money.view"],
    noMoney: false,
  },
};

const LEADS: LeadListItem[] = [
  {
    id: "LD-1001",
    line: "prod",
    stage: "raw",
    title: "علی رضایی",
    amount: 5_000_000,
    source: "تماس ورودی",
    note: "",
    accountId: null,
    account: null,
    ownerId: "u1",
    ownerName: "علی",
    lostReason: null,
    lostFrom: null,
    nextAt: "1405/08/19",
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "LD-1002",
    line: "prod",
    stage: "opp",
    title: "",
    amount: null,
    source: "سایت",
    note: "",
    accountId: "AC-1",
    account: { phones: ["09130000000"], name: "" },
    ownerId: "u1",
    ownerName: "علی",
    lostReason: null,
    lostFrom: null,
    nextAt: null,
    createdAt: 0,
    updatedAt: 0,
  },
];

function routeFetch(url: string, opts?: { method?: string }): unknown {
  if (url.includes("/api/auth/me")) return ME;
  if (url.startsWith("/api/leads?")) return { items: LEADS, total: 40, page: 1, pageSize: 100 };
  if (url.match(/^\/api\/leads\/[^/]+$/) && opts?.method === "PATCH") return { id: "LD-1001" };
  throw new ApiError(500, "INTERNAL", "مسیر موک نشده: " + url);
}

function renderBoard(): { route: ReturnType<typeof vi.fn> } {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <LeadBoard />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { route: vi.mocked(apiFetch) };
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  window.localStorage.clear();
});

describe("حالت‌های کوئری (CD-09)", () => {
  it("بارگذاری → نمایش حالت بارگذاری، سپس ستون‌ها و کارت‌ها", async () => {
    vi.mocked(apiFetch).mockImplementation(routeFetch as never);
    renderBoard();

    expect(screen.getByText("در حال بارگذاری سرنخ‌ها…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("علی رضایی")).toBeInTheDocument());

    expect(screen.getByText(/سرنخ از ۴۰/)).toBeInTheDocument();
    expect(screen.getByLabelText("ستون سرنخ اولیه")).toBeInTheDocument();
    expect(screen.getByLabelText("ستون فرصت تجاری")).toBeInTheDocument();
    expect(screen.getByText("۰۹۱۳ ۰۰۰ ۰۰۰۰")).toBeInTheDocument();
  });

  it("خطای سرور → ErrorState با دکمه تلاش مجدد", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url: string) => {
      if (url.includes("/api/auth/me")) return ME;
      throw new ApiError(500, "INTERNAL", "خطای دیتابیس.");
    });
    renderBoard();

    expect(await screen.findByText("بارگذاری ناموفق")).toBeInTheDocument();
    expect(screen.getByText("خطای دیتابیس.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تلاش مجدد" })).toBeInTheDocument();
  });

  it("لیست خالی → EmptyState", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url: string) => {
      if (url.includes("/api/auth/me")) return ME;
      if (url.startsWith("/api/leads?")) return { items: [], total: 0, page: 1, pageSize: 100 };
      throw new ApiError(500, "INTERNAL", "x");
    });
    renderBoard();

    expect(await screen.findByText("سرنخی وجود ندارد")).toBeInTheDocument();
  });
});

describe("مجوزها در UI (CD-05)", () => {
  it("دکمه «سرنخ جدید» با مجوز leads.create نمایش داده می‌شود", async () => {
    vi.mocked(apiFetch).mockImplementation(routeFetch as never);
    renderBoard();
    expect(await screen.findByRole("button", { name: /سرنخ جدید/ })).toBeInTheDocument();
  });

  it("بدون مجوز leads.create → دکمه ایجاد پنهان است", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url: string) => {
      if (url.includes("/api/auth/me")) {
        return { user: { ...ME.user, permissions: ["leads.view"] } };
      }
      if (url.startsWith("/api/leads?")) return { items: LEADS, total: 2, page: 1, pageSize: 100 };
      throw new ApiError(500, "INTERNAL", "x");
    });
    renderBoard();
    await screen.findByText("علی رضایی");
    expect(screen.queryByRole("button", { name: /سرنخ جدید/ })).not.toBeInTheDocument();
  });

  it("نقش بدون money.view → مبلغ در کارت نمایش داده نمی‌شود (R-32)", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url: string) => {
      if (url.includes("/api/auth/me")) {
        return { user: { ...ME.user, permissions: ["leads.view", "leads.edit", "noMoney"], noMoney: true } };
      }
      if (url.startsWith("/api/leads?")) return { items: LEADS, total: 2, page: 1, pageSize: 100 };
      throw new ApiError(500, "INTERNAL", "x");
    });
    renderBoard();
    await screen.findByText("علی رضایی");
    expect(screen.queryByText(/ریال/)).not.toBeInTheDocument();
  });
});

describe("جابه‌جایی مرحله (select موبایل — CD-12)", () => {
  it("انتقال به فرصت → PATCH و اعلام موفقیت", async () => {
    vi.mocked(apiFetch).mockImplementation(routeFetch as never);
    renderBoard();
    const select = (await screen.findAllByLabelText("انتقال مرحله"))[0] as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "opp" } });

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/api/leads/LD-1001", { method: "PATCH", json: { to: "opp" } }),
    );
    expect(await screen.findByText(/منتقل شد/)).toBeInTheDocument();
  });

  it("انتقال به از دست رفته → ابتدا دیالوگ دلیل (leads.js:474)", async () => {
    vi.mocked(apiFetch).mockImplementation(routeFetch as never);
    renderBoard();
    const select = (await screen.findAllByLabelText("انتقال مرحله"))[0] as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "lost" } });

    const reasonSelect = await screen.findByLabelText(/دلیل از دست رفتن/);
    fireEvent.change(reasonSelect, { target: { value: "قیمت بالا" } });
    const form = document.getElementById("lost-form");
    if (!form) throw new Error("فرم دلیل پیدا نشد.");
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/api/leads/LD-1001", {
        method: "PATCH",
        json: { to: "lost", lostReason: "قیمت بالا" },
      }),
    );
  });
});
