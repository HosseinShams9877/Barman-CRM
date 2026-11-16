"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@components/ui/Icon";
import { LoadingState } from "@components/feedback";
import { ROLE_LABELS } from "@core/permissions";
import { useLogoutMutation, useMeQuery } from "@modules/auth/hooks/useAuth";
import { useSummaryQuery } from "@modules/home/hooks/useSummary";

export type NavbarProps = {
  onOpenSidebar: () => void;
  sidebarOpen?: boolean;
};

/** عنوان صفحه از مسیر — معادل opt.title در Demo shell (core.js:501). */
const TITLES: Readonly<Record<string, string>> = {
  "/": "میز کار",
  "/leads": "پیگیری سرنخ‌ها",
  "/customers": "مشتریان",
  "/orders": "مسیر سفارش‌ها",
  "/production": "تولید",
  "/stock": "موجودی انبارها",
  "/buys": "خرید و تأمین",
  "/finance": "سررسیدها و بدهکاری‌ها",
  "/reports": "گزارش‌ها",
  "/admin": "تعاریف و تنظیمات",
  "/admin/users": "تعاریف و تنظیمات",
  "/admin/settings": "تعاریف و تنظیمات",
};

function pageTitle(pathname: string): string {
  if (TITLES[pathname] !== undefined) return TITLES[pathname]!;
  if (pathname.startsWith("/admin")) return "تعاریف و تنظیمات";
  if (pathname.startsWith("/orders/")) return "پرونده " + pathname.split("/")[2];
  if (pathname.startsWith("/production/")) return "پرونده کار تولید";
  if (pathname.startsWith("/buys/")) return "پرونده خرید";
  return "بارمان";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "");
}

function roleLabel(roles: readonly string[]): string {
  const known = roles.filter((r) => r in ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>;
  if (known.length === 0) return "نقش: —";
  return known.map((r) => r === "production" ? "مدیر تولید" : r === "depot" ? "انبار دپو" : ROLE_LABELS[r]).join("، ");
}

/**
 * نوار بالا — مطابق Demo .topbar (core.js:501-510):
 * دکمه منو، عنوان صفحه + مسیر، جستجو، چیپ کاربر با منوی
 * خروج. نقش کاربر واقعی از /api/auth/me خوانده می‌شود (PHASE_02 §۱۰).
 */
export function Navbar({ onOpenSidebar, sidebarOpen = false }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useMeQuery();
  const logout = useLogoutMutation();
  const [userPopOpen, setUserPopOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const summary = useSummaryQuery(Boolean(me.data));
  const queues = summary.data?.workspace?.queues.filter((q) => q.items.length > 0 && !q.task.info) ?? [];

  // بستن منوی کاربر با کلیک بیرون یا Escape — مثل toggle() در Demo shell.
  useEffect(() => {
    if (!userPopOpen && !bellOpen) return;
    const onDocumentClick = (event: MouseEvent): void => {
      if (!(event.target as HTMLElement).closest(".rel")) { setUserPopOpen(false); setBellOpen(false); }
    };
    const onEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") { setUserPopOpen(false); setBellOpen(false); }
    };
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [userPopOpen, bellOpen]);

  const user = me.data ?? null;
  const title = pathname === "/orders" && user?.roles[0] === "sales" ? "سفارش‌های من" : pageTitle(pathname);
  const crumb = pathname.startsWith("/admin") ? "تعاریف" : pathname.startsWith("/stock") ? "انبار" : pathname.startsWith("/buys") ? "خرید" : title;

  function handleSearch(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const q = new FormData(event.currentTarget).get("q");
    const value = typeof q === "string" ? q.trim() : "";
    if (value.length === 0) return;
    // جستجوی سراسری — هدایت به سفارش‌ها (core.js:524)
    router.push(`/orders?q=${encodeURIComponent(value)}`);
  }

  function handleLogout(): void {
    logout.mutate(undefined, {
      onSuccess: () => {
        router.replace("/login");
      },
    });
  }

  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-btn menu-btn"
        aria-label="باز کردن منو"
        aria-expanded={sidebarOpen}
        aria-controls="app-sidebar"
        onClick={onOpenSidebar}
      >
        <Icon name="menu" />
      </button>

      <div className="page-title">
        <h1>{title}</h1>
        <nav className="crumbs" aria-label="مسیر">
          {pathname !== "/" && !user?.roles.includes("admin") ? <Link href={user?.roles[0] === "production" ? "/production" : "/"}>میز کار</Link> : null}
          {pathname.startsWith("/orders/") ? <><Link href="/orders">مسیر سفارش‌ها</Link><span aria-current="page">{pathname.split("/")[2]}</span></> : <span aria-current="page">{crumb}</span>}
        </nav>
      </div>

      <form className="top-search" role="search" onSubmit={handleSearch}>
        <label className="visually-hidden" htmlFor="top-q">
          جستجو
        </label>
        <input
          id="top-q"
          name="q"
          type="search"
          placeholder="شماره پیش‌فاکتور، نام مشتری یا شماره تلفن …"
          autoComplete="off"
        />
        <Icon name="search" />
      </form>

      <div className="top-tools">
        <div className="rel">
          <button className="icon-btn" type="button" aria-label="اعلان‌ها" aria-expanded={bellOpen} aria-controls="bell-pop" onClick={() => { setUserPopOpen(false); setBellOpen((o) => !o); }}><Icon name="bell" />{queues.length ? <span className="notification-dot" /> : null}</button>
          {bellOpen ? <div id="bell-pop" className="pop" role="region" aria-label="اعلان‌ها"><h3>اعلان‌ها</h3>{summary.isError ? <p className="hint">اعلان‌ها دریافت نشد.</p> : queues.length ? queues.map((q) => <Link className="opt" key={q.task.key} href={q.task.stage ? `/orders?stage=${q.task.stage}&status=open` : q.task.key === "late" ? "/orders?overdue=1" : "/orders?incomplete=1"} onClick={() => setBellOpen(false)}><Icon name={q.task.icon} size="icon-sm" /><span><b>{q.task.name}</b><small>{q.items.length} پرونده منتظر شماست</small></span></Link>) : <p className="hint">اعلان تازه‌ای ندارید.</p>}</div> : null}
        </div>
        {me.isLoading ? (
          <LoadingState label="بارگذاری نشست" className="navbar-loading" />
        ) : user ? (
          <div className="rel">
            <button
              type="button"
              className="user-chip"
              aria-expanded={userPopOpen}
              aria-controls="role-pop"
              onClick={() => { setBellOpen(false); setUserPopOpen((open) => !open); }}
            >
              <span className="avatar lg" data-role={user.roles[0]} aria-hidden="true">
                {initials(user.name)}
              </span>
              <span className="txt">
                <b>{user.name}</b>
                <small>{roleLabel(user.roles)}</small>
              </span>
              <Icon name="down" size="icon-sm" />
            </button>
            {userPopOpen ? (
              <div className="pop" id="role-pop" role="menu">
                <h3>
                  {user.name} — {roleLabel(user.roles)}
                </h3>
                <button
                  type="button"
                  className="opt"
                  role="menuitem"
                  onClick={handleLogout}
                  disabled={logout.isPending}
                >
                  <Icon name="logout" size="icon-sm" />
                  <span>
                    <b>خروج</b>
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <Link className="navbar-login-link" href="/login">
            ورود
          </Link>
        )}
      </div>
    </header>
  );
}
