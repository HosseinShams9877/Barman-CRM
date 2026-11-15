/**
 * آزمون توکن دسترسی امضاشده — D-01 (HMAC-SHA256 + timingSafeEqual).
 */
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AUTH_SECRET_ENV, issueToken, signToken, verifyToken } from "./token";

const SECRET = "test-secret-for-hmac-signing-0123456789";
const CLAIMS = { sub: "user-1", u: "ali", roles: ["sales"], sv: 0 };

function setSecret(): void {
  process.env[AUTH_SECRET_ENV] = SECRET;
}

describe("issueToken / verifyToken", () => {
  it("گردش کامل: امضا → تأیید", () => {
    setSecret();
    const issued = issueToken(CLAIMS, 60_000);
    const payload = verifyToken(issued.token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("user-1");
    expect(payload!.u).toBe("ali");
    expect(payload!.roles).toEqual(["sales"]);
    expect(payload!.sv).toBe(0);
    expect(payload!.exp - payload!.iat).toBe(60_000);
  });

  it("نقش‌های چندگانه نگه داشته می‌شوند (تفاوت با Demo)", () => {
    setSecret();
    const issued = issueToken({ ...CLAIMS, roles: ["admin", "finance"] }, 60_000);
    expect(verifyToken(issued.token)!.roles).toEqual(["admin", "finance"]);
  });
});

describe("verifyToken — نامعتبر", () => {
  it("tokn دستکاری‌شده (تغییر یک نویسه در محموله)", () => {
    setSecret();
    const issued = issueToken(CLAIMS, 60_000);
    const tampered = flipChar(issued.token);
    expect(verifyToken(tampered)).toBeNull();
  });

  it("امضای جعلی", () => {
    setSecret();
    const issued = issueToken(CLAIMS, 60_000);
    const [encoded] = issued.token.split(".");
    const forged = `${encoded}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    expect(verifyToken(forged)).toBeNull();
  });

  it("توکن منقضی شده null", () => {
    setSecret();
    const expired = signToken({
      sub: "user-1",
      u: "ali",
      roles: ["sales"],
      sv: 0,
      iat: Date.now() - 10_000,
      exp: Date.now() - 1,
    });
    expect(verifyToken(expired)).toBeNull();
  });

  it("توکن بدون نقطه / خالی / null", () => {
    setSecret();
    expect(verifyToken("abc")).toBeNull();
    expect(verifyToken("")).toBeNull();
    expect(verifyToken(null)).toBeNull();
    expect(verifyToken(undefined)).toBeNull();
  });

  it("محموله با ساختار ناقص (فیلدهای گمشده)", () => {
    setSecret();
    const bad = b64Json({ sub: "user-1" });
    expect(verifyToken(`${bad}.${sign(bad)}`)).toBeNull();
  });

  it("secret متفاوت → توکن نامعتبر", () => {
    setSecret();
    const issued = issueToken(CLAIMS, 60_000);
    process.env[AUTH_SECRET_ENV] = "another-secret-that-is-long-enough-0123456789";
    expect(verifyToken(issued.token)).toBeNull();
    setSecret();
  });
});

describe("issueToken — secret نامعتبر", () => {
  it("نبود AUTH_SECRET خطا می‌دهد", () => {
    delete process.env[AUTH_SECRET_ENV];
    expect(() => issueToken(CLAIMS, 60_000)).toThrow();
  });

  it("secret کوتاه (کمتر از ۳۲) خطا می‌دهد", () => {
    process.env[AUTH_SECRET_ENV] = "short";
    expect(() => issueToken(CLAIMS, 60_000)).toThrow();
    setSecret();
  });
});

/** فلیپ یک نویسه در بخش محموله (قبل از اولین نقطه از انتها). */
function flipChar(token: string): string {
  const i = token.lastIndexOf(".");
  const encoded = token.slice(0, i);
  const flipped = encoded.charAt(0) === "A" ? "B" : "A";
  return `${flipped}${encoded.slice(1)}${token.slice(i)}`;
}

function b64Json(o: unknown): string {
  return Buffer.from(JSON.stringify(o), "utf8").toString("base64url");
}

function sign(encoded: string): string {
  return createHmac("sha256", SECRET).update(encoded).digest("base64url");
}
