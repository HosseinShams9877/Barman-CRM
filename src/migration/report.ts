/**
 * تولید MIGRATION_REPORT.md از گزارش مهاجرت (مرحله نهایی).
 *
 * تمام اعداد از گزارش اجرا می‌آیند — هیچ مقدار ثابتی ادعا نمی‌شود.
 * تصمیمات نگاشت و فیلدهای رهاشده به‌صورت شفاف فهرست می‌شوند (R-27).
 */
import type { MigrationReport } from "./types";
import type { MappedData } from "./map";

/** تبدیل گزارش به Markdown — برای ذخیره در docs/reports/MIGRATION_REPORT.md. */
export function reportToMarkdown(report: MigrationReport, data: MappedData): string {
  const lines: string[] = [];
  const push = (line = ""): void => {
    lines.push(line);
  };

  push("# MIGRATION_REPORT — مهاجرت داده Demo → پایگاه داده جدید");
  push();
  push(`- **تاریخ اجرا:** ${report.startedAt}`);
  push(`- **منبع:** \`${report.source}\``);
  push(`- **مدت اجرا:** ${report.durationMs} میلی‌ثانیه`);
  push(`- **مراحل:** ۱ استخراج → ۲ تجزیه meta → ۳ نرمال‌سازی تاریخ → ۴ نقشه‌گذاری → ۵ اعتبارسنجی → ۶ بارگذاری تراکنشی → ۷ صحه‌گذاری`);
  push();

  // --- خلاصه شمارش ---
  push("## ۱. خلاصه شمارش تطبیقی");
  push();
  push("| مجموعه | اسناد Demo | ردیف‌های بارگذاری‌شده | وضعیت |");
  push("|---|---:|---:|---|");
  const demoCounts: Record<string, string> = {
    accounts: "accounts",
    leads: "leads",
    orders: "orders",
    buys: "buys",
    jobs: "jobs",
    moves: "moves",
  };
  for (const [collection, key] of Object.entries(demoCounts)) {
    const demo = report.verification.expected[key] ?? 0;
    const actual = report.loaded[key] ?? 0;
    push(`| ${collection} | ${demo} | ${actual} | ${demo === actual ? "✅ تطابق" : "⚠️ اختلاف"} |`);
  }
  push(`| meta | ${report.extraction.counts["meta"] ?? 0} | ${report.loaded["settings"] ?? 0} | تنظیمات |`);
  push();

  // --- شمارش کامل جداول ---
  push("## ۲. شمارش همه جداول هدف");
  push();
  push("| جدول | ردیف‌ها |");
  push("|---|---:|");
  for (const [key, value] of Object.entries(report.loaded).sort((a, b) => a[0].localeCompare(b[0]))) {
    push(`| ${key} | ${value} |`);
  }
  push();

  // --- رد‌شده‌ها ---
  push("## ۳. اسناد/ردیف‌های رد‌شده (بدون اصلاح ساکت)");
  push();
  if (report.rejected.length === 0) {
    push("هیچ سندی رد نشد.");
  } else {
    push("| مرحله | مجموعه | شناسه | دلیل |");
    push("|---|---|---|---|");
    for (const r of report.rejected) {
      push(`| ${r.step} | ${r.collection} | ${r.id} | ${escapeCell(r.reason)} |`);
    }
  }
  push();

  // --- اختلاف شمارش ---
  push("## ۴. اختلاف‌های شمارش");
  push();
  if (report.verification.countDiffs.length === 0) {
    push("هیچ اختلافی وجود ندارد — همه شمارش‌ها تطابق دارند.");
  } else {
    push("| مجموعه | مورد انتظار | واقعی |");
    push("|---|---:|---:|");
    for (const d of report.verification.countDiffs) {
      push(`| ${d.collection} | ${d.expected} | ${d.actual} |`);
    }
  }
  push();
  if (report.referentialIssues.length > 0) {
    push("### ۴.۱ ارجاع‌های نرم ناموجود (به null تبدیل و گزارش شدند)");
    push();
    push("| مجموعه | شناسه | ارجاع | نوع |");
    push("|---|---|---|---|");
    for (const i of report.referentialIssues) {
      push(`| ${i.collection} | ${i.id} | ${i.ref} | ${i.kind} |`);
    }
    push();
  }

  // --- فیلدهای رهاشده ---
  push("## ۵. فیلدهای Demo بدون معادل در مدل هدف");
  push();
  push("این فیلدها منتقل نمی‌شوند — تصمیمات نگاشت در §۶ مستند شده‌اند:");
  push();
  const aggregated = aggregateDropped(report.droppedFields);
  if (aggregated.length === 0) {
    push("هیچ فیلدی رها نشد.");
  } else {
    push("| مجموعه | فیلد | تعداد اسناد |");
    push("|---|---|---:|");
    for (const a of aggregated) {
      push(`| ${a.collection} | ${escapeCell(a.field)} | ${a.count} |`);
    }
  }
  push();

  // --- تصمیمات نگاشت ---
  push("## ۶. تصمیمات نگاشت (مستند — بدون اختراع قانون کسب‌کار)");
  push();
  push(buildDecisionsSection(report, data));
  push();

  // --- series ---
  push("## ۷. آخرین شماره هر series (R-12)");
  push();
  push("ثبت‌شده در جدول `Rev` با کلید `seq:<KIND>` — شناسه‌های بعدی از max موجود ادامه می‌یابند.");
  push();
  push("| series | آخرین شماره |");
  push("|---|---:|");
  for (const [kind, value] of Object.entries(report.seqs).sort((a, b) => a[0].localeCompare(b[0]))) {
    push(`| ${kind} | ${value} |`);
  }
  push();

  // --- نمونه‌گیری ---
  push("## ۸. نمونه‌گیری ۱۰٪");
  push();
  const matched = report.verification.sampling.filter((s) => s.matched).length;
  push(`- پوشش: ${Math.round(report.verification.samplingCoverage * 100)}٪ از اسناد اصلی`);
  push(`- تطابق: ${matched} از ${report.verification.sampling.length} نمونه`);
  const mismatched = report.verification.sampling.filter((s) => !s.matched);
  if (mismatched.length > 0) {
    push();
    push("| مجموعه | شناسه | تفاوت‌ها |");
    push("|---|---|---|");
    for (const m of mismatched) {
      push(`| ${m.collection} | ${m.id} | ${escapeCell(m.diffs.join("؛ "))} |`);
    }
  }
  push();

  // --- رمز اولیه ---
  push("## ۹. کاربران و رمز عبور اولیه");
  push();
  push("Demo هیچ هش رمزی در `data/` ذخیره نمی‌کند (ورود محلی با متغیرهای `PASS_*` سرور) — انتقال هش ممکن نیست.");
  push("رمز اولیه همه کاربران `barman1405` است (bcrypt cost ۱۰) — **باید پس از اولین ورود تغییر کند** (reset هماهنگ، MIGRATION_STRATEGY §۴).");
  push();
  push("| کاربر | نقش |");
  push("|---|---|");
  for (const u of data.users) {
    push(`| ${u.name} | ${u.roles.join("، ")} |`);
  }
  push();

  return lines.join("\n");
}

/** تصمیمات نگاشت ثابت — با ارجاع به سورس Demo. */
function buildDecisionsSection(report: MigrationReport, data: MappedData): string {
  void data;
  void report;
  return [
    "| تصمیم | منبع |",
    "|---|---|",
    "| `accounts.kind`: company/person → customer | ACCOUNT_KINDS در target (UI taxonomy) |",
    "| `leads.value = 0` → amount null | مقدار ۰ یعنی نامشخص |",
    "| `leads.next` → یک رکورد LeadFollowup با nextAt | hist[]/next در Demo |",
    "| `hist.kind = call` → note | kinds هدف: in/stage/note |",
    "| `orders.plan` منتقل نمی‌شود — رسیدها (receipts) منتقل می‌شوند | برنامه پرداخت نمایشی است |",
    "| `orders.pb` (موجود در PF-1217) → planBuilder | order.js planBuilder |",
    "| `log` → OrderStageLog با fromStage/toStage استخراج‌شده از `times` | core.js:172 log() |",
    "| `prod.handoff` → OrderHandoff با شناسه TR- اصلی (R-12) | order.js:731 |",
    "| `prod.start/end` (ms) → `YYYY/MM/DD` | CD-06 |",
    "| `prod.qc.good/waste` (per-product) → جمع‌جبری اعداد | qc هدف عددی است |",
    "| وضعیت خرید: draft/req→req، fin→ok، wait→fin، done/disc→recv | fin-core.js:14 ST |",
    "| خرید آژانسی رد می‌شود (BuyItem فقط مواد خام) | schema فاز ۶ |",
    "| پسورد کاربران: reset هماهنگ با رمز اولیه | MIGRATION_STRATEGY §۴ |",
    "| کاربر `sys` (سیستمی) در LeadFollowup → null + گزارش | core.js:127 |",
    "| `meta.feed` منتقل نمی‌شود — مدل هدف وجود ندارد | — |",
    "| `resv` (رزرو) منتقل نمی‌شود — Q-04 معوق | order.js:748 |",
  ].join("\n");
}

/** تجمیع فیلدهای رهاشده برای گزارش خلاصه. */
function aggregateDropped(
  dropped: { collection: string; id: string; fields: string[] }[],
): { collection: string; field: string; count: number }[] {
  const counts = new Map<string, { collection: string; field: string; count: number }>();
  for (const entry of dropped) {
    for (const field of entry.fields) {
      const key = `${entry.collection}|${field}`;
      const existing = counts.get(key);
      if (existing === undefined) {
        counts.set(key, { collection: entry.collection, field, count: 1 });
      } else {
        existing.count++;
      }
    }
  }
  return [...counts.values()].sort((a, b) => a.collection.localeCompare(b.collection) || a.field.localeCompare(b.field));
}

/** escape کاراکترهای جدول Markdown. */
function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
