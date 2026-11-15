import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "@components/feedback";
import { cn } from "@core/utils";

export type ButtonVariant = "primary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leadingIcon?: ReactNode;
};

const SIZE_CLASS: Readonly<Record<ButtonSize, string>> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

/**
 * دکمه — تنها کامپوننت دکمه برنامه.
 * واریانت‌ها فقط از کلاس‌های semantic در utilities.css استفاده می‌کنند (D-05).
 */
export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  leadingIcon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn("btn", `btn-${variant}`, SIZE_CLASS[size], className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...rest}
    >
      {isLoading ? <Spinner aria-hidden="true" /> : leadingIcon}
      {children}
    </button>
  );
}
