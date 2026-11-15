import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("کلاس‌ها را ترکیب می‌کند", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("مقادیر falsy را رها می‌کند", () => {
    expect(cn("a", false, null, undefined, "", 0, "b")).toBe("a b");
  });

  it("آرایه و شیء شرطی را می‌پذیرد", () => {
    expect(cn(["a", { b: true, c: false }])).toBe("a b");
  });

  it("تعارض Tailwind را با کلاس آخر برنده می‌کند", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
