/**
 * کوکی نشست — D-01 / AUTH_AND_PERMISSION_ARCHITECTURE §۲.۱.
 *
 * نام کوکی همان Demo (`br_s`) است تا با عادت کاربران سازگار بماند.
 * ویژگی‌ها: HttpOnly (دسترسی JS ممنوع)، SameSite=Lax، Secure در تولید.
 * توکن هرگز در localStorage ذخیره نمی‌شود.
 */

/** نام کوکی نشست (همان Demo: server/auth.js:8). */
export const SESSION_COOKIE = "br_s";

/** طول عمر نشست: ۸ ساعت (نه ۳۶۵ روز Demo) — AUTH_AND_PERMISSION_ARCHITECTURE §۲.۱. */
export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

/** نشست لغزان: اگر کمتر از نصف عمر مانده باشد، توکن تازه صادر می‌شود. */
export const SESSION_RENEW_AFTER_MS = SESSION_MAX_AGE_MS / 2;

/** مسیر کوکی — همه مسیرها. */
const COOKIE_PATH = "/";

function isSecure(): boolean {
  const env = process.env["NODE_ENV"];
  if (env === "production") return true;
  // وقتی پشت پروکسی https قرار داریم (مثل تولید روی Vercel)
  return String(process.env["AUTH_COOKIE_SECURE"] ?? "").toLowerCase() === "true";
}

/** ساختن مقدار Set-Cookie برای نشست تازه. */
export function buildSessionCookie(token: string): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    `Path=${COOKIE_PATH}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.round(SESSION_MAX_AGE_MS / 1000)}`,
  ];
  if (isSecure()) parts.push("Secure");
  return parts.join("; ");
}

/** ساختن Set-Cookie برای پاک کردن نشست (خروج). */
export function buildExpiredCookie(): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    `Path=${COOKIE_PATH}`,
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isSecure()) parts.push("Secure");
  return parts.join("; ");
}
