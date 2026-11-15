/**
 * خروجی CSV سرنخ‌ها برای اکسل — معادل `csvOf` در Demo (server/export.js:50-68).
 *
 * ۲۵ ستون دقیقاً مطابق Demo. فیلدهایی که در طرح داده فاز ۲ مدل نشده‌اند
 * (srcNote، project، area، prob) خالی emit می‌شوند — جزو انحرافات ثبت‌شده.
 * BOM UTF-8 برای نمایش صحیح فارسی در اکسل (Demo: پیشوند BOM).
 */
import { instantToJalaliIso } from "@core/calendar";

/** سطر CSV سرنخ — داده تجمیع‌شده سمت سرور. */
export type LeadCsvRow = {
  id: string;
  accountName: string;
  accountKind: string;
  accountCity: string;
  phones: string[];
  contacts: { name: string; role: string; phone: string }[];
  line: string;
  stage: string;
  ownerName: string;
  source: string;
  interest: string[];
  amount: number | null;
  nextAt: string | null;
  nextSubject: string | null;
  callCount: number;
  lastResult: string;
  lostReason: string | null;
  note: string;
  orderIds: string[];
  createdAt: number;
  updatedAt: number;
};

const HEADERS = [
  "شناسه", "نام / شرکت", "نوع", "شهر", "تلفن‌ها", "مخاطب‌ها", "بخش", "مرحله",
  "کارشناس", "منبع ورود", "توضیح منبع", "نوع پروژه", "محصولات موردنظر", "متراژ",
  "ارزش تخمینی (تومان)", "احتمال (%)", "پیگیری بعدی", "موضوع پیگیری", "تعداد تماس",
  "آخرین نتیجه", "دلیل از دست رفتن", "یادداشت", "پیش‌فاکتور", "تاریخ ایجاد",
  "آخرین به‌روزرسانی",
] as const;

/** برچسب ثابت مرحله — STAGE در server/export.js:48. */
const STAGE_LABELS: Readonly<Record<string, string>> = {
  raw: "سرنخ اولیه",
  opp: "فرصت تجاری",
  pf: "پیش‌فاکتور",
  won: "خرید قطعی",
  lost: "از دست رفته",
};

/** برچسب نوع حساب. */
const KIND_LABELS: Readonly<Record<string, string>> = {
  company: "شرکت",
  person: "شخص",
};

const BOM = "﻿";

/**
 * ساخت CSV سرنخ‌ها — هر سطر با مرتب‌سازی صعودی تاریخ ایجاد (Demo:57).
 */
export function leadsCsv(rows: readonly LeadCsvRow[]): string {
  const sorted = [...rows].sort((a, b) => a.createdAt - b.createdAt);
  const lines = [HEADERS.join(",")];

  for (const r of sorted) {
    lines.push(
      [
        r.id,
        r.accountName,
        KIND_LABELS[r.accountKind] ?? "ناشناس",
        r.accountCity,
        r.phones.join(" | "),
        r.contacts.map((c) => [c.name, c.role, c.phone].filter(Boolean).join(" - ")).join(" | "),
        r.line,
        STAGE_LABELS[r.stage] ?? r.stage,
        r.ownerName,
        r.source,
        "", // srcNote — در طرح داده نیست
        "", // project — در طرح داده نیست
        r.interest.join(" | "),
        "", // area — در طرح داده نیست
        r.amount ?? "",
        "", // prob — در طرح داده نیست
        r.nextAt ?? "",
        r.nextSubject ?? "",
        r.callCount,
        r.lastResult,
        r.lostReason ?? "",
        r.note,
        r.orderIds.join(" | "),
        jDate(r.createdAt),
        jDate(r.updatedAt),
      ]
        .map(csvCell)
        .join(","),
    );
  }

  return BOM + lines.join("\r\n");
}

/** قالب تاریخ جلالی با ارقام لاتین `YYYY/MM/DD` — معادل jDate در export.js:31. */
function jDate(t: number): string {
  return t > 0 ? instantToJalaliIso(t) : "";
}

/** سلول CSV — نقل‌قول در صورت نیاز (Demo:36). */
function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
