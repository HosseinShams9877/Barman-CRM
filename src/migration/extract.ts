/**
 * مرحله ۱ مهاجرت — استخراج snapshot از پوشه data (MIGRATION_STRATEGY §۳.۱).
 *
 * پوشه Demo کامل استخراج می‌شود: meta.json، مجموعه‌های موجودیت و
 * seq-<KIND>.txt. اسناد JSON خراب گزارش می‌شوند (نه نادیده گرفتن).
 *
 * **هیچ فایلی در Demo نوشته/تغییر نمی‌یابد** — فقط خواندن.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ExtractionReport, RawSnapshot } from "./types";

const COLLECTIONS = ["accounts", "leads", "orders", "buys", "jobs", "moves"] as const;

/**
 * خواندن snapshot کامل از پوشه data.
 *
 * @param dataDir مسیر پوشه `data` در Demo
 * @throws اگر پوشه یا meta.json وجود نداشته باشد
 */
export function extractData(dataDir: string): { snapshot: RawSnapshot; report: ExtractionReport } {
  if (!existsSync(dataDir) || !statSync(dataDir).isDirectory()) {
    throw new Error(`پوشه داده وجود ندارد: ${dataDir}`);
  }

  const metaPath = join(dataDir, "meta.json");
  if (!existsSync(metaPath)) {
    throw new Error(`meta.json وجود ندارد در: ${dataDir}`);
  }

  const invalidJson: string[] = [];
  const missingFiles: string[] = [];

  const meta = readJsonOrReport(metaPath, "meta.json", invalidJson);
  const docs: RawSnapshot["docs"] = { accounts: [], leads: [], orders: [], buys: [], jobs: [], moves: [] };

  for (const collection of COLLECTIONS) {
    const dir = join(dataDir, collection);
    if (!existsSync(dir)) {
      missingFiles.push(collection);
      continue;
    }
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
      const doc = readJsonOrReport(join(dir, file), `${collection}/${file}`, invalidJson);
      if (doc !== null) docs[collection].push(doc);
    }
  }

  // seq-<KIND>.txt — آخرین شماره تخصیص‌یافته هر series (رفع R-12).
  const seq: Record<string, number> = {};
  for (const file of readdirSync(dataDir).filter((f) => f.startsWith("seq-") && f.endsWith(".txt"))) {
    const kind = file.slice("seq-".length, -".txt".length);
    const raw = readFileSync(join(dataDir, file), "utf-8").trim();
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) seq[kind] = n;
  }

  const counts: Record<string, number> = { meta: meta !== null ? 1 : 0 };
  for (const collection of COLLECTIONS) counts[collection] = docs[collection].length;
  counts["seq"] = Object.keys(seq).length;

  return {
    snapshot: { meta, docs, seq },
    report: { counts, invalidJson, missingFiles },
  };
}

/** خواندن JSON امن — خطا در فهرست invalidJson گزارش و null برمی‌گرداند. */
function readJsonOrReport(path: string, label: string, invalid: string[]): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    invalid.push(`${label}: ${(e as Error).message}`);
    return null;
  }
}

/** کلیدهای seq استخراج‌شده — برای استفاده در بارگذاری و گزارش. */
export function seqKinds(seq: Record<string, number>): string[] {
  return Object.keys(seq).sort();
}
