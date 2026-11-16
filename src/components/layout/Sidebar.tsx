"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { useUrlHash } from "@core/utils/useUrlHash";
import type { Permission, Role } from "@core/permissions";
import { Icon, type IconName } from "@components/ui/Icon";

export type SidebarProps = { open: boolean; onClose: () => void };
type NavItem = { label: string; href: string; icon: IconName; permission?: Permission };
type NavGroup = { caption?: string; items: readonly NavItem[] };
const item = (label: string, href: string, icon: IconName, permission?: Permission): NavItem => ({ label, href, icon, permission });
const home = item("میز کار", "/", "grid");
const newOrder = item("پیش‌فاکتور جدید", "/orders?new=1", "filePlus", "orders.create");
const products = item("محصولات", "/admin/products", "box", "catalog.products.read");
const customers = item("مشتریان", "/admin/customers", "users", "customers.view");
const maturities: NavGroup = { caption: "سررسیدها و بدهکاری‌ها", items: [
  item("دریافتنی‌ها", "/finance#rec", "download", "finance.view"),
  item("پرداختنی‌ها", "/finance#pay", "upload", "finance.view"),
] };
const salesInfo: NavGroup = { caption: "اطلاعات", items: [
  item("موجودی محصولات", "/stock", "warehouse", "inventory.view"),
  item("محصولات و قیمت‌ها", "/admin/products", "box", "catalog.products.read"), customers,
] };

/** Demo app/core.js:447–489, with the explicitly deferred task/badge group removed. */
export const NAV_BY_ROLE: Readonly<Record<Role, readonly NavGroup[]>> = {
  management: [
    { items: [home, item("تأیید خریدها", "/buys?status=req", "cart", "purchasing.view")] },
    { caption: "خرید مواد اولیه و کالا", items: [item("خرید جدید", "/buys?new=1", "plus", "purchasing.edit"), item("همه خریدها", "/buys", "list", "purchasing.view")] },
    { caption: "سفارش‌ها", items: [item("مسیر سفارش‌ها", "/orders", "layers", "orders.view"), newOrder] },
    maturities,
    { caption: "تولید و انبار", items: [item("تولید", "/production", "factory", "production.view"), item("موجودی انبارها", "/stock", "warehouse", "inventory.view")] },
    { caption: "گزارش و تعاریف", items: [item("گزارش‌ها", "/reports", "chart", "reports.view"), item("تعاریف و تنظیمات", "/admin", "gear", "catalog.products.read")] },
  ],
  admin: [{ caption: "تعاریف", items: [
    products,
    item("مواد اولیه", "/admin/materials", "flask", "catalog.materials.read"),
    item("فرمول تولید", "/admin/bom", "clipboard", "catalog.bom.read"), customers,
    item("تأمین‌کننده‌ها و نمایندگی‌ها", "/admin/suppliers", "store", "catalog.suppliers.read"),
    item("کاربران و دسترسی‌ها", "/admin/users", "user", "admin.users"),
    item("فهرست‌ها (منبع سرنخ، سمت‌ها …)", "/admin/lists", "list", "admin.lists"),
    item("ستون‌های بورد سرنخ", "/admin/leadcols", "grid", "admin.lists"),
    item("تنظیمات عمومی", "/admin/settings", "gear", "admin.settings"),
  ] }],
  sales: [
    { items: [home, item("پیگیری سرنخ‌ها", "/leads", "phone", "leads.view")] },
    { caption: "فروش", items: [newOrder, item("سفارش‌های من", "/orders", "layers", "orders.view")] }, salesInfo,
  ],
  salesManager: [
    { items: [home, item("پیگیری سرنخ‌ها", "/leads", "phone", "leads.view")] },
    { caption: "فروش", items: [newOrder, item("مسیر سفارش‌ها", "/orders", "layers", "orders.view"), item("گزارش سرنخ و فروش", "/reports#leads", "chart", "reports.view")] }, salesInfo,
  ],
  finance: [
    { items: [home, item("پرداخت خریدها", "/buys?status=ok", "cart", "purchasing.view")] }, maturities,
    { caption: "سفارش‌ها", items: [item("مسیر سفارش‌ها", "/orders", "layers", "orders.view")] },
    { caption: "گزارش و تعاریف", items: [item("گزارش‌ها", "/reports", "chart", "reports.view"), customers, item("تأمین‌کننده‌ها", "/admin/suppliers", "store", "catalog.suppliers.read")] },
  ],
  production: [
    { items: [item("میز کار", "/production", "grid", "production.view"), item("ورود مواد اولیه", "/buys#in", "download", "purchasing.view")] },
    { caption: "تولید و مواد", items: [
      item("تولید برای انبار", "/production#stock", "factory", "production.view"),
      item("موجودی مواد اولیه", "/stock#raw", "flask", "inventory.view"),
      item("خروج و مصرف مواد", "/production#use", "upload", "production.view"),
      item("سوابق تولید", "/production#hist", "chart", "production.view"),
    ] },
    { caption: "تعاریف", items: [item("فرمول‌های تولید", "/admin/bom", "clipboard", "catalog.bom.read"), item("مواد اولیه", "/admin/materials", "flask", "catalog.materials.read"), products] },
  ],
  depot: [
    { items: [home, item("ورود محصولات نمایندگی", "/buys#in", "download", "purchasing.view")] },
    { caption: "انبار دپو", items: [item("موجودی دپو", "/stock#depot", "warehouse", "inventory.view"), item("خروج دستی کالا", "/stock#out", "upload", "inventory.view"), item("گردش انبار", "/stock#moves", "list", "inventory.view")] },
    { caption: "تعاریف", items: [products] },
  ],
};

export function Sidebar({ open, onClose }: SidebarProps) {
  const me = useMeQuery();
  const pathname = usePathname();
  const search = useSearchParams();
  const hash = useUrlHash();
  const permissions = new Set(me.data?.permissions ?? []);
  const role = me.data?.roles[0];
  const groups = role ? NAV_BY_ROLE[role] : [];
  const isCurrent = (href: string): boolean => {
    const url = new URL(href, "http://barman.local");
    const base = url.pathname === "/admin" && pathname === "/admin/products" ? "/admin/products" : url.pathname;
    const currentPath = pathname === "/admin" && role === "admin" ? "/admin/products" : pathname;
    if (currentPath !== base) return false;
    if (url.hash) return hash === url.hash;
    if (url.search) return [...url.searchParams].every(([key, value]) => search.get(key) === value) && !hash;
    return !hash && !search.has("new") && !search.has("status");
  };
  return (
    <aside id="app-sidebar" className="sidebar" data-open={open ? "true" : "false"} aria-label="منوی پنل">
      <Link className="side-brand" href={role === "admin" ? "/admin" : role === "production" ? "/production" : "/"} title="صفحه اصلی">
        <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <path d="M6 10h36v28H6z" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
          <path d="M6 20c6-6 12 6 18 0s12 6 18 0M6 29c6-6 12 6 18 0s12 6 18 0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
        <span><b>بارمان</b><small>BARMAN 3D WORKS</small></span>
      </Link>
      <button type="button" className="sidebar-close" aria-label="بستن منو" onClick={onClose}><Icon name="x" size="icon-sm" /></button>
      <nav className="side-nav" aria-label="صفحات">
        {groups.map((group, index) => {
          const visible = group.items.filter((nav) => !nav.permission || permissions.has(nav.permission));
          return visible.length ? <div key={group.caption ?? index} className="side-group">
            {group.caption ? <p className="side-cap">{group.caption}</p> : null}
            {visible.map((nav) => <Link key={nav.href} href={nav.href} className="side-link" aria-current={isCurrent(nav.href) ? "page" : undefined} onClick={onClose}>
              <Icon name={nav.icon} /><span>{nav.label}</span>
            </Link>)}
          </div> : null;
        })}
      </nav>
      <div className="side-foot"><span className="live-dot" aria-hidden="true" /> متصل به سرور — تغییرات پس از ذخیره به‌روز می‌شود.</div>
    </aside>
  );
}
