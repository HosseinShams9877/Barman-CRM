"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { cn } from "@core/utils";

export type DialogSize = "sm" | "md" | "lg";

export type DialogProps = {
  open: boolean;
  title: string;
  /** توضیح کوتاه زیر عنوان (اختیاری). */
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** مجموعه دکمه‌های پایین (راست‌چین). */
  footer?: ReactNode;
  size?: DialogSize;
  embedded?: boolean;
};

const SIZE_CLASS: Readonly<Record<DialogSize, string>> = {
  sm: "dialog-sm",
  md: "",
  lg: "dialog-lg",
};
let activeModalCount = 0;
let originalBodyOverflow = "";

/**
 * دیالوگ مدال — پاشنه پایه برای Quick View، «چی شد؟» و فرم حساب.
 *
 * - Esc و کلیک روی پس‌زمینه آن را می‌بندد.
 * - وقتی باز است، اسکرول body قفل می‌شود.
 * - focus به پنل برمی‌گردد تا کیبورد در دسترس باشد.
 * - همه رنگ‌ها از توکن معنایی (CD-03) — هیچ رنگ خامی.
 */
export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "md",
  embedded = false,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || embedded) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (activeModalCount === 0) originalBodyOverflow = document.body.style.overflow;
    activeModalCount += 1;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (!panel || dialogs[dialogs.length - 1] !== panel) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const focusable = [...panel.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex="0"]')]
          .filter((el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first) { e.preventDefault(); panel.focus(); }
        else if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || document.activeElement === panel)) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      activeModalCount -= 1;
      if (activeModalCount === 0) document.body.style.overflow = originalBodyOverflow;
      window.removeEventListener("keydown", onKey);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open, embedded]);

  if (!open) return null;

  return (
    <div className={embedded ? "card move-entry" : "dialog-backdrop"} onClick={embedded ? undefined : onClose}>
      <div
        ref={panelRef}
        className={embedded ? "stack" : cn("dialog", SIZE_CLASS[size])}
        role={embedded ? undefined : "dialog"}
        aria-modal={embedded ? undefined : "true"}
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dialog-header">
          <div className="stack gap-1">
            <h2 className="dialog-title">{title}</h2>
            {description ? <p className="text-muted">{description}</p> : null}
          </div>
          {!embedded ? <button
            type="button"
            className="btn btn-ghost btn-sm dialog-close"
            aria-label="بستن"
            onClick={onClose}
          >
            ×
          </button> : null}
        </header>
        <div className="dialog-body">{children}</div>
        {footer ? <footer className="dialog-footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
