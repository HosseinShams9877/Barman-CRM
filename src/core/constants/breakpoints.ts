/**
 * نقاط شکست مجاز — دقیقاً ۵ عدد (CD-12 / A-1.4).
 * xs <480، sm 480–767، md 768–1023، lg 1024–1279، xl ≥1280.
 */

export type BreakpointName = "xs" | "sm" | "md" | "lg" | "xl";

/** حداقل عرض هر نقظه شکست (xs حداقلی ندارد). */
export const BREAKPOINT_MIN_WIDTH: Readonly<Record<Exclude<BreakpointName, "xs">, number>> = {
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
};

export const BREAKPOINT_NAMES: readonly BreakpointName[] = ["xs", "sm", "md", "lg", "xl"];

/**
 * نام نقظه شکست معادل یک عرض پیکسلی.
 * عرض‌های آزمایش واقعی این محیط: ۵۰۰ / ۷۶۸ / ۱۰۲۴ / ۱۲۸۰ / ۱۴۴۰.
 */
export function breakpointForWidth(width: number): BreakpointName {
  if (width >= 1280) return "xl";
  if (width >= 1024) return "lg";
  if (width >= 768) return "md";
  if (width >= 480) return "sm";
  return "xs";
}

/** عرض‌های آزمایش واقعی پذیرفته‌شده (CD-12). */
export const TEST_VIEWPORT_WIDTHS = [500, 768, 1024, 1280, 1440] as const;
