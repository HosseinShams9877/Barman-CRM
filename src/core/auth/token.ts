/**
 * توکن دسترسی امضاشده — D-01 (تصمیم نهایی مالک).
 *
 * `base64url(JSON payload) + "." + HMAC-SHA256(base64url(payload))`
 *
 * همین ساختار Demo (server/auth.js:18) با سه تفاوت مستند:
 *   ۱. به‌جای نقش واحد، لیست نقش‌ها (چندنقشی).
 *   ۲. `sv` (sessionVersion) اضافه شده — باطل‌کردن نشست از سمت سرور.
 *   ۳. `exp` اجباری و کوتاه (۸ ساعت، نه ۳۶۵ روز Demo).
 *
 * توکن فقط در کوکی HttpOnly قرار می‌گیرد — هرگز در localStorage.
 * بررسی در verifyToken با timingSafeEqual (مثل safeEq در Demo).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** محموله توکن — همه زمان‌ها UTC ms (CD-06). */
export type AccessTokenPayload = {
  /** شناسه کاربر (cuid) */
  sub: string;
  /** نام کاربر */
  u: string;
  /** لیست کلید نقش‌ها */
  roles: string[];
  /** نسخه نشست — باطل‌کردن نشست از سمت سرور */
  sv: number;
  /** زمان صدور (UTC ms) */
  iat: number;
  /** زمان انقضا (UTC ms) */
  exp: number;
};

const b64 = (s: string): string => Buffer.from(s, "utf8").toString("base64url");

/** نام متغیر محیطی کلید امضا. */
export const AUTH_SECRET_ENV = "AUTH_SECRET";

function getSecret(): string {
  const s = process.env[AUTH_SECRET_ENV];
  if (!s || s.length < 32) {
    throw new Error(
      `AUTH_SECRET تنظیم نشده یا کوتاه است (حداقل ۳۲ نویسه). متغیر ${AUTH_SECRET_ENV} را تنظیم کنید.`,
    );
  }
  return s;
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

/** امضای محموله و ساخت رشته توکن. */
export function signToken(payload: AccessTokenPayload): string {
  const encoded = b64(JSON.stringify(payload));
  return `${encoded}.${signPayload(encoded)}`;
}

/** ساخت توکن با صدور و انقضای نسبی. مدت maximalAgeMs بر حسب میلی‌ثانیه. */
export function issueToken(
  claims: { sub: string; u: string; roles: string[]; sv: number },
  maxAgeMs: number,
): AccessTokenPayload & { token: string } {
  const iat = Date.now();
  const payload: AccessTokenPayload = { ...claims, iat, exp: iat + maxAgeMs };
  return { ...payload, token: signToken(payload) };
}

/** تبدیل توکن‌شکن —دامنه‌های ورودی را اعتبارسنجی می‌کند. */
function parsePayload(raw: string): AccessTokenPayload | null {
  try {
    const o = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<AccessTokenPayload>;
    if (typeof o?.sub !== "string" || !o.sub) return null;
    if (typeof o?.u !== "string" || !o.u) return null;
    if (!Array.isArray(o?.roles) || o.roles.some((r) => typeof r !== "string")) return null;
    if (typeof o?.sv !== "number" || !Number.isFinite(o.sv)) return null;
    if (typeof o?.exp !== "number" || !Number.isFinite(o.exp)) return null;
    if (typeof o?.iat !== "number" || !Number.isFinite(o.iat)) return null;
    if (Date.now() >= o.exp) return null;
    return {
      sub: o.sub,
      u: o.u,
      roles: o.roles,
      sv: o.sv,
      iat: o.iat,
      exp: o.exp,
    };
  } catch {
    return null;
  }
}

/**
 * بررسی امضا و انقضای توکن.
 *
 * `null` یعنی نامعتبر — هیچ استثنایی پرتاب نمی‌شود (مثل session در Demo).
 */
export function verifyToken(token: string | null | undefined): AccessTokenPayload | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const encoded = token.slice(0, i);
  const signature = token.slice(i + 1);
  let expected: string;
  try {
    expected = signPayload(encoded);
  } catch {
    return null;
  }
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return parsePayload(encoded);
}
