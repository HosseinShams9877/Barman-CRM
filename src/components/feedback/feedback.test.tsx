import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorState, LoadingState } from "./index";

describe("LoadingState", () => {
  it("برچسب پیش‌فرض را با نقش status نمایش می‌دهد", () => {
    render(<LoadingState />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("در حال بارگذاری…")).toBeInTheDocument();
  });

  it("برچسب سفارشی را نشان می‌دهد", () => {
    render(<LoadingState label="بارگذاری نشست" />);
    expect(screen.getByText("بارگذاری نشست")).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("پیام خطا را با نقش alert نمایش می‌دهد", () => {
    render(<ErrorState message="بارگذاری ناموفق بود" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("بارگذاری ناموفق بود")).toBeInTheDocument();
  });

  it("بدون onRetry هیچ دکمه‌ای ندارد", () => {
    render(<ErrorState />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("دکمه تلاش مجدد را نمایش می‌دهد و فراخوانی می‌شود", () => {
    let retried = 0;
    render(<ErrorState message="خطا" onRetry={() => { retried += 1; }} />);
    const btn = screen.getByRole("button", { name: "تلاش مجدد" });
    btn.click();
    expect(retried).toBe(1);
  });

  it("هنگام retrying دکمه غیرفعال می‌شود", () => {
    render(<ErrorState message="خطا" onRetry={() => {}} retrying />);
    expect(screen.getByRole("button", { name: "تلاش مجدد" })).toBeDisabled();
  });
});
