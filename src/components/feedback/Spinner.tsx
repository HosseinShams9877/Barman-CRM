import { cn } from "@core/utils";

export type SpinnerProps = {
  className?: string;
  label?: string;
};

/**
 * نشانگر بارگذاری — فقط `currentColor` و عرض/ارتفاع بر اساس توکن فاصله.
 * هیچ رنگ hardcodedی وجود ندارد (D-05).
 */
export function Spinner({ className, label = "در حال بارگذاری…" }: SpinnerProps) {
  return (
    <svg
      className={cn("spinner", className)}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      role="status"
      aria-label={label}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="9" opacity={0.25} />
      <path d="M21 12a9 9 0 0 1-9 9" />
    </svg>
  );
}
