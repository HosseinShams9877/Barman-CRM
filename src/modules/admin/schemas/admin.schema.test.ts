/**
 * آزمون اسکیماهای ادمین — تبدیل‌های Zod (PHASE_07 §۱۲ / CD-40).
 */
import { describe, expect, it } from "vitest";
import { bomSaveSchema, materialSaveSchema, productSaveSchema } from "./catalog.schema";
import { listsSaveSchema, settingsSaveSchema, userCreateSchema } from "./admin.schema";
import { faErrorMap } from "@core/validation";
import { linesToList, LIST_KEYS } from "../constants/lists";

describe("productSaveSchema", () => {
  it("کد uppercase و رنگ‌ها با ویرگول فارسی/انگلیسی جدا می‌شوند (admin.js:41/46)", () => {
    const out = productSaveSchema.parse({
      code: "br-139",
      name: "پنل",
      line: "prod",
      unit: "مترمربع",
      price: 100000,
      colors: "سفید، کرم, نود",
    });
    expect(out.code).toBe("BR-139");
    expect(out.colors).toEqual(["سفید", "کرم", "نود"]);
  });

  it("پیش‌فرض‌ها: days = ۲، active = true، category خالی (admin.js:32)", () => {
    const out = productSaveSchema.parse({
      code: "BR-1",
      name: "پنل",
      line: "prod",
      unit: "مترمربع",
      price: 100,
    });
    expect(out.days).toBe(2);
    expect(out.active).toBe(true);
    expect(out.category).toBe("");
  });

  it("قیمت نامعتبر → خطای فارسی (faErrorMap / CD-40)", () => {
    const res = productSaveSchema.safeParse(
      { code: "BR-1", name: "پنل", line: "prod", unit: "مترمربع", price: -5 },
      { error: faErrorMap as never },
    );
    expect(res.success).toBe(false);
  });
});

describe("materialSaveSchema", () => {
  it("قیمت صفر مجاز است (admin.js:64 — فقط کد و نام اجباری)", () => {
    const out = materialSaveSchema.parse({ code: "rm-1", name: "رزین", unit: "کیلو", price: 0 });
    expect(out.code).toBe("RM-1");
    expect(out.price).toBe(0);
    expect(out.min).toBe(0);
  });
});

describe("bomSaveSchema", () => {
  it("مقدار صفر رد می‌شود (admin.js:173: فیلتر q > 0)", () => {
    const res = bomSaveSchema.safeParse({
      items: [{ materialId: "m1", qty: 0 }],
    });
    expect(res.success).toBe(false);
  });
});

describe("userCreateSchema", () => {
  it("رمز کوتاه رد می‌شود (CD-17)", () => {
    const res = userCreateSchema.safeParse({
      name: "نگار",
      role: "sales",
      password: "123",
    });
    expect(res.success).toBe(false);
  });

  it("نقش نامعتبر رد می‌شود", () => {
    const res = userCreateSchema.safeParse({ name: "x", role: "boss", password: "secret123" });
    expect(res.success).toBe(false);
  });
});

describe("listsSaveSchema", () => {
  it("کلید ناشناخته رد می‌شود — فقط ۷ کلید (admin.js:131)", () => {
    const res = listsSaveSchema.safeParse({ lists: { unknown: ["x"] } });
    expect(res.success).toBe(false);
  });

  it("۷ کلید معتبر پذیرفته می‌شوند", () => {
    const input = Object.fromEntries(LIST_KEYS.map((k) => [k, ["مورد۱", "مورد۲"]]));
    const out = listsSaveSchema.parse({ lists: input });
    expect(Object.keys(out.lists)).toHaveLength(7);
  });
});

describe("settingsSaveSchema", () => {
  it("validDays صفر → ۳ (admin.js:177)", () => {
    const out = settingsSaveSchema.parse({
      vat: 10,
      validDays: 0,
      company: { name: "بارمان" },
    });
    expect(out.validDays).toBe(3);
  });

  it("vat خارج از بازه رد می‌شود", () => {
    const res = settingsSaveSchema.safeParse({ vat: 150, validDays: 3, company: {} });
    expect(res.success).toBe(false);
  });
});

describe("linesToList — تقسیم textarea (admin.js:174)", () => {
  it("هر خط یک مورد — trim و حذف خالی", () => {
    expect(linesToList("تماس مستقیم\n\nاینستاگرام \n  \n")).toEqual([
      "تماس مستقیم",
      "اینستاگرام",
    ]);
  });
});
