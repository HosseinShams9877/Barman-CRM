"use client";

import { useState, type ReactNode } from "react";
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
  const close = () => setDrawerOpen(false);

  return (
    <div className="app-shell">
      <Navbar onOpenSidebar={() => setDrawerOpen(true)} />
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
