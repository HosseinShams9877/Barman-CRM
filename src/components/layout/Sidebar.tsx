"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import type { Permission } from "@core/permissions";
import { Icon, type IconName } from "@components/ui/Icon";

export type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: IconName;
  /** مجوز لازم برای دیدن (فیلتر کلاینت — منبع حقیقت سرور است، CD-05). */
  permission?: Permission;
};

type NavGroup = {
  /** عنوان سرستون — معادل .side-cap در Demo (core.js:459). */
  caption?: string;
  items: NavItem[];
};

/**
 * ساختار ناوبری — دقیقاً مطابق Demo (app/core.js navItems):
 * هر نقش گروه‌بندی و آیتم‌های مخصوص خود را می‌بیند. نگاشت صفحات Demo
 * به مسیرهای برنامه:
 *   home.html/prod.html → /  ·  leads.html → /leads
 *   order.html?new=1   → /leads (فرم سرنخ/پیش‌فاکتور در ماژول‌ها)
 *   flow.html          → /orders  ·  buy.html → /buys
 *   fin.html           → /finance ·  prod.html → /production
 *   stock.html         → /stock   ·  reports.html → /reports
 *   admin.html#tab     → /admin (تب‌ها)
 *
 * آیتم‌های نقش admin — مطابق admin.js:10 (۹ تب).
 */
const NAV_BY_ROLE: Readonly<Record<string, readonly NavGroup[]>> = {
  management: [
    { caption: undefined, items: [{ key: "home", label: "میز کار", href: "/", icon: "grid" }] },
    {
      caption: "خرید و تأمین",
      items: [{ key: "buys", label: "تأیید خریدها", href: "/buys", icon: "cart", permission: "purchasing.view" }],
    },
    {
      caption: "سررسیدها و بدهکاری‌ها",
      items: [{ key: "finance", label: "دریافتنی‌ها و پرداختنی‌ها", href: "/finance", icon: "coins", permission: "finance.view" }],
    },
    {
      caption: "سفارش‌ها",
      items: [{ key: "orders", label: "مسیر سفارش‌ها", href: "/orders", icon: "layers", permission: "orders.view" }],
    },
    {
      caption: "فروش",
      items: [{ key: "leads", label: "پیگیری سرنخ‌ها", href: "/leads", icon: "phone", permission: "leads.view" }],
    },
    {
      caption: "تولید و انبار",
      items: [
        { key: "production", label: "تولید", href: "/production", icon: "factory", permission: "production.view" },
        { key: "stock", label: "موجودی انبارها", href: "/stock", icon: "warehouse", permission: "inventory.view" },
      ],
    },
    {
      caption: "گزارش و تعاریف",
      items: [
        { key: "reports", label: "گزارش‌ها", href: "/reports", icon: "chart", permission: "reports.view" },
        { key: "admin", label: "تعاریف و تنظیمات", href: "/admin", icon: "gear", permission: "catalog.products.read" },
      ],
    },
  ],
  admin: [
    {
      caption: "تعاریف",
      items: [
        { key: "products", label: "محصولات", href: "/admin/products", icon: "box", permission: "catalog.products.read" },
        { key: "materials", label: "مواد اولیه", href: "/admin/materials", icon: "flask", permission: "catalog.materials.read" },
        { key: "bom", label: "فرمول تولید", href: "/admin/bom", icon: "clipboard", permission: "catalog.bom.read" },
        { key: "customers", label: "مشتریان", href: "/customers", icon: "users", permission: "customers.view" },
        {
          key: "suppliers",
          label: "تأمین‌کننده‌ها و نمایندگی‌ها",
          href: "/admin/suppliers",
          icon: "store",
          permission: "catalog.suppliers.read",
        },
        { key: "users", label: "کاربران و دسترسی‌ها", href: "/admin/users", icon: "user", permission: "admin.users" },
        { key: "lists", label: "فهرست‌ها (منبع سرنخ، سمت‌ها …)", href: "/admin/lists", icon: "list", permission: "admin.lists" },
        { key: "leadcols", label: "ستون‌های بورد سرنخ", href: "/admin/leadcols", icon: "grid", permission: "admin.lists" },
        { key: "settings", label: "تنظیمات عمومی", href: "/admin/settings", icon: "gear", permission: "admin.settings" },
      ],
    },
  ],
  sales: [
    { caption: undefined, items: [{ key: "home", label: "میز کار", href: "/", icon: "grid" }] },
    {
      caption: "فروش",
      items: [
        { key: "leads", label: "پیگیری سرنخ‌ها", href: "/leads", icon: "phone", permission: "leads.view" },
        { key: "orders", label: "سفارش‌های من", href: "/orders", icon: "layers", permission: "orders.view" },
      ],
    },
    {
      caption: "اطلاعات",
      items: [
        { key: "stock", label: "موجودی محصولات", href: "/stock", icon: "warehouse", permission: "inventory.view" },
        { key: "products", label: "محصولات و قیمت‌ها", href: "/admin/products", icon: "box", permission: "catalog.products.read" },
        { key: "customers", label: "مشتریان", href: "/customers", icon: "users", permission: "customers.view" },
      ],
    },
  ],
  salesManager: [
    { caption: undefined, items: [{ key: "home", label: "میز کار", href: "/", icon: "grid" }] },
    {
      caption: "فروش",
      items: [
        { key: "leads", label: "پیگیری سرنخ‌ها", href: "/leads", icon: "phone", permission: "leads.view" },
        { key: "orders", label: "مسیر سفارش‌ها", href: "/orders", icon: "layers", permission: "orders.view" },
        { key: "reports", label: "گزارش سرنخ و فروش", href: "/reports", icon: "chart", permission: "reports.view" },
      ],
    },
    {
      caption: "اطلاعات",
      items: [
        { key: "stock", label: "موجودی محصولات", href: "/stock", icon: "warehouse", permission: "inventory.view" },
        { key: "products", label: "محصولات و قیمت‌ها", href: "/admin/products", icon: "box", permission: "catalog.products.read" },
        { key: "customers", label: "مشتریان", href: "/customers", icon: "users", permission: "customers.view" },
      ],
    },
  ],
  finance: [
    {
      caption: "خرید",
      items: [{ key: "buys", label: "پرداخت خریدها", href: "/buys", icon: "cart", permission: "purchasing.view" }],
    },
    {
      caption: "سررسیدها و بدهکاری‌ها",
      items: [{ key: "finance", label: "دریافتنی‌ها و پرداختنی‌ها", href: "/finance", icon: "coins", permission: "finance.view" }],
    },
    {
      caption: "سفارش‌ها",
      items: [{ key: "orders", label: "مسیر سفارش‌ها", href: "/orders", icon: "layers", permission: "orders.view" }],
    },
    {
      caption: "گزارش و تعاریف",
      items: [
        { key: "reports", label: "گزارش‌ها", href: "/reports", icon: "chart", permission: "reports.view" },
        { key: "customers", label: "مشتریان", href: "/customers", icon: "users", permission: "customers.view" },
        { key: "suppliers", label: "تأمین‌کننده‌ها", href: "/admin/suppliers", icon: "store", permission: "catalog.suppliers.read" },
      ],
    },
  ],
  production: [
    { caption: undefined, items: [{ key: "home", label: "میز کار", href: "/", icon: "grid" }] },
    {
      caption: "خرید",
      items: [{ key: "buys", label: "ورود مواد اولیه", href: "/buys", icon: "cart", permission: "purchasing.view" }],
    },
    {
      caption: "تولید و مواد",
      items: [
        { key: "production", label: "تولید", href: "/production", icon: "factory", permission: "production.view" },
        { key: "stock", label: "موجودی مواد اولیه", href: "/stock", icon: "flask", permission: "inventory.view" },
      ],
    },
    {
      caption: "تعاریف",
      items: [
        { key: "bom", label: "فرمول‌های تولید", href: "/admin/bom", icon: "clipboard", permission: "catalog.bom.read" },
        { key: "materials", label: "مواد اولیه", href: "/admin/materials", icon: "flask", permission: "catalog.materials.read" },
        { key: "products", label: "محصولات", href: "/admin/products", icon: "box", permission: "catalog.products.read" },
      ],
    },
  ],
  depot: [
    { caption: undefined, items: [{ key: "home", label: "میز کار", href: "/", icon: "grid" }] },
    {
      caption: "خرید",
      items: [{ key: "buys", label: "ورود محصولات نمایندگی", href: "/buys", icon: "cart", permission: "purchasing.view" }],
    },
    {
      caption: "انبار دپو",
      items: [
        { key: "stock", label: "موجودی دپو", href: "/stock", icon: "warehouse", permission: "inventory.view" },
        { key: "production", label: "تولید", href: "/production", icon: "factory", permission: "production.view" },
      ],
    },
    {
      caption: "تعاریف",
      items: [{ key: "products", label: "محصولات", href: "/admin/products", icon: "box", permission: "catalog.products.read" }],
    },
  ],
};

/**
 * ستون کناری — چاقو/کشویی زیر md (CD-12).
 * منو بر اساس مجوزهای نشست فیلتر می‌شود (CD-05).
 */
export function Sidebar({ open, onClose }: SidebarProps) {
  const me = useMeQuery();
  const pathname = usePathname();
  const permissions = new Set(me.data?.permissions ?? []);
  const role = (me.data?.roles ?? [])[0] ?? "sales";

  const groups: readonly NavGroup[] = (NAV_BY_ROLE[role] ?? NAV_BY_ROLE.sales) as readonly NavGroup[];

  const isCurrent = (href: string): boolean =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="sidebar" data-open={open ? "true" : "false"} aria-label="منوی پنل">
      <Link className="side-brand" href="/" title="صفحه اصلی">
        <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <path d="M6 10h36v28H6z" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
          <path
            d="M6 20c6-6 12 6 18 0s12 6 18 0M6 29c6-6 12 6 18 0s12 6 18 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </svg>
        <span>
          <b>بارمان</b>
          <small>BARMAN 3D WORKS</small>
        </span>
      </Link>

      <button type="button" className="sidebar-close" aria-label="بستن منو" onClick={onClose}>
        <Icon name="x" size="icon-sm" />
      </button>

      <nav className="side-nav" aria-label="صفحات">
        {groups.map((group, gi) => {
          const visible = group.items.filter(
            (item) => item.permission === undefined || permissions.has(item.permission),
          );
          if (visible.length === 0) return null;
          return (
            <div key={`group-${gi}`} className="side-group">
              {group.caption ? <p className="side-cap">{group.caption}</p> : null}
              {visible.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="side-link"
                  aria-current={isCurrent(item.href) ? "page" : undefined}
                  onClick={onClose}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="side-foot">
        <span className="live-dot" aria-hidden="true" /> بارمان CRM
      </div>
    </aside>
  );
}
