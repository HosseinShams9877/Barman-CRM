"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoadingState } from "@components/feedback";
import { Button } from "@components/ui";
import { ROLE_LABELS } from "@core/permissions";
import { useLogoutMutation, useMeQuery } from "@modules/auth/hooks/useAuth";

export type NavbarProps = {
  onOpenSidebar: () => void;
};

function roleLabel(roles: readonly string[]): string {
  const known = roles.filter((r) => r in ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>;
  if (known.length === 0) return "نقش: —";
  return known.map((r) => ROLE_LABELS[r]).join("، ");
}

/**
 * نوار بالا — نقش کاربر واقعی را از /api/auth/me می‌خواند (PHASE_02 §۱۰).
 * منو بر اساس مجوزها فیلتر می‌شود (پنهان‌سازی در کلاینت فقط UX است — CD-05).
 */
export function Navbar({ onOpenSidebar }: NavbarProps) {
  const router = useRouter();
  const me = useMeQuery();
  const logout = useLogoutMutation();

  const user = me.data ?? null;

  function handleLogout(): void {
    logout.mutate(undefined, {
      onSuccess: () => {
        router.replace("/login");
      },
    });
  }

  return (
    <header className="navbar">
      <button
        type="button"
        className="hamburger"
        aria-label="باز کردن منو"
        aria-expanded="false"
        onClick={onOpenSidebar}
      >
        ☰
      </button>
      <span className="navbar-brand">بارمان</span>

      <span className="navbar-session">
        {me.isLoading ? (
          <LoadingState label="بارگذاری نشست" className="navbar-loading" />
        ) : user ? (
          <>
            <span className="navbar-user">
              <span className="navbar-name">{user.name}</span>
              <span className="navbar-role">{roleLabel(user.roles)}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              isLoading={logout.isPending}
              aria-label="خروج"
            >
              خروج
            </Button>
          </>
        ) : (
          <Link className="navbar-login-link" href="/login">
            ورود
          </Link>
        )}
      </span>
    </header>
  );
}
