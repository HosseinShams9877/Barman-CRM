/**
 * آزمون مسیر چاپ سفارش — PHASE_08 Part A (Secure print HTTP status).
 *
 * پوشش:
 *  - ۴۰۱: توکن غایب / نامعتبر / منقضی
 *  - ۴۰۳: توکن متعلق به سفارش دیگر (cross-order)
 *  - ۴۰۴: سفارش وجود ندارد
 *  - ۲۰۰: توکن معتبر → HTML فاکتور با محتوای سفارش
 *  - R-32: نسخه noMoney فاقد مبالغ
 *  - بدون نشت داده: هیچ داده‌ای در پاسخ خطا ظاهر نمی‌شود
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@modules/orders/services/print.service", () => ({
  getPrintOrder: vi.fn(),
}));

vi.mock("@core/database/client", () => ({
  prisma: {},
}));

import { getPrintOrder } from "@modules/orders/services/print.service";
import { unauthorized, forbidden, notFound } from "@core/errors";
import { GET } from "./route";

const mocked = vi.mocked(getPrintOrder);

function reqOf(id: string, token: string | null): Request {
  const url = `http://x/print/orders/${id}${token !== null ? `?t=${token}` : ""}`;
  return new Request(url);
}

const CTX = { params: Promise.resolve({ id: "PF-1201" }) };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /print/orders/[id] — کدهای وضعیت HTTP (R-01)", () => {
  it("۴۰۱: بدون توکن", async () => {
    // سرویس واقعی توکن غایب را unauthorized می‌کند (verifyPrintToken → null)
    mocked.mockRejectedValue(unauthorized("توکن چاپ معتبر نیست یا منقضی شده است."));
    const res = await GET(reqOf("PF-1201", null), CTX);
    expect(res.status).toBe(401);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("لینک چاپ معتبر نیست");
    // بدون نشت داده
    expect(html).not.toContain("PF-1201</span>");
  });

  it("۴۰۱: توکن نامعتبر/منقضی", async () => {
    mocked.mockRejectedValue(unauthorized("توکن چاپ معتبر نیست یا منقضی شده است."));
    const res = await GET(reqOf("PF-1201", "invalid.token"), CTX);
    expect(res.status).toBe(401);
  });

  it("۴۰۳: توکن سفارش دیگر (cross-order)", async () => {
    mocked.mockRejectedValue(forbidden("توکن چاپ مربوط به این سفارش نیست."));
    const res = await GET(reqOf("PF-1201", "valid.but.other"), CTX);
    expect(res.status).toBe(403);
    const html = await res.text();
    expect(html).toContain("سفارش دیگری");
  });

  it("۴۰۴: سفارش ناموجود", async () => {
    mocked.mockRejectedValue(notFound("سفارش مورد نظر پیدا نشد."));
    const res = await GET(reqOf("PF-9999", "some.token"), CTX);
    expect(res.status).toBe(404);
  });

  it("۲۰۰: توکن معتبر → فاکتور HTML با محتوای سفارش", async () => {
    mocked.mockResolvedValue({
      id: "PF-1201",
      stageKey: "deliver",
      accountName: "شرکت نمونه",
      company: {
        name: "بارمان",
        en: "",
        tagline: "تولیدکننده",
        phone: "۰۲۱",
        address: "تهران",
        bale: "",
      },
      vatRate: 10,
      validDays: 3,
      note: "",
      items: [
        {
          id: "i1",
          productName: "پنل سه‌بعدی",
          productId: "p1",
          qty: 10,
          price: 100000,
          discount: 0,
          color: "سفید",
        },
      ],
      payments: [],
      cheques: [],
      calc: { sub: 1000000, disc: 0, extra: 0, vat: 100000, total: 1100000 },
    } as never);

    const res = await GET(reqOf("PF-1201", "valid.token"), CTX);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("<html");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("بارمان");
    expect(html).toContain("پنل سه‌بعدی");
    expect(html).toContain("۱٬۱۰۰٬۰۰۰");
    // دکمه چاپ بدون hydration
    expect(html).toContain("window.print()");
  });

  it("R-32: نسخه بدون مبلغ فاقد ستون‌های پولی", async () => {
    mocked.mockResolvedValue({
      id: "PF-1201",
      stageKey: "deliver",
      accountName: "شرکت نمونه",
      company: {
        name: "بارمان",
        en: "",
        tagline: "",
        phone: "",
        address: "",
        bale: "",
      },
      vatRate: 10,
      validDays: 3,
      note: "",
      items: [
        {
          id: "i1",
          productName: "پنل سه‌بعدی",
          productId: "p1",
          qty: 10,
          price: 100000,
          discount: 0,
          color: "سفید",
        },
      ],
      payments: [],
      cheques: [],
    } as never);

    const res = await GET(reqOf("PF-1201", "valid.token"), CTX);
    const html = await res.text();
    expect(html).toContain("برای نقش شما مبالغ نمایش داده نمی‌شود");
    expect(html).not.toContain("مبلغ نهایی");
    expect(html).not.toContain("۱٬۱۰۰٬۰۰۰");
  });

  it("۵۰۰: خطای غیرمنتظره با پیام فارسی", async () => {
    mocked.mockRejectedValue(new Error("boom"));
    const res = await GET(reqOf("PF-1201", "valid.token"), CTX);
    expect(res.status).toBe(500);
    const html = await res.text();
    expect(html).toContain("خطای غیرمنتظره");
  });
});
