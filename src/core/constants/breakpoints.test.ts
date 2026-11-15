import { describe, expect, it } from "vitest";
import {
  BREAKPOINT_MIN_WIDTH,
  BREAKPOINT_NAMES,
  TEST_VIEWPORT_WIDTHS,
  breakpointForWidth,
} from "./breakpoints";

describe("breakpoints (CD-12)", () => {
  it("دقیقاً ۵ نقظه شکست وجود دارد", () => {
    expect(BREAKPOINT_NAMES).toEqual(["xs", "sm", "md", "lg", "xl"]);
    expect(Object.keys(BREAKPOINT_MIN_WIDTH)).toHaveLength(4);
  });

  it("عرض‌های آزمایش واقعی به نقظه شکست درست نگاشته می‌شوند", () => {
    // ۵۰۰ و ۷۶۸ و ۱۰۲۴ و ۱۲۸۰ و ۱۴۴۰ (عرض‌های مجاز این محیط)
    expect(breakpointForWidth(500)).toBe("sm");
    expect(breakpointForWidth(768)).toBe("md");
    expect(breakpointForWidth(1024)).toBe("lg");
    expect(breakpointForWidth(1280)).toBe("xl");
    expect(breakpointForWidth(1440)).toBe("xl");
  });

  it("کرانه هر بازه رعایت می‌شود", () => {
    expect(breakpointForWidth(479)).toBe("xs");
    expect(breakpointForWidth(480)).toBe("sm");
    expect(breakpointForWidth(767)).toBe("sm");
    expect(breakpointForWidth(1023)).toBe("md");
    expect(breakpointForWidth(1279)).toBe("lg");
  });

  it("TEST_VIEWPORT_WIDTHS فقط عرض‌های مجاز را دارد", () => {
    expect([...TEST_VIEWPORT_WIDTHS]).toEqual([500, 768, 1024, 1280, 1440]);
  });
});
