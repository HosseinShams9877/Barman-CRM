import { describe, expect, it } from "vitest";
import { APP_DIR, APP_LANG, APP_LOCALE, htmlAttrs, isRtlLocale } from "./locale";

describe("localization", () => {
  it("برنامه فارسی و RTL است", () => {
    expect(APP_LANG).toBe("fa");
    expect(APP_DIR).toBe("rtl");
    expect(APP_LOCALE).toBe("fa-IR");
  });

  it("htmlAttrs/lang و dir درست هستند", () => {
    expect(htmlAttrs()).toEqual({ lang: "fa", dir: "rtl" });
  });

  it("تشخیص زبان RTL", () => {
    expect(isRtlLocale("fa")).toBe(true);
    expect(isRtlLocale("FA")).toBe(true);
    expect(isRtlLocale("ar")).toBe(true);
    expect(isRtlLocale("en")).toBe(false);
    expect(isRtlLocale("")).toBe(false);
  });
});
