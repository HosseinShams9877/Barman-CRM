"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@core/utils";

export type ToastTone = "info" | "success" | "danger";

export type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  toasts: readonly Toast[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_CLASS: Readonly<Record<ToastTone, string>> = {
  info: "toast-info",
  success: "toast-success",
  danger: "toast-danger",
};

export type ToastProviderProps = {
  children: ReactNode;
  /** مدت نمایش به میلی‌ثانیه — پیش‌فرض ۵ ثانیه. */
  durationMs?: number;
};

export function ToastProvider({ children, durationMs = 5000 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((current) => [...current, { id, message, tone }]);
      setTimeout(() => dismiss(id), durationMs);
    },
    [durationMs, dismiss],
  );

  const value = useMemo<ToastContextValue>(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="region" aria-label="اعلان‌ها" aria-live="polite">
        {value.toasts.map((t) => (
          <div key={t.id} className={cn("toast", TONE_CLASS[t.tone])} role="status">
            <span>{t.message}</span>
            <button
              type="button"
              className="toast-close"
              aria-label="بستن اعلان"
              onClick={() => dismiss(t.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast باید درون ToastProvider استفاده شود.");
  return ctx;
}
