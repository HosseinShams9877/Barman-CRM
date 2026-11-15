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
};

const SIZE_CLASS: Readonly<Record<DialogSize, string>> = {
  sm: "dialog-sm",
  md: "",
  lg: "dialog-lg",
};

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
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        className={cn("dialog", SIZE_CLASS[size])}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dialog-header">
          <div className="stack gap-1">
            <h2 className="dialog-title">{title}</h2>
            {description ? <p className="text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm dialog-close"
            aria-label="بستن"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer ? <footer className="dialog-footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
