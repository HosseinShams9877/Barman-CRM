/**
 * آزمون نوار بالا — نمایش نقش کاربر واقعی و خروج (PHASE_02 §۱۰).
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicUser } from "@core/auth";
import { Navbar } from "./Navbar";

vi.mock("@modules/auth/hooks/useAuth", () => ({
  useMeQuery: vi.fn(),
  useLogoutMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const { useMeQuery } = await import("@modules/auth/hooks/useAuth");
const { useLogoutMutation } = await import("@modules/auth/hooks/useAuth");

const mockedUseMeQuery = vi.mocked(useMeQuery);
const mockedUseLogoutMutation = vi.mocked(useLogoutMutation);

function setUser(user: PublicUser | null): void {
  mockedUseMeQuery.mockReturnValue({ data: user, isLoading: false } as never);
}

describe("Navbar — نقش واقعی", () => {
  beforeEach(() => {
    mockedUseMeQuery.mockReset();
    mockedUseLogoutMutation.mockReset();
    mockedUseLogoutMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
  });

  it("کاربر واردشده: نام و برچسب نقش فارسی", () => {
    setUser({
      id: "u1",
      name: "ali",
      title: "ادمین سیستم",
      roles: ["admin"],
      permissions: [],
      noMoney: false,
    });
    render(<Navbar onOpenSidebar={() => {}} />);
    expect(screen.getByText("ali")).toBeInTheDocument();
    expect(screen.getByText("ادمین")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "خروج" })).toBeInTheDocument();
  });

  it("چند نقش: برچسب‌ها با ویرگول جدا می‌شوند", () => {
    setUser({
      id: "u1",
      name: "ali",
      title: null,
      roles: ["sales", "production"],
      permissions: [],
      noMoney: true,
    });
    render(<Navbar onOpenSidebar={() => {}} />);
    expect(screen.getByText("کارشناس فروش، تولید")).toBeInTheDocument();
  });

  it("کاربر مهمان: لینک ورود، بدون دکمه خروج", () => {
    setUser(null);
    render(<Navbar onOpenSidebar={() => {}} />);
    expect(screen.getByRole("link", { name: "ورود" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: "خروج" })).not.toBeInTheDocument();
  });

  it("نقش نامشرفتهم (خارج از ماتریس): نقش: —", () => {
    setUser({
      id: "u1",
      name: "ali",
      title: null,
      roles: ["ghost" as never],
      permissions: [],
      noMoney: false,
    });
    render(<Navbar onOpenSidebar={() => {}} />);
    expect(screen.getByText("نقش: —")).toBeInTheDocument();
  });

  it("در حال بارگذاری نشست: نشانگر بارگذاری", () => {
    mockedUseMeQuery.mockReturnValue({ data: undefined, isLoading: true } as never);
    render(<Navbar onOpenSidebar={() => {}} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
