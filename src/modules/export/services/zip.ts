/**
 * نوشتن ZIP حداقلی (فشرده‌سازی ذخیره — بدون وابستگی خارجی).
 *
 * معادل استراتژی Demo (server/export.js:6-27): ساختار ZIP استاندارد با
 * روش STORE و CRC32. نوشته‌شده در TypeScript مطابق همان الگو.
 */

const encoder = new TextEncoder();

/** جدول CRC32 — محاسبه یک‌باره در زمان بارگذاری. */
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const entry = CRC_TABLE[(c ^ (buf[i] ?? 0)) & 0xff];
    if (entry === undefined) throw new Error("CRC table corrupted");
    c = entry ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** زمان DOS از تاریخ میلادی (server/export.js:8). */
function dosTime(d: Date): { t: number; d: number } {
  return {
    t: ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff,
    d: (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff,
  };
}

export type ZipEntry = { name: string; data: Uint8Array };

/**
 * ساخت ZIP از فهرست ورودی‌ها — روش STORE (بدون فشرده‌سازی).
 *
 * ساختار: local header + نام + داده برای هر ورودی، سپس central
 * directory و end record — مطابق مشخص PKZIP.
 */
export function zipOf(entries: readonly ZipEntry[]): Uint8Array {
  const now = dosTime(new Date());
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);

    const lh = new Uint8Array(30);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // flags — UTF-8 names
    lv.setUint16(8, 0, true); // method — store
    lv.setUint16(10, now.t, true);
    lv.setUint16(12, now.d, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);

    const ch = new Uint8Array(46);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, now.t, true);
    cv.setUint16(14, now.d, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true); // relative offset of local header

    locals.push(lh, name, data);
    centrals.push(ch, name);
    offset += lh.length + name.length + data.length;
  }

  const central = concatenate(centrals);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, central.length, true);
  ev.setUint32(16, offset, true);

  return concatenate([...locals, central, end]);
}

function concatenate(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

/** تبدیل snapshot به فهرست ورودی ZIP — چیدمان پوشه data در Demo. */
export function snapshotEntries(snapshot: {
  meta: Record<string, unknown>;
  orders: Record<string, unknown>[];
  docs: Record<string, Record<string, unknown>[]>;
  seq: { kind: string; n: number }[];
}): ZipEntry[] {
  const json = (value: unknown): Uint8Array => encoder.encode(JSON.stringify(value));
  const entries: ZipEntry[] = [{ name: "meta.json", data: json(snapshot.meta) }];

  for (const order of snapshot.orders) {
    const id = typeof order["id"] === "string" ? order["id"] : "unknown";
    entries.push({ name: `orders/${id}.json`, data: json(order) });
  }
  for (const [collection, rows] of Object.entries(snapshot.docs)) {
    for (const row of rows) {
      const id = typeof row["id"] === "string" ? row["id"] : "unknown";
      entries.push({ name: `${collection}/${id}.json`, data: json(row) });
    }
  }
  for (const s of snapshot.seq) {
    entries.push({ name: `seq-${s.kind}.txt`, data: encoder.encode(String(s.n)) });
  }
  entries.push({
    name: "README.txt",
    data: encoder.encode(
      "خروجی داده بارمان — " +
        new Date().toISOString() +
        "\r\n" +
        "این پوشه همان ساختار پوشه data است: محتوای zip را در کنار برنامه بریزید.\r\n" +
        "برای وارد کردن دوباره، ابزار مهاجرت فاز ۸ استفاده می‌شود.\r\n",
    ),
  });

  return entries;
}
