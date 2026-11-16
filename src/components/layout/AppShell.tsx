"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";

export type AppShellProps = {
  children: ReactNode;
};

/**
 * پوسته برنامه: نوار بالا + ستون کناری (کشویی زیر md) + محتوای اصلی.
 * وضعیت باز/بسته‌ی کشو در همین کامپوننت نگه‌داری می‌شود.
 * نشست در Navbar/Sidebar از طریق useMeQuery خوانده می‌شود (CD-09).
 */
export function AppShell({ children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setDrawerOpen(false);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="app-shell">
      <Navbar sidebarOpen={drawerOpen} onOpenSidebar={() => setDrawerOpen((open) => !open)} />
      <div className="app-body">
        <Sidebar open={drawerOpen} onClose={close} />
        {drawerOpen ? (
          <button
            type="button"
            className="sidebar-backdrop"
            aria-label="بستن منو"
            onClick={close}
          />
        ) : null}
        <main className="main-content" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
