import { describe, expect, it } from "vitest";
import { isIncompleteCheque } from "./cheque";
describe("اطلاعات چک", () => {
  const cheque = { sayad: "1234567890123456", bank: "بانک", owner: "بارمان", due: "1405/09/01" };
  it("ارقام فارسی را بدون حذف کاراکتر نامعتبر بررسی می‌کند", () => {
    expect(isIncompleteCheque({ ...cheque, sayad: "۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶" })).toBe(false);
    expect(isIncompleteCheque({ ...cheque, sayad: "x1234567890123456" })).toBe(true);
  });
  it("نام بانک، دارنده و تاریخ لازم است", () => {
    for (const key of ["bank", "owner", "due"] as const) expect(isIncompleteCheque({ ...cheque, [key]: "" })).toBe(true);
  });
});
