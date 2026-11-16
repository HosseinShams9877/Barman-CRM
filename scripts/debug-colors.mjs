import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".css", ".js", ".mjs", ".jsx", ".html"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "coverage", ".git", "fonts"]);
const SCAN_ROOTS = ["src", "tailwind.config.ts", "postcss.config.mjs", "next.config.ts", "vitest.config.ts"];
function listDir(dir, acc) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const entry of entries) {
    if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name)) listDir(join(dir, entry.name), acc); continue; }
    if (!entry.isFile()) continue;
    if (!SCAN_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf(".")))) continue;
    acc.push(join(dir, entry.name));
  }
  return acc;
}
const acc = [];
for (const root of SCAN_ROOTS) {
  const abs = join(ROOT, root);
  try { if (statSync(abs).isDirectory()) listDir(abs, acc); else acc.push(abs); } catch {}
}
console.log("files:", acc.length, "canary:", acc.some((f) => f.includes("CANARY")), "layout:", acc.some((f) => f.endsWith("layout.css")));
const COLOR_PATTERNS = [
  { re: /#[0-9a-fA-F]{3,8}\b/g, name: "hex" },
  { re: /\brgba?\(/gi, name: "rgb()" },
  { re: /\bhsla?\(/gi, name: "hsl()" },
];
let total = 0;
for (const abs of acc) {
  const rel = relative(ROOT, abs).split(join(".")).join("/"); // placeholder, replaced below
  const relPath = relative(ROOT, abs).replace(/\\/g, "/");
  void rel;
  const content = readFileSync(abs, "utf8");
  for (const { re } of COLOR_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      total++;
      if (relPath.includes("layout") || relPath.includes("CANARY")) console.log(relPath, m[0]);
    }
  }
}
console.log("total:", total);
