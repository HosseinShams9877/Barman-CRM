/**
 * آزمون هش رمز — D-01: bcrypt + سازگاری scrypt قدیمی Demo.
 *
 * سناریوهای کلیدی:
 *   - هش/تأیید bcrypt
 *   - تأیید هش legacy با همان فرمول Demo (server/auth.js:56)
 *   - مسیریابی verifyPassword بین دو الگوریتم
 *   - needsRehash (پرچم ارتقای شفاف)
 */
import { scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  BCRYPT_COST,
  hashPassword,
  isBcryptHash,
  needsRehash,
  verifyLegacyScrypt,
  verifyPassword,
} from "./passwords";

const TEST_PASSWORD = "barman-12345";
const WRONG_PASSWORD = "wrong-password";

/** ساخت هش legacy دقیقاً مانند Demo: randomBytes(16) salt + scryptSync(pw, salt, 32). */
function makeLegacyHash(password: string, salt: string): string {
  return scryptSync(password, salt, 32).toString("hex");
}

describe("bcrypt (الگوریتم اصلی D-01)", () => {
  it("هش کردن و تأیید رمز درست", async () => {
    const hash = await hashPassword(TEST_PASSWORD);
    expect(hash).not.toBe(TEST_PASSWORD);
    expect(await verifyPassword(TEST_PASSWORD, hash, null)).toBe(true);
  });

  it("رمز اشتباه رد می‌شود", async () => {
    const hash = await hashPassword(TEST_PASSWORD);
    expect(await verifyPassword(WRONG_PASSWORD, hash, null)).toBe(false);
  });

  it("هش خالی/null رد می‌شود", async () => {
    expect(await verifyPassword(TEST_PASSWORD, null, null)).toBe(false);
    expect(await verifyPassword(TEST_PASSWORD, "", null)).toBe(false);
  });

  it("هش دو رمز یکسان متفاوت است (نمک تصادفی)", async () => {
    const a = await hashPassword(TEST_PASSWORD);
    const b = await hashPassword(TEST_PASSWORD);
    expect(a).not.toBe(b);
  });
});

describe("isBcryptHash / needsRehash", () => {
  it("پیشوند $2 نشان‌دهنده bcrypt است", async () => {
    const hash = await hashPassword(TEST_PASSWORD);
    expect(isBcryptHash(hash)).toBe(true);
    expect(needsRehash(hash)).toBe(false);
  });

  it("هش legacy نیاز به ارتقا دارد", () => {
    expect(isBcryptHash("a1b2c3")).toBe(false);
    expect(needsRehash("a1b2c3")).toBe(true);
    expect(needsRehash(null)).toBe(true);
    expect(needsRehash(undefined)).toBe(true);
  });

  it("BCRYPT_COST عددی معقول است", () => {
    expect(BCRYPT_COST).toBe(10);
  });
});

describe("verifyLegacyScrypt (سازگاری Demo)", () => {
  const salt = "0123456789abcdef";

  it("رمز درست با فرمول Demo تأیید می‌شود", () => {
    const hash = makeLegacyHash(TEST_PASSWORD, salt);
    expect(verifyLegacyScrypt(TEST_PASSWORD, salt, hash)).toBe(true);
  });

  it("رمز اشتباه رد می‌شود", () => {
    const hash = makeLegacyHash(TEST_PASSWORD, salt);
    expect(verifyLegacyScrypt(WRONG_PASSWORD, salt, hash)).toBe(false);
  });

  it("salt یا هش نال/false نمی‌گیرد", () => {
    const hash = makeLegacyHash(TEST_PASSWORD, salt);
    expect(verifyLegacyScrypt(TEST_PASSWORD, null, hash)).toBe(false);
    expect(verifyLegacyScrypt(TEST_PASSWORD, salt, null)).toBe(false);
  });

  it("ورودی نامعتبر استثنا پرتاب نمی‌کند", () => {
    expect(verifyLegacyScrypt(TEST_PASSWORD, "", "not-a-hex-string!")).toBe(false);
    expect(verifyLegacyScrypt("", salt, makeLegacyHash(TEST_PASSWORD, salt))).toBe(false);
  });
});

describe("verifyPassword — مسیریابی الگوریتم", () => {
  it("هش bcrypt از مسیر bcryptjs", async () => {
    const hash = await hashPassword(TEST_PASSWORD);
    expect(isBcryptHash(hash)).toBe(true);
    expect(await verifyPassword(TEST_PASSWORD, hash, "ignored")).toBe(true);
  });

  it("هش legacy از مسیر scrypt (با salt جداگانه)", async () => {
    const salt = "0123456789abcdef";
    const hash = makeLegacyHash(TEST_PASSWORD, salt);
    expect(isBcryptHash(hash)).toBe(false);
    expect(await verifyPassword(TEST_PASSWORD, hash, salt)).toBe(true);
    expect(await verifyPassword(WRONG_PASSWORD, hash, salt)).toBe(false);
  });

  it("هش legacy با salt اشتباه رد می‌شود", async () => {
    const hash = makeLegacyHash(TEST_PASSWORD, "0123456789abcdef");
    expect(await verifyPassword(TEST_PASSWORD, hash, "ffffffffffffffff")).toBe(false);
  });
});
