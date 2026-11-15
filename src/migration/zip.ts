/**
 * خواننده ZIP حداقلی — مهاجرت معکوس (PHASE_08 دروازه خروج ۴).
 *
 * برنامه جدید خروجی ZIP با چیدمان پوشه data تولید می‌کند
 * (`src/modules/export/services/zip.ts` — روش STORE)؛ این ماژول آن
 * ZIP را می‌خواند و ساختار پوشه data را بازسازی می‌کند تا
 * `extractData` بتواند آن را پردازش کند.
 *
 * فقط روش STORE (بدون فشرده‌سازی) پشتیبانی می‌شود — این دقیقاً همان
 * روشی است که export ما می‌نویسد (معادل server/export.js در Demo).
 */
import { readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_RECORD = 0x06054b50;

const decoder = new TextDecoder("utf-8");

export type ZipEntry = { name: string; data: Uint8Array };

/**
 * استخراج یک ZIP (روش STORE) به فهرست ورودی‌ها.
 *
 * @param bytes محتوای ZIP
 * @throws اگر ZIP ناقص باشد یا از روش فشرده‌سازی پشتیبانی‌نشده استفاده کرده باشد
 */
export function unzipStore(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries: ZipEntry[] = [];

  // یافتن end record (آخرین امضا).
  let endOffset = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === END_RECORD) {
      endOffset = i;
      break;
    }
  }
  if (endOffset < 0) throw new Error("ZIP نامعتبر — end record پیدا نشد");

  const centralSize = view.getUint32(endOffset + 12, true);
  const centralOffset = view.getUint32(endOffset + 16, true);

  let cursor = centralOffset;
  while (cursor < centralOffset + centralSize) {
    if (view.getUint32(cursor, true) !== CENTRAL_HEADER) break;
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));

    if (method !== 0) {
      throw new Error(`روش فشرده‌سازی پشتیبانی نمی‌شود (فقط STORE): ${name}`);
    }

    if (view.getUint32(localOffset, true) !== LOCAL_HEADER) {
      throw new Error(`local header نامعتبر برای ${name}`);
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const dataOffset = localOffset + 30 + localNameLength;
    entries.push({ name, data: bytes.slice(dataOffset, dataOffset + compressedSize) });

    cursor += 46 + nameLength;
  }
  return entries;
}

/**
 * خواندن ZIP از مسیر و بازنویسی آن در یک پوشه موقت با ساختار پوشه data.
 *
 * @param zipPath مسیر فایل ZIP
 * @returns مسیر پوشه استخراج‌شده — فراخواننده مسئول پاکسازی است
 */
export function extractZipToTemp(zipPath: string): string {
  const bytes = readFileSync(zipPath);
  const dest = join(tmpdir(), `barman-migration-${randomBytes(6).toString("hex")}`);
  mkdirSync(dest, { recursive: true });
  for (const entry of unzipStore(bytes)) {
    const target = join(dest, entry.name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, entry.data);
  }
  return dest;
}

/** پاکسازی پوشه موقت استخراج. */
export function cleanupExtracted(dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}
