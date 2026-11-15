"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import type { Permission } from "@core/permissions";

export type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

type MenuItem = {
  key: string;
  label: string;
  /** مسیر صفحه — وقتی موجود باشد آیتم یک Link واقعی است. */
  href?: string;
  /** مجوز لازم برای دیدن این آیتم (فیلتر کلاینت — منبع حقیقت سرور است، CD-05). */
  permission?: Permission;
};

/**
 * آیتم‌های منو — صفحات ساخته‌شده Link واقعی دارند؛ بقیه تا فاز بعد
 * `aria-disabled` می‌مانند. فقط آیتم‌هایی نشان داده می‌شوند که کاربر
 * مجوز آن‌ها را دارد (PHASE_02 §۱۰). «خانه» بدون مجوز است.
 */
const MENU_ITEMS: readonly MenuItem[] = [
  { key: "home", label: "خانه", href: "/" },
  { key: "leads", label: "سرنخ‌ها", href: "/leads", permission: "leads.view" },
  { key: "customers", label: "مشتریان", href: "/customers", permission: "customers.view" },
  { key: "orders", label: "سفارش‌ها", href: "/orders", permission: "orders.view" },
  { key: "production", label: "تولید", href: "/production", permission: "production.view" },
  { key: "inventory", label: "انبار", href: "/stock", permission: "inventory.view" },
  { key: "purchasing", label: "خرید", href: "/buys", permission: "purchasing.view" },
  { key: "finance", label: "مالی", href: "/finance", permission: "finance.view" },
  { key: "reports", label: "گزارش‌ها", href: "/reports", permission: "reports.view" },
  { key: "admin", label: "تعاریف و تنظیمات", href: "/admin", permission: "catalog.products.read" },
  { key: "users", label: "کاربران", href: "/admin", permission: "admin.users" },
  { key: "settings", label: "تنظیمات", href: "/admin", permission: "admin.settings" },
];

/**
 * ستون کناری — چاقو/کشویی زیر md (CD-12).
 * منو بر اساس مجوزهای نشست فیلتر می‌شود.
 */
export function Sidebar({ open, onClose }: SidebarProps) {
  const me = useMeQuery();
  const pathname = usePathname();
  const permissions = new Set(me.data?.permissions ?? []);

  const visible = MENU_ITEMS.filter(
    (item) => item.permission === undefined || permissions.has(item.permission),
  );

  return (
    <aside className="sidebar" data-open={open ? "true" : "false"} aria-label="منو">
      <div className="sidebar-head">
        <span className="sidebar-label">صفحات</span>
        <button type="button" className="sidebar-close" aria-label="بستن منو" onClick={onClose}>
          ×
        </button>
      </div>
      <nav className="sidebar-nav">
        {visible.map((item) =>
          item.href ? (
            <Link
              key={item.key}
              href={item.href}
              className="sidebar-link"
              aria-current={pathname === item.href ? "page" : undefined}
              onClick={onClose}
            >
              {item.label}
            </Link>
          ) : (
            <a key={item.key} className="sidebar-link" aria-disabled="true" title="در فاز بعدی">
              {item.label}
            </a>
          ),
        )}
      </nav>
    </aside>
  );
}
