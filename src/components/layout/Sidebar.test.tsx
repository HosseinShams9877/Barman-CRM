/**
 * آزمون فیلتر منوی کناری بر اساس مجوزها (PHASE_02 §۱۰ / CD-05).
 *
 * پنهان‌سازی در کلاینت فقط UX است — منبع حقیقت سرور است؛ این آزمون فقط
 * نشان می‌دهد که آیتم‌های بدون مجوز نمایش داده نمی‌شوند.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicUser } from "@core/auth";
import { Sidebar } from "./Sidebar";

vi.mock("@modules/auth/hooks/useAuth", () => ({
  useMeQuery: vi.fn(),
}));

const mocked = (await import("@modules/auth/hooks/useAuth")) as unknown as {
  useMeQuery: ReturnType<typeof vi.fn>;
};

function setUser(user: PublicUser | null): void {
  mocked.useMeQuery.mockReturnValue({ data: user, isLoading: false });
}

function renderSidebar(): void {
  render(<Sidebar open={false} onClose={() => {}} />);
}

describe("Sidebar — فیلتر بر اساس مجوزها", () => {
  beforeEach(() => {
    mocked.useMeQuery.mockReset();
  });

  it("کاربر مهمان (null): فقط خانه", () => {
    setUser(null);
    renderSidebar();
    expect(screen.getByText("خانه")).toBeInTheDocument();
    expect(screen.queryByText("سرنخ‌ها")).not.toBeInTheDocument();
    expect(screen.queryByText("مالی")).not.toBeInTheDocument();
    expect(screen.queryByText("تنظیمات")).not.toBeInTheDocument();
  });

  it("admin: همه آیتم‌ها", () => {
    setUser({
      id: "u1",
      name: "admin",
      title: null,
      roles: ["admin"],
      permissions: [
        "leads.view",
        "customers.view",
        "orders.view",
        "production.view",
        "inventory.view",
        "purchasing.view",
        "finance.view",
        "reports.view",
        "admin.users",
        "admin.settings",
        "money.view",
      ],
      noMoney: false,
    });
    renderSidebar();
    for (const label of [
      "خانه",
      "سرنخ‌ها",
      "مشتریان",
      "سفارش‌ها",
      "تولید",
      "انبار",
      "خرید",
      "مالی",
      "گزارش‌ها",
      "کاربران",
      "تنظیمات",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("depot: انبار و سفارش‌ها ولی نه مالی و سرنخ‌ها", () => {
    setUser({
      id: "u2",
      name: "depot",
      title: null,
      roles: ["depot"],
      permissions: ["orders.view", "inventory.view", "inventory.moves"],
      noMoney: true,
    });
    renderSidebar();
    expect(screen.getByText("انبار")).toBeInTheDocument();
    expect(screen.getByText("سفارش‌ها")).toBeInTheDocument();
    expect(screen.queryByText("سرنخ‌ها")).not.toBeInTheDocument();
    expect(screen.queryByText("مالی")).not.toBeInTheDocument();
    expect(screen.queryByText("کاربران")).not.toBeInTheDocument();
    expect(screen.queryByText("تنظیمات")).not.toBeInTheDocument();
  });

  it("در حال بارگذاری: مجموعه مهمان نمایش داده می‌شود", () => {
    mocked.useMeQuery.mockReturnValue({ data: null, isLoading: true });
    renderSidebar();
    // وضعیت بارگذاری هم null است → همان مجموعه مهمان
    expect(screen.getByText("خانه")).toBeInTheDocument();
    expect(screen.queryByText("سرنخ‌ها")).not.toBeInTheDocument();
  });
});
