"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@components/ui/Icon";
import { LoadingState } from "@components/feedback";
import { ROLE_LABELS } from "@core/permissions";
import { useLogoutMutation, useMeQuery } from "@modules/auth/hooks/useAuth";

export type NavbarProps = {
  onOpenSidebar: () => void;
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
  "/admin/users": "تعاریف و تنظیمات — کاربران",
  "/admin/settings": "تعاریف و تنظیمات — تنظیمات عمومی",
};

function pageTitle(pathname: string): string {
  if (TITLES[pathname] !== undefined) return TITLES[pathname]!;
  if (pathname.startsWith("/admin")) return "تعاریف و تنظیمات";
  if (pathname.startsWith("/orders/")) return "پرونده سفارش";
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
  return known.map((r) => ROLE_LABELS[r]).join("، ");
}

/**
 * نوار بالا — مطابق Demo .topbar (core.js:501-510):
 * دکمه منو (_below md)، عنوان صفحه + مسیر، جستجو، چیپ کاربر با منوی
 * خروج. نقش کاربر واقعی از /api/auth/me خوانده می‌شود (PHASE_02 §۱۰).
 */
export function Navbar({ onOpenSidebar }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useMeQuery();
  const logout = useLogoutMutation();
  const [userPopOpen, setUserPopOpen] = useState(false);

  // بستن منوی کاربر با کلیک بیرون یا Escape — مثل toggle() در Demo shell.
  useEffect(() => {
    if (!userPopOpen) return;
    const onDocumentClick = (event: MouseEvent): void => {
      if (!(event.target as HTMLElement).closest(".rel")) setUserPopOpen(false);
    };
    const onEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setUserPopOpen(false);
    };
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [userPopOpen]);

  const user = me.data ?? null;
  const title = pageTitle(pathname);

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
        aria-expanded="false"
        onClick={onOpenSidebar}
      >
        <Icon name="menu" />
      </button>

      <div className="page-title">
        <h1>{title}</h1>
        <nav className="crumbs" aria-label="مسیر">
          <span>بارمان</span>
          <span>{title}</span>
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
        {me.isLoading ? (
          <LoadingState label="بارگذاری نشست" className="navbar-loading" />
        ) : user ? (
          <div className="rel">
            <button
              type="button"
              className="user-chip"
              aria-expanded={userPopOpen}
              aria-controls="role-pop"
              onClick={() => setUserPopOpen((open) => !open)}
            >
              <span className="avatar lg" aria-hidden="true">
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
