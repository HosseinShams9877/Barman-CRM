/**
 * آزمون حل نشست — D-01 / AUTH §۲.۱.
 *
 * هر درخواست ۴ بررسی سرور دارد: امضا+انقضا، وجود کاربر، off، sessionVersion.
 * کلاینت Prisma در این آزمون mock می‌شود (بدون نیاز به فایل دیتابیس).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../database/client";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS, buildSessionCookie } from "./cookie";
import { issueToken } from "./token";
import { type Session, issueSession, resolveSession, requireSession } from "./session";
import { unauthorized } from "../errors";

vi.mock("../database/client", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const SECRET = "test-secret-for-hmac-signing-0123456789";
const ADMIN = {
  id: "u1",
  name: "ali",
  title: "مدیر فروش",
  off: false,
  sessionVersion: 0,
  roles: [{ roleKey: "salesManager" }],
};

function seed(user: unknown): void {
  vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
}

function tokenFor(claims: { sub?: string; u?: string; roles?: string[]; sv?: number }): string {
  const { token } = issueToken(
    {
      sub: claims.sub ?? "u1",
      u: claims.u ?? "ali",
      roles: claims.roles ?? ["salesManager"],
      sv: claims.sv ?? 0,
    },
    SESSION_MAX_AGE_MS,
  );
  return token;
}

beforeEach(() => {
  process.env["AUTH_SECRET"] = SECRET;
  vi.mocked(prisma.user.findUnique).mockReset();
});

describe("resolveSession — نشست معتبر", () => {
  it("توکن معتبر و کاربر فعال و sessionVersion برابر → نشست کامل", async () => {
    seed(ADMIN);
    // resolveSession فقط مقدار کوکی را می‌گیرد (نه کل رشته Set-Cookie)
    const session = await resolveSession(tokenFor({}));
    expect(session).not.toBeNull();
    expect(session!.userId).toBe("u1");
    expect(session!.name).toBe("ali");
    expect(session!.title).toBe("مدیر فروش");
    expect(session!.roles).toEqual(["salesManager"]);
    expect(session!.needsRenew).toBe(false);
  });

  it("نقش نامعتبر در DB فیلتر می‌شود", async () => {
    seed({ ...ADMIN, roles: [{ roleKey: "salesManager" }, { roleKey: "ghost" }] });
    const session = await resolveSession(tokenFor({}));
    expect(session!.roles).toEqual(["salesManager"]);
  });

  it("مقدار استخراج‌شده از Set-Cookie با موفقیت حل می‌شود", async () => {
    // Route Headerها مقدار را این‌گونه از کوکی می‌خوانند — نه کل رشته را
    seed(ADMIN);
    const raw = buildSessionCookie(tokenFor({}));
    const value = raw.slice(raw.indexOf("=") + 1, raw.indexOf(";"));
    const session = await resolveSession(value);
    expect(session).not.toBeNull();
    expect(session!.userId).toBe("u1");
  });

  it("کل رشته Set-Cookie به‌عنوان توکن نامعتبر است", async () => {
    // ویژگی‌های کوکی (Path/HttpOnly/...) نباید به توکن راه پیدا کنند
    seed(ADMIN);
    expect(await resolveSession(buildSessionCookie(tokenFor({})))).toBeNull();
  });
});

describe("resolveSession — نامعتبر → null", () => {
  it("توکن خراب", async () => {
    expect(await resolveSession("garbage")).toBeNull();
    expect(await resolveSession(null)).toBeNull();
    expect(await resolveSession(undefined)).toBeNull();
  });

  it("کاربر پیدا نشد", async () => {
    seed(null);
    expect(await resolveSession(tokenFor({}))).toBeNull();
  });

  it("کاربر غیرفعال (u.off — R-02)", async () => {
    seed({ ...ADMIN, off: true });
    expect(await resolveSession(tokenFor({}))).toBeNull();
  });

  it("sessionVersion همخوان نیست (نشست باطل‌شده در سرور)", async () => {
    seed({ ...ADMIN, sessionVersion: 1 });
    expect(await resolveSession(tokenFor({ sv: 0 }))).toBeNull();
  });

  it("توکن منقضی شده", async () => {
    seed(ADMIN);
    const { token } = issueToken({ sub: "u1", u: "ali", roles: ["sales"], sv: 0 }, -1000);
    expect(await resolveSession(token)).toBeNull();
  });
});

describe("needsRenew — نشست لغزان", () => {
  it("باقی‌مانده کمتر از نصف عمر → needsRenew درست", async () => {
    seed(ADMIN);
    const { token } = issueToken({ sub: "u1", u: "ali", roles: ["sales"], sv: 0 }, 1000);
    // انقضا یک ثانیه دیگر — کمتر از ۴ ساعت
    const session = await resolveSession(token);
    expect(session!.needsRenew).toBe(true);
  });
});

describe("requireSession", () => {
  it("نشست نامعتبر → ApiError ۴۰۱", async () => {
    seed(null);
    try {
      await requireSession(tokenFor({}));
      throw new Error("نباید به اینجا برسد");
    } catch (e) {
      expect((e as Error).constructor.name).toBe("ApiError");
      expect((e as { status: number }).status).toBe(401);
      expect((e as { message: string }).message).toContain("نشست");
    }
  });

  it("نشست معتبر → Session برمی‌گرداند", async () => {
    seed(ADMIN);
    const session: Session = await requireSession(tokenFor({}));
    expect(session.userId).toBe("u1");
  });

  it("unauthorized() کد UNAUTHORIZED دارد", () => {
    expect(unauthorized().code).toBe("UNAUTHORIZED");
  });
});

describe("issueSession", () => {
  it("توکن + کوکی با نام SESSION_COOKIE", async () => {
    const issued = await issueSession({
      id: "u1",
      name: "ali",
      sessionVersion: 0,
      roles: ["admin"],
    });
    expect(issued.token.length).toBeGreaterThan(0);
    expect(issued.cookie).toContain(`${SESSION_COOKIE}=`);
    expect(issued.cookie).toContain("HttpOnly");
    expect(issued.expiresAt).toBeGreaterThan(Date.now());
  });
});
