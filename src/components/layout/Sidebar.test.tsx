/**
 * آزمون منوی کناری — PHASE_02 §۱۰ / CD-05 / فاز ۸ (رفع باگ ناوبری).
 *
 * موارد کلیدی:
 *  - هر آیتم یک <a> واقعی با href درست است (link/button/تداخل کلیک).
 *  - آیتم‌های بدون مجوز نمایش داده نمی‌شوند (پنهان‌سازی کلاینت).
 *  - آیتم‌های کاربران/تنظیمات مسیرهای مخصوص خود را دارند (bug فاز ۸:
 *    همه به /admin می‌رفتند).
 *  - ساختار بر اساس نقش مطابق Demo (core.js navItems / admin.js:10).
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicUser } from "@core/auth";
import { Sidebar } from "./Sidebar";

vi.mock("@modules/auth/hooks/useAuth", () => ({
  useMeQuery: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
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

const ADMIN_PERMS: PublicUser["permissions"] = [
  "leads.view",
  "customers.view",
  "orders.view",
  "production.view",
  "inventory.view",
  "purchasing.view",
  "finance.view",
  "reports.view",
  "money.view",
  "catalog.products.read",
  "catalog.materials.read",
  "catalog.bom.read",
  "catalog.suppliers.read",
  "admin.users",
  "admin.lists",
  "admin.settings",
];

describe("Sidebar — رفع باگ ناوبری (هر آیتم <a> با href درست)", () => {
  beforeEach(() => {
    mocked.useMeQuery.mockReset();
  });

  it("admin: همه آیتم‌ها لینک واقعی با href مخصوص خودشان هستند", () => {
    setUser({ id: "u1", name: "admin", title: null, roles: ["admin"], permissions: ADMIN_PERMS, noMoney: false });
    renderSidebar();

    const linkOf = (label: string): HTMLAnchorElement => {
      const el = screen.getByText(label).closest("a");
      expect(el, `آیتم «${label}» داخل <a> نیست`).not.toBeNull();
      return el as HTMLAnchorElement;
    };

    // ریشه باگ فاز ۸: کاربران/تنظیمات نباید به /admin بروند
    expect(linkOf("کاربران و دسترسی‌ها").getAttribute("href")).toBe("/admin/users");
    expect(linkOf("تنظیمات عمومی").getAttribute("href")).toBe("/admin/settings");
    // هر تب مدیریت مسیر مخصوص خود را دارد (Demo: admin.html#<tab>)
    expect(linkOf("محصولات").getAttribute("href")).toBe("/admin/products");
    expect(linkOf("مواد اولیه").getAttribute("href")).toBe("/admin/materials");
    expect(linkOf("فرمول تولید").getAttribute("href")).toBe("/admin/bom");
    expect(linkOf("ستون‌های بورد سرنخ").getAttribute("href")).toBe("/admin/leadcols");
    expect(linkOf("فهرست‌ها (منبع سرنخ، سمت‌ها …)").getAttribute("href")).toBe("/admin/lists");
    expect(linkOf("تأمین‌کننده‌ها و نمایندگی‌ها").getAttribute("href")).toBe("/admin/suppliers");
    expect(linkOf("مشتریان").getAttribute("href")).toBe("/customers");
  });

  it("management: گروه‌بندی و آیتم‌های نقش مطابق Demo", () => {
    setUser({
      id: "u2",
      name: "mgr",
      title: null,
      roles: ["management"],
      permissions: ADMIN_PERMS,
      noMoney: false,
    });
    renderSidebar();

    const linkOf = (label: string): HTMLAnchorElement =>
      screen.getByText(label).closest("a") as HTMLAnchorElement;

    expect(linkOf("میز کار").getAttribute("href")).toBe("/");
    expect(linkOf("پیگیری سرنخ‌ها").getAttribute("href")).toBe("/leads");
    expect(linkOf("مسیر سفارش‌ها").getAttribute("href")).toBe("/orders");
    expect(linkOf("تأیید خریدها").getAttribute("href")).toBe("/buys");
    expect(linkOf("دریافتنی‌ها و پرداختنی‌ها").getAttribute("href")).toBe("/finance");
    expect(linkOf("تولید").getAttribute("href")).toBe("/production");
    expect(linkOf("موجودی انبارها").getAttribute("href")).toBe("/stock");
    expect(linkOf("گزارش‌ها").getAttribute("href")).toBe("/reports");
    expect(linkOf("تعاریف و تنظیمات").getAttribute("href")).toBe("/admin");
    expect(screen.getByText("سررسیدها و بدهکاری‌ها")).toBeInTheDocument(); // side-cap
  });

  it("sales: مسیرهای نقش فروش و بدون دسترسی به مدیریت", () => {
    setUser({
      id: "u5",
      name: "sales",
      title: null,
      roles: ["sales"],
      permissions: ["leads.view", "customers.view", "orders.view", "inventory.view", "catalog.products.read"],
      noMoney: true,
    });
    renderSidebar();

    const linkOf = (label: string): HTMLAnchorElement =>
      screen.getByText(label).closest("a") as HTMLAnchorElement;

    expect(linkOf("پیگیری سرنخ‌ها").getAttribute("href")).toBe("/leads");
    expect(linkOf("سفارش‌های من").getAttribute("href")).toBe("/orders");
    expect(linkOf("موجودی محصولات").getAttribute("href")).toBe("/stock");
    expect(linkOf("محصولات و قیمت‌ها").getAttribute("href")).toBe("/admin/products");
    expect(linkOf("مشتریان").getAttribute("href")).toBe("/customers");
    // بدون مجوز admin — آیتم‌های مدیریت نبود باشند
    expect(screen.queryByText("تنظیمات عمومی")).not.toBeInTheDocument();
    expect(screen.queryByText("کاربران و دسترسی‌ها")).not.toBeInTheDocument();
  });

  it("آیتم بدون مجوز فیلتر می‌شود (CD-05)", () => {
    setUser({
      id: "u8",
      name: "depot",
      title: null,
      roles: ["depot"],
      permissions: ["inventory.view", "production.view"],
      noMoney: true,
    });
    renderSidebar();

    expect(screen.getByText("موجودی دپو").closest("a")).not.toBeNull();
    expect(screen.queryByText("پیگیری سرنخ‌ها")).not.toBeInTheDocument();
    expect(screen.queryByText("دریافتنی‌ها و پرداختنی‌ها")).not.toBeInTheDocument();
  });

  it("کاربر مهمان (null): گروه پیش‌فرض بدون آیتم‌های نقشی", () => {
    setUser(null);
    renderSidebar();
    expect(screen.queryByText("پیگیری سرنخ‌ها")).not.toBeInTheDocument();
    expect(screen.queryByText("تنظیمات عمومی")).not.toBeInTheDocument();
  });

  it("رویداد onClose هنگام کلیک آیتم فراخوانی می‌شود", () => {
    const onClose = vi.fn();
    setUser({ id: "u5", name: "sales", title: null, roles: ["sales"], permissions: ["leads.view"], noMoney: true });
    render(<Sidebar open={true} onClose={onClose} />);
    const link = screen.getByText("پیگیری سرنخ‌ها").closest("a") as HTMLAnchorElement;
    link.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
