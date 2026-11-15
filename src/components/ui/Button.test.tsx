import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("برچسب فرزند را نمایش می‌دهد", () => {
    render(<Button>ذخیره</Button>);
    expect(screen.getByRole("button", { name: "ذخیره" })).toBeInTheDocument();
  });

  it("نوع پیش‌فرض button است (نه submit)", () => {
    render(<Button>ذخیره</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("کلاس واریانت را می‌گیرد", () => {
    render(<Button variant="danger">حذف</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn", "btn-danger");
  });

  it("هنگام isLoading غیرفعال و busy می‌شود", () => {
    render(<Button isLoading>ذخیره</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });
});
