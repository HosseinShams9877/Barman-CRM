/**
 * اسکنر نویسه‌های نامعتبر (Garble) — فاز ۲.
 *
 * متن فارسی پروژه نباید دارای نویسه‌های غیرمجاز (CJK، سیریلیک،
 * فول‌ویدث، لاتین توسعه‌یافته) باشد. اجرا بعد از هر نوشتار:
 *
 *   node scripts/check-garble.mjs
 *
 * خروجی ۰ یعنی نظافت کامل.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const DEMO = "پلتفرم نهایی تیم بارمان";

// بازه‌های نامعتبر — این نویسه‌ها هرگز در متن فارسی پروژه نباید باشند.
const BAD_RANGES = [
  [0x3000, 0x9fff], // CJK
  [0x3040, 0x30ff], // کاتاکانا/هیراگانا
  [0x0400, 0x052f], // سیریلیک
  [0xff00, 0xffef], // فول‌ویدث
  [0x1e00, 0x1f00], // لاتین توسعه‌یافته
];

// بازه‌های خط فارسی/عربی
const ARABIC_RANGES = [
  [0x0600, 0x06ff], // عربی/فارسی
  [0xfb50, 0xfdff], // Presentation-A
  [0xfe70, 0xfeff], // Presentation-B
];

function inRanges(code, ranges) {
  return ranges.some(([start, end]) => code >= start && code < end);
}

// پسوندهای متنی بررسی‌شده
const EXTENSIONS = new Set([".ts", ".tsx", ".css", ".js", ".mjs", ".json", ".md", ".prisma"]);

let scanned = 0;
const bad = [];

function isBad(code) {
  return inRanges(code, BAD_RANGES);
}

// تشخیص ترکیب نویسه‌های فارسی و لاتین بدون جداکننده.
// در فارسیِ فنی معتبر، کلمه لاتین + پسوند فارسی (مثل agentها) رایج است،
// پس فقط حالتی که حروف فارسی مستقیماً به حروف لاتین برسد نامعتبر است.
function charCat(code) {
  if (inRanges(code, ARABIC_RANGES)) {
    // ارقام فارسی (۰۶F۰–۰۶F۹) واحد لاتین می‌گیرند (مثل ۵۰۰px) — مجاز.
    if (code >= 0x06f0 && code <= 0x06f9) return "di";
    return "ar";
  }
  if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) return "la";
  return null;
}

function scanFile(path) {
  let text;
  try {
    text = readFileSync(path, "utf-8");
  } catch {
    return;
  }
  scanned += 1;
  // قانون ترکیب فقط روی فایل‌های کد اعمال می‌شود (در markdown مخلوط‌نویسی
  // رایج و قابل‌قبول است).
  const isCode = /\.(ts|tsx|js|mjs|css|prisma)$/.test(path);
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    let hit = null;
    let prevCat = null;
    for (let j = 0; j < line.length && !hit; j += 1) {
      const code = line.charCodeAt(j);
      if (isBad(code)) {
        hit = { line: i + 1, code, kind: "U+%s", preview: line.trim().slice(0, 90) };
        break;
      }
      const cat = charCat(code);
      // فقط فارسی → لاتین مستقیم (نه لاتین → فارسی، یعنی پسوند «ها»).
      if (isCode && prevCat === "ar" && cat === "la") {
        hit = { line: i + 1, code, kind: "ترکیب فارسی+لاتین", preview: line.trim().slice(0, 90) };
        break;
      }
      prevCat = cat;
    }
    if (hit) {
      bad.push({
        file: path.slice(ROOT.length + 1),
        line: hit.line,
        code: hit.code,
        kind: hit.kind,
        preview: hit.preview,
      });
    }
  }
}

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next" || name === ".git" || name.startsWith(".vanilla")) {
      continue;
    }
    if (name === DEMO) continue; // پوشه Demo فقط‌خواندنی است — بخشی از پروژه نیست
    const path = join(dir, name);
    let st;
    try {
      st = statSync(path);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(path);
    } else if (EXTENSIONS.has(name.slice(name.lastIndexOf(".")))) {
      scanFile(path);
    }
  }
}

walk(ROOT);

if (bad.length === 0) {
  console.log(`check-garble: OK — ${scanned} فایل بررسی شد، نویسه نامعتبر یافت نشد.`);
  process.exit(0);
}

console.error(`check-garble: FAIL — ${bad.length} نویسه نامعتبر در ${scanned} فایل:`);
for (const b of bad) {
  const code = b.kind === "ترکیب فارسی+لاتین" ? b.kind : `U+${b.code.toString(16).toUpperCase().padStart(4, "0")}`;
  console.error(`  ${b.file}:${b.line}  ${code}  ${b.preview}`);
}
process.exit(1);
