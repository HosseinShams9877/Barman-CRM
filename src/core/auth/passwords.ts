/**
 * هش رمز عبور — D-01 (تصمیم نهایی مالک: مدرن + امن).
 *
 * الگوریتم اصلی: **bcrypt** (cost ۱۰).
 *
 * **سازگاری مهاجرت:** Demo رمزها را با scrypt ذخیره کرده است
 * (server/auth.js:56: `scryptSync(pw, salt, 32).toString("hex")`).
 * ما هر دو الگوریتم را در پنجره انتقال تأیید می‌کنیم: هش‌های قدیمی scrypt با
 * Salt جداگانه (ستون password_salt) تأیید می‌شوند و پس از ورود موفق،
 * به‌صورت شفاف به bcrypt ارتقا پیدا می‌کنند (needsRehash → re-hash).
 * این کار بدون شکستن حساب‌های Demo انجام می‌شود.
 */
import { compare, hash } from "bcryptjs";
import { scryptSync, timingSafeEqual } from "node:crypto";

/** هزینه bcrypt — عدد بالاتر، دیرتر شکسته می‌شود. */
export const BCRYPT_COST = 10;

/** پیشوند هش bcrypt در همه پیاده‌سازی‌ها. */
const BCRYPT_PREFIX = "$2";

/** رمز را با bcrypt هش می‌کند — برای کاربران جدید و ارتقای هش‌های قدیمی. */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_COST);
}

/** آیا این هش bcrypt است (در غیر اینصورت scrypt قدیمی است)؟ */
export function isBcryptHash(stored: string | null | undefined): boolean {
  return typeof stored === "string" && stored.startsWith(BCRYPT_PREFIX);
}

/**
 * آیا هش باید به bcrypt ارتقا یابد؟
 * هر هشی که bcrypt نیست (مثل scrypt قدیمی Demo) نیاز به ارتقا دارد.
 */
export function needsRehash(stored: string | null | undefined): boolean {
  return !isBcryptHash(stored);
}

/**
 * تأیید یک هش scrypt قدیمی از Demo — دقیقاً مطابق verifyHash در
 * server/auth.js:60: `scryptSync(pw, salt, 32).toString("hex")` و
 * مقایسه زمان‌سنجی‌امن.
 */
export function verifyLegacyScrypt(
  password: string,
  salt: string | null | undefined,
  hash: string | null | undefined,
): boolean {
  if (!hash || !salt) return false;
  try {
    const computed = scryptSync(String(password), salt, 32).toString("hex");
    const a = Buffer.from(computed, "utf8");
    const b = Buffer.from(String(hash), "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * تأیید رمز در برابر هش ذخیره‌شده — هر دو الگوریتم پشتیبانی می‌شوند.
 *
 * - هش bcrypt → `compare` از bcryptjs (زمان‌سنجی‌امن درونی).
 * - هش scrypt قدیمی Demo → verifyLegacyScrypt با salt جداگانه.
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
  salt: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;
  if (isBcryptHash(stored)) {
    try {
      return await compare(String(password), stored);
    } catch {
      return false;
    }
  }
  return verifyLegacyScrypt(password, salt, stored);
}
