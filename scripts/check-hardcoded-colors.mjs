/**
 * اسکریپت بررسی رنگ hardcoded (D-05 / A-1.5).
 *
 * هر مقدار رنگ خام (hex یا rgba?()/hsla?()) در فایل‌های منبع برنامه غیرمجاز است —
 * مگر در دو فایل مجاز:
 *   - src/styles/globalCss/tokens.css  (منبع منحصربه‌فرد مقادیر خام)
 *   - src/styles/globalCss/themes.css  (رجوع‌های حالت تاریک)
 *
 * اجرا: `npm run check:colors`
 * خروجی: فهرست تطبیق‌ها (file:line:col) و کد خروجی غیرصفر در صورت وجود.
 *
 * این ماژول همچنین از آزمون vitest استفاده می‌شود (src/test/no-hardcoded-colors.test.ts).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

const ALLOWED_FILES = new Set([
  "src/styles/globalCss/tokens.css",
  "src/styles/globalCss/themes.css",
]);

const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".css", ".js", ".mjs", ".jsx", ".html"]);

const SKIP_DIRS = new Set(["node_modules", ".next", "coverage", ".git", "fonts"]);

// تنها فایل‌هایی که màu خام در آن‌ها غیرمجاز است: src/** و پیکربندی‌های ریشه.
// (اسکنر خودش در scripts/ مستثنی است تا regex‌هایش گزارش نشوند، و پوشه Demo اصلاً
// بخشی از این پروژه نیست.)
const SCAN_ROOTS = ["src", "tailwind.config.ts", "postcss.config.mjs", "next.config.ts", "vitest.config.ts"];
const SELF_REL = "scripts/check-hardcoded-colors.mjs";

const COLOR_PATTERNS = [
  { re: /#[0-9a-fA-F]{3,8}\b/g, name: "hex" },
  { re: /\brgba?\(/gi, name: "rgb()" },
  { re: /\bhsla?\(/gi, name: "hsl()" },
];

/**
 * @typedef {{ file: string, line: number, column: number, name: string, match: string }} Hit
 */

/**
 * جستجوی بازگشتی فایل‌های منبع زیر یک ریشه.
 * @param {string} dir
 * @param {string[]} acc
 * @returns {string[]}
 */
function listDir(dir, acc) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) listDir(join(dir, entry.name), acc);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!SCAN_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf(".")))) continue;
    if (entry.name.startsWith("next-env.d.ts")) continue;
    acc.push(join(dir, entry.name));
  }
  return acc;
}

/**
 * @returns {string[]}
 */
function listFiles() {
  const acc = [];
  for (const root of SCAN_ROOTS) {
    const abs = join(ROOT, root);
    try {
      if (statSync(abs).isDirectory()) listDir(abs, acc);
      else acc.push(abs);
    } catch {
      // ریشه وجود ندارد — نادیده
    }
  }
  return acc;
}

/**
 * @param {string} content
 * @param {string} relPath
 * @returns {Hit[]}
 */
function scanContent(content, relPath) {
  /** @type {Hit[]} */
  const hits = [];
  for (const { re, name } of COLOR_PATTERNS) {
    re.lastIndex = 0;
    /** @type {RegExpExecArray | null} */
    let m;
    while ((m = re.exec(content)) !== null) {
      const before = content.slice(0, m.index);
      const line = before.split("\n").length;
      const column = m.index - before.lastIndexOf("\n");
      hits.push({ file: relPath, line, column, name, match: m[0] });
    }
  }
  return hits;
}

/**
 * @returns {Hit[]}
 */
export function findHardcodedColors() {
  const files = listFiles();
  /** @type {Hit[]} */
  const hits = [];
  for (const abs of files) {
    const rel = relative(ROOT, abs).replace(/\\/g, "/");
    if (ALLOWED_FILES.has(rel)) continue;
    if (rel === SELF_REL) continue;
    const content = readFileSync(abs, "utf8");
    hits.push(...scanContent(content, rel));
  }
  return hits;
}

function main() {
  const hits = findHardcodedColors();
  if (hits.length === 0) {
    console.log("check-hardcoded-colors: OK — هیچ رنگ hardcodedی خارج از tokens/themes یافت نشد.");
    return 0;
  }
  console.error(`check-hardcoded-colors: ${hits.length} رنگ hardcoded یافت شد:`);
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}:${h.column}  [${h.name}] ${h.match}`);
  }
  console.error("تنها فایل‌های مجاز: src/styles/globalCss/tokens.css و src/styles/globalCss/themes.css");
  return 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  process.exit(main());
}
