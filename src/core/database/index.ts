/**
 * core/database — لوله انتشار (CD-02).
 *
 * فاز ۲: کلاینت singleton Prisma ۶ + seed توسعه.
 * فاز ۳: تولید شناسه‌های AC-/LD-.
 */
export { prisma } from "./client";
export { SEED_ROLES, SEED_SETTINGS, SEED_LIST_KEYS } from "./seed";
export { nextPrefixedId, SEQ_START, newMoveId } from "./ids";
