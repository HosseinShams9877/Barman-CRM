/**
 * core/auth — لوله انتشار (CD-02).
 */
export {
  BCRYPT_COST,
  hashPassword,
  verifyPassword,
  verifyLegacyScrypt,
  isBcryptHash,
  needsRehash,
} from "./passwords";
export { signToken, issueToken, verifyToken, AUTH_SECRET_ENV } from "./token";
export type { AccessTokenPayload } from "./token";
export {
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  SESSION_RENEW_AFTER_MS,
  buildSessionCookie,
  buildExpiredCookie,
} from "./cookie";
export {
  loadUserWithRoles,
  issueSession,
  resolveSession,
  requireSession,
} from "./session";
export type { Session, IssueSessionInput } from "./session";
export { attemptLogin, logout, toPublicUser, permissionsFor } from "./service";
export type { PublicUser } from "./service";
