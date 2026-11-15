import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * ترکیب classNameها و حل تعارض کلاس‌های Tailwind.
 * تنها راه مجاز ساخت className در کامپوننتها (CD-16).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
