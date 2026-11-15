/**
 * آزمون کوکی نشست — D-01 / AUTH_AND_PERMISSION_ARCHITECTURE §۲.۱.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  SESSION_RENEW_AFTER_MS,
  buildExpiredCookie,
  buildSessionCookie,
} from "./cookie";

describe("buildSessionCookie", () => {
  it("ویژگی‌های امنیتی الزامی", () => {
    const c = buildSessionCookie("tok");
    expect(c).toContain(`${SESSION_COOKIE}=tok`);
    expect(c).toContain("Path=/");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Lax");
  });

  it("Max-Age برابر ۸ ساعت", () => {
    const c = buildSessionCookie("tok");
    expect(c).toContain(`Max-Age=${SESSION_MAX_AGE_MS / 1000}`);
    expect(SESSION_MAX_AGE_MS).toBe(8 * 60 * 60 * 1000);
  });

  it("نام کوکی همان Demo است (br_s)", () => {
    expect(SESSION_COOKIE).toBe("br_s");
  });

  it("نشست لغزان: نصف عمر", () => {
    expect(SESSION_RENEW_AFTER_MS).toBe(SESSION_MAX_AGE_MS / 2);
  });

  it("توکن URL-encoded می‌شود", () => {
    const c = buildSessionCookie("a+b/c=");
    expect(c).toContain("a%2Bb%2Fc%3D");
  });

  it("Secure فقط در حالت production یا AUTH_COOKIE_SECURE", () => {
    const prevFlag = process.env["AUTH_COOKIE_SECURE"];

    vi.stubEnv("NODE_ENV", "development");
    delete process.env["AUTH_COOKIE_SECURE"];
    expect(buildSessionCookie("tok")).not.toContain("Secure");
    expect(buildExpiredCookie()).not.toContain("Secure");

    vi.stubEnv("AUTH_COOKIE_SECURE", "true");
    expect(buildSessionCookie("tok")).toContain("Secure");

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_COOKIE_SECURE", "");
    expect(buildSessionCookie("tok")).toContain("Secure");
    expect(buildExpiredCookie()).toContain("Secure");

    vi.unstubAllEnvs();
    if (prevFlag === undefined) delete process.env["AUTH_COOKIE_SECURE"];
    else process.env["AUTH_COOKIE_SECURE"] = prevFlag;
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildExpiredCookie", () => {
  it("Max-Age=0 و HttpOnly", () => {
    const c = buildExpiredCookie();
    expect(c).toContain(`${SESSION_COOKIE}=`);
    expect(c).toContain("Max-Age=0");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Path=/");
  });
});
