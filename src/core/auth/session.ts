/**
 * نشست کاربر — D-01 / AUTH_AND_PERMISSION_ARCHITECTURE §۲.۱.
 *
 * نشست مبتنی بر کوکی امضاشده + بررسی سرور:
 *
 *   ۱. امضای HMAC و انقضا (توکن)
 *   ۲. وجود کاربر در DB
 *   ۳. غیرفعال نبودن کاربر (u.off — Demo فقط کلاینت چک می‌کرد)
 *   ۴. برابری sessionVersion (باطل‌کردن نشست از سمت سرور)
 *
 * سه تفاوت مستند با Demo (server/auth.js): نقش چندگانه به‌جای نقش واحد،
 * انقضای ۸ ساعته به‌جای ۳۶۵ روز، و بررسی server-side در هر درخواست.
 */
import { prisma } from "../database/client";
import { ROLES, type Role } from "../permissions/matrix";
import { SESSION_MAX_AGE_MS, SESSION_RENEW_AFTER_MS, buildSessionCookie } from "./cookie";
import { issueToken, verifyToken } from "./token";
import { unauthorized } from "../errors";

/** نشست حل‌شده — نقش‌ها همیشه از DB خوانده می‌شوند (منبع حقیقت). */
export type Session = {
  userId: string;
  name: string;
  title: string | null;
  roles: Role[];
  sessionVersion: number;
  /** زمان انقضای توکن (UTC ms — CD-06). */
  expiresAt: number;
  /** نشست لغزان: اگر نصف عمر گذشته باشد، توکن تازه لازم است. */
  needsRenew: boolean;
};

function isRole(key: string): key is Role {
  return (ROLES as ReadonlyArray<string>).includes(key);
}

/** خواندن کاربر با نقش‌ها از DB. */
export async function loadUserWithRoles(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { select: { roleKey: true } } },
  });
}

export type IssueSessionInput = {
  id: string;
  name: string;
  sessionVersion: number;
  roles: Role[];
};

/** صدور نشست تازه — توکن و هدر Set-Cookie را برمی‌گرداند. */
export async function issueSession(input: IssueSessionInput): Promise<{
  token: string;
  cookie: string;
  expiresAt: number;
}> {
  const { token, exp } = issueToken(
    { sub: input.id, u: input.name, roles: input.roles, sv: input.sessionVersion },
    SESSION_MAX_AGE_MS,
  );
  return { token, cookie: buildSessionCookie(token), expiresAt: exp };
}

/**
 * حل نشست از مقدار کوکی — null یعنی نشست نامعتبر.
 * در هر درخواست فراخوانی می‌شود (CD-04 گام ۱).
 */
export async function resolveSession(
  cookieValue: string | null | undefined,
): Promise<Session | null> {
  const payload = verifyToken(cookieValue);
  if (!payload) return null;

  const user = await loadUserWithRoles(payload.sub);
  if (!user) return null;
  if (user.off) return null; // غیرفعال‌سازی کاربر (R-02 / AUTH §۲.۲ نکته ۵)
  if (user.sessionVersion !== payload.sv) return null; // نشست باطل‌شده از سمت سرور

  const roles = user.roles.map((r) => r.roleKey).filter(isRole);
  return {
    userId: user.id,
    name: user.name,
    title: user.title,
    roles,
    sessionVersion: user.sessionVersion,
    expiresAt: payload.exp,
    needsRenew: payload.exp - Date.now() < SESSION_RENEW_AFTER_MS,
  };
}

/**
 * حل نشست یا پرتاب ۴۰۱ — برای گام ۱ در Route Handlerها (CD-04).
 */
export async function requireSession(
  cookieValue: string | null | undefined,
): Promise<Session> {
  const session = await resolveSession(cookieValue);
  if (!session) throw unauthorized();
  return session;
}
