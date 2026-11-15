/**
 * سرویس چاپ امن سفارش — جایگزین `customer.html` احراز‌نشده Demo (R-01).
 *
 * معماری (PHASE_04 §۹ — Secure print):
 *  ۱. `POST /api/orders/[id]/print-token` توکن کوتاه‌مدت HMAC صادر می‌کند
 *     که مقید است به `orderId` و کاربر درخواست‌کننده (`sub`).
 *  ۲. مسیر چاپ (`/print/orders/[id]?t=…`) **بدون کوکی** اجرا می‌شود و فقط
 *     داده همان سفارش را برمی‌گرداند — توکن معتبر نباشد → ۴۰۱/۴۰۳.
 *  ۳. TTL قابل پیکربندی با `PRINT_TOKEN_TTL_MS` (پیش‌فرض ۵ دقیقه).
 *
 * مدل تهدید: نشست کاربر جاری برای مسیر چاپ به‌کار گرفته نمی‌شود؛
 * لو رفتن کوکی‌ها دسترسی به چاپ را به توکنی که در ۵ دقیقه منقضی می‌شود
 * محدود می‌کند (R-01).
 *
 * noMoney (R-32): نقش‌های بدون `money.view` نسخه چاپ بدون مبالغ دریافت
 * می‌کنند — فیلتر در سرور، بر اساس نقش‌های داخل توکن.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@core/database/client";
import { forbidden, notFound, unauthorized } from "@core/errors";
import { isNoMoneyRole, rolesHavePermission, type Role } from "@core/permissions";
import { getSettings, type CompanyInfo } from "@modules/settings";
import type { OrderDetail, OrderDetailNoMoney } from "../types/order.types";
import { getOrder } from "./order.service";

/** مدت اعتبار توکن چاپ — ۵ دقیقه (PHASE_04 §۹). */
export const PRINT_TOKEN_TTL_DEFAULT_MS = 5 * 60 * 1000;

/** بالاترین مدت قابل پیکربندی — ۲۴ ساعت. */
const PRINT_TOKEN_TTL_MAX_MS = 24 * 60 * 60 * 1000;

/** نام متغیر محیطی مدت اعتبار توکن چاپ. */
export const PRINT_TOKEN_TTL_ENV = "PRINT_TOKEN_TTL_MS";

/** محموله توکن چاپ — زمان‌ها UTC ms (CD-06). */
export type PrintTokenClaims = {
  /** کاربر درخواست‌کننده چاپ — توکن به این کاربر مقید است. */
  sub: string;
  /** سفارش مقید به توکن — توکن فقط برای همین سفارش معتبر است. */
  oid: string;
  /** نقش‌های کاربر در زمان صدور — برای فیلتر noMoney. */
  roles: Role[];
  iat: number;
  exp: number;
};

/** خروجی چاپ — نسخه کامل و نسخه بدون مبالغ (R-32). */
export type PrintableOrder = OrderDetail & { company: CompanyInfo; vatRate: number };
export type PrintableOrderNoMoney = OrderDetailNoMoney & { company: CompanyInfo; vatRate: number };

function getSecret(): string {
  const s = process.env["AUTH_SECRET"];
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET تنظیم نشده یا کوتاه است (حداقل ۳۲ نویسه).");
  }
  return s;
}

/** مدت اعتبار توکن از متغیر محیطی — مقدار نامعتبر به پیش‌فرض برمی‌گردد. */
export function printTokenTtlMs(): number {
  const raw = process.env[PRINT_TOKEN_TTL_ENV];
  if (!raw) return PRINT_TOKEN_TTL_DEFAULT_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > PRINT_TOKEN_TTL_MAX_MS) {
    return PRINT_TOKEN_TTL_DEFAULT_MS;
  }
  return n;
}

const b64 = (s: string): string => Buffer.from(s, "utf8").toString("base64url");

/**
 * صدور توکن چاپ برای یک سفارش.
 *
 * @throws forbidden اگر نقش‌ها مجوز `orders.view` نداشته باشند.
 */
export function issuePrintToken(orderId: string, actor: { userId: string; roles: Role[] }): string {
  if (!rolesHavePermission(actor.roles, "orders.view")) {
    throw forbidden("شما مجوز چاپ سفارش را ندارید.");
  }
  const iat = Date.now();
  const claims: PrintTokenClaims = {
    sub: actor.userId,
    oid: orderId,
    roles: actor.roles,
    iat,
    exp: iat + printTokenTtlMs(),
  };
  const encoded = b64(JSON.stringify(claims));
  const signature = createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

/**
 * تأیید توکن چاپ — امضا و انقضا.
 *
 * `null` یعنی نامعتبر (منقضی یا دستکاری‌شده). مقید بودن توکن به سفارش در
 * `getPrintOrder` بررسی می‌شود تا تمایز ۴۰۱/۴۰۳ به‌درستی انجام شود.
 */
export function verifyPrintToken(token: string | null | undefined): PrintTokenClaims | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const encoded = token.slice(0, i);
  const signature = token.slice(i + 1);
  try {
    const expected = createHmac("sha256", getSecret()).update(encoded).digest("base64url");
    const a = Buffer.from(signature, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let o: Partial<PrintTokenClaims>;
  try {
    o = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof o?.sub !== "string" || !o.sub) return null;
  if (typeof o?.oid !== "string" || !o.oid) return null;
  if (!Array.isArray(o?.roles)) return null;
  if (typeof o?.iat !== "number" || !Number.isFinite(o.iat)) return null;
  if (typeof o?.exp !== "number" || !Number.isFinite(o.exp)) return null;
  if (Date.now() >= o.exp) return null;
  return { sub: o.sub, oid: o.oid, roles: o.roles as Role[], iat: o.iat, exp: o.exp };
}

/**
 * داده چاپ سفارش — بدون استفاده از کوکی نشست (R-01).
 *
 * @param token توکن چاپ (از query string).
 * @throws unauthorized اگر توکن معتبر نباشد (منقضی/دستکاری‌شده).
 * @throws forbidden اگر توکن مربوط به سفارش دیگری باشد (cross-order).
 * @throws notFound اگر سفارش وجود نکند.
 */
export async function getPrintOrder(
  orderId: string,
  token: string | null | undefined,
): Promise<PrintableOrder | PrintableOrderNoMoney> {
  const claims = verifyPrintToken(token);
  if (!claims) {
    throw unauthorized("توکن چاپ معتبر نیست یا منقضی شده است.");
  }
  // توکن فقط برای همان سفارش معتبر است — cross-order ممنوع (R-01).
  if (claims.oid !== orderId) {
    throw forbidden("توکن چاپ مربوط به این سفارش نیست.");
  }

  const exists = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!exists) throw notFound("سفارش مورد نظر پیدا نشد.");

  const settings = await getSettings();
  const hideMoney = isNoMoneyRole(claims.roles);
  const order = await getOrder(orderId, hideMoney);
  if (hideMoney) {
    return { ...(order as OrderDetailNoMoney), company: settings.company, vatRate: settings.vat };
  }
  return { ...(order as OrderDetail), company: settings.company, vatRate: settings.vat };
}
