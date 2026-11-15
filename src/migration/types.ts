/**
 * مهاجرت داده Demo → پایگاه داده جدید — انواع مشترک (MIGRATION_STRATEGY §۳).
 *
 * این پکیج منطق مهاجرت را به‌صورت ماژول‌های خالص قابل آزمون نگه می‌دارد
 * (PHASE_08 §۵). CLI در `scripts/migrate.ts` است.
 */

/** snapshot خام خوانده‌شده از پوشه data (معادل درایور فایل Demo). */
export type RawSnapshot = {
  meta: unknown;
  docs: {
    accounts: unknown[];
    leads: unknown[];
    orders: unknown[];
    buys: unknown[];
    jobs: unknown[];
    moves: unknown[];
  };
  /** محتوای seq-<KIND>.txt — آخرین شماره تخصیص‌یافته هر series. */
  seq: Record<string, number>;
};

/** سطر گزارش یک سند نامعتبر (مرحله ۱/۵ — اصلاح ساکت ممنوع). */
export type RejectedRecord = {
  collection: string;
  id: string;
  step: "extract" | "normalize" | "map" | "validate";
  reason: string;
};

/** گزارش مرحله استخراج. */
export type ExtractionReport = {
  counts: Record<string, number>;
  invalidJson: string[];
  missingFiles: string[];
};

/** گزارش نهایی مهاجرت (MIGRATION_REPORT.md از این ساخته می‌شود). */
export type MigrationReport = {
  startedAt: string;
  source: string;
  extraction: ExtractionReport;
  mapped: Record<string, number>;
  rejected: RejectedRecord[];
  /** ارجاع‌های نرم (کاربر) ناموجود — null شده و گزارش شده. */
  referentialIssues: { collection: string; id: string; ref: string; kind: string }[];
  /** فیلدهای Demo که مدل هدف ندارند — شفاف در گزارش. */
  droppedFields: { collection: string; id: string; fields: string[] }[];
  loaded: Record<string, number>;
  /** آخرین شماره هر series (ثبت‌شده در Rev — R-12). */
  seqs: Record<string, number>;
  verification: VerificationReport;
  /** Duration به میلی‌ثانیه. */
  durationMs: number;
};

/** گزارش صحه‌گذاری (مرحله ۷ — شمارش تطبیقی + نمونه‌گیری). */
export type VerificationReport = {
  countsMatch: boolean;
  expected: Record<string, number>;
  actual: Record<string, number>;
  /** تفاوت‌ها، یعنی (مجموعه، اختلاف). */
  countDiffs: { collection: string; expected: number; actual: number }[];
  /** نتایج نمونه‌گیری ۱۰٪ — تطابق فیلدی. */
  sampling: {
    collection: string;
    id: string;
    matched: boolean;
    diffs: string[];
  }[];
  samplingCoverage: number;
};
