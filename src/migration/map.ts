/**
 * مراحل ۲ و ۴ مهاجرت — تجزیه meta و نقشه‌گذاری موجودیت‌ها
 * (MIGRATION_STRATEGY §۳.۲ و §۳.۴).
 *
 * هر تصمیم نگاشت اینجا مستند است و هیچ قانون کسب‌وکاری اختراع نمی‌شود
 * (CLAUDE.md §۱۳). فیلدهایی که مدل هدف ندارند (مثل `accounts.city`،
 * `leads.area`، `orders.plan`) به‌صورت صریح در `droppedFields` گزارش
 * می‌شوند — **اصلاح ساکت ممنوع** (R-27).
 *
 * DESIGN: همه توابع خالص (pure) هستند — ورودی snapshot Demo، خروجی
 * ساختار داده آماده برای load. تست‌گذاری بدون پایگاه داده ممکن است.
 */
import { hashSync } from "bcryptjs";
import { BCRYPT_COST } from "@core/auth/passwords";
import type { RejectedRecord } from "./types";
import { normalizeDateOnly, normalizeInstant, chequeDue } from "./normalize";
import type {
  DemoAccount,
  DemoBuy,
  DemoHist,
  DemoJob,
  DemoLead,
  DemoLogEntry,
  DemoMeta,
  DemoMove,
  DemoOrder,
  DemoProduct,
} from "./demo-types";
import { ROLE_LABELS, ROLES } from "@core/permissions/matrix";

/**
 * کاربران پیش‌فرض Demo — app/core.js:122-131 (USERS0).
 *
 * `meta.json` در پوشه data فاقد users است (core.js:113: users() به
 * USERS0 برمی‌گردد) — این دقیقاً همان رفتار Demo است.
 */
export const DEMO_USERS_FALLBACK = [
  { id: "u1", name: "امیرعلی رحیمی", role: "management", title: "مدیرعامل" },
  { id: "u2", name: "شیما کریمی", role: "admin", title: "ادمین سیستم" },
  { id: "u3", name: "مهدی رضایی", role: "finance", title: "مالی" },
  { id: "u4", name: "علی توکلی", role: "salesManager", title: "مدیر فروش" },
  { id: "u5", name: "نگار صادقی", role: "sales", title: "کارشناس فروش" },
  { id: "u6", name: "رضا نوری", role: "sales", title: "کارشناس فروش" },
  { id: "u7", name: "حسین شریفی", role: "production", title: "مدیر تولید" },
  { id: "u8", name: "کاوه بهرامی", role: "depot", title: "مسئول انبار دپو" },
] as const;

/**
 * رمز عبور اولیه کاربران مهاجرت‌شده — «reset هماهنگ»
 * (MIGRATION_STRATEGY §۴ ریسک‌ها، PHASE_08 §۳.۲).
 *
 * Demo هیچ هش رمزی در data/ ذخیره نمی‌کند (ورود محلی با متغیرهای PASS_*
 * سرور است) — بنابراین انتقال هش ممکن نیست و اولین ورود با این رمز
 * انجام می‌شود. در MIGRATION_REPORT.md منتشر می‌شود.
 */
export const INITIAL_PASSWORD = "barman1405";

/** نوع حساب Demo → کلید مدل هدف (ACCOUNT_KINDS در customers). */
const ACCOUNT_KIND_MAP: Readonly<Record<string, string>> = {
  company: "customer",
  person: "customer",
  unknown: "unknown",
  customer: "customer",
  supplier: "supplier",
  partner: "partner",
};

/** وضعیت خرید Demo (fin-core.js:14) → چرخه وضعیت هدف (BUY_STATUSES). */
const BUY_STATUS_MAP: Readonly<Record<string, string>> = {
  draft: "req", // پیش‌نویس مدیر → درخواست (قابل ویرایش)
  req: "req", // درخواست کمبود از تولید
  fin: "ok", // منتظر پرداخت مالی → تأییدشده/ارسال به مالی
  wait: "fin", // پرداخت شد — منتظر کالا → تأمین مالی شده
  done: "recv", // وارد انبار شد
  disc: "recv", // مغایرت در ورود — اطلاعات در statusLog حفظ می‌شود
};

const DEMO_USERS_FALLBACK_MAP: Readonly<Record<string, { name: string; role: string; title: string }>> =
  Object.fromEntries(DEMO_USERS_FALLBACK.map((u) => [u.id, u]));

/** خروجی نقشه‌گذاری — تمام جداول هدف. */
export type MappedData = {
  roles: { key: string; name: string }[];
  users: {
    id: string;
    name: string;
    title: string;
    passwordHash: string | null;
    roles: string[];
    createdAt: number;
  }[];
  settings: {
    vat: number;
    validDays: number;
    rate: number;
    discountCap: unknown;
    company: unknown;
    updatedAt: number;
  } | null;
  lists: { key: string; items: unknown }[];
  suppliers: {
    id: string;
    name: string;
    kind: string;
    phone: string;
    terms: string;
    items: unknown;
    createdAt: number;
  }[];
  products: {
    id: string;
    code: string;
    name: string;
    line: string;
    category: string;
    unit: string;
    price: number;
    active: boolean;
    days: number;
    supplierId: string | null;
    colors: unknown;
    createdAt: number;
  }[];
  bom: { productId: string; materialId: string; qty: number }[];
  materials: {
    id: string;
    code: string;
    name: string;
    unit: string;
    price: number;
    min: number;
    createdAt: number;
  }[];
  accounts: {
    id: string;
    name: string;
    kind: string;
    active: boolean;
    address: string;
    note: string;
    createdAt: number;
    updatedAt: number;
  }[];
  phones: { id: string; accountId: string; kind: string; number: string }[];
  contacts: { id: string; accountId: string; name: string; role: string; phone: string }[];
  leads: {
    id: string;
    accountId: string | null;
    line: string;
    stage: string;
    title: string;
    amount: number | null;
    ownerId: string | null;
    source: string;
    note: string;
    lostReason: string | null;
    lostFrom: string | null;
    createdAt: number;
    updatedAt: number;
  }[];
  interests: { leadId: string; productId: string }[];
  followups: {
    id: string;
    leadId: string;
    at: number;
    kind: string;
    result: string;
    note: string;
    nextAt: string | null;
    byUserId: string | null;
  }[];
  orders: {
    id: string;
    accountId: string | null;
    contactId: string | null;
    leadId: string | null;
    line: string;
    stage: number;
    status: string;
    discPct: number;
    discAmt: number;
    ship: number;
    install: number;
    noVat: boolean;
    validDays: number;
    note: string;
    preset: string;
    skipped: unknown;
    planBuilder: unknown;
    backNote: unknown;
    smOk: unknown;
    mgrOk: unknown;
    due: number;
    stageAt: number;
    times: unknown;
    sent: unknown;
    prod: unknown;
    prep: unknown;
    delivered: unknown;
    agreed: unknown;
    cancelReason: string | null;
    ownerId: string | null;
    createdById: string | null;
    createdAt: number;
    updatedAt: number;
  }[];
  items: { id: string; orderId: string; productId: string; qty: number; price: number; discount: number; color: string }[];
  payments: {
    id: string;
    orderId: string;
    kind: string;
    amount: number;
    date: string;
    void: boolean;
    note: string;
    byUserId: string | null;
    createdAt: number;
  }[];
  cheques: {
    id: string;
    orderId: string;
    sayad: string;
    amount: number;
    due: string;
    status: string;
    bank: string;
    owner: string;
    note: string;
    createdAt: number;
    updatedAt: number;
  }[];
  stageLogs: {
    id: string;
    orderId: string;
    fromStage: number | null;
    toStage: number;
    at: number;
    byUserId: string | null;
    note: string;
    kind: string;
  }[];
  handoffs: { id: string; orderId: string; lines: unknown; at: number; byUserId: string | null; note: string }[];
  buys: {
    id: string;
    supplierId: string | null;
    status: string;
    total: number;
    note: string;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
  }[];
  buyItems: { id: string; buyId: string; materialId: string; qty: number; price: number }[];
  buyCheques: { id: string; buyId: string; amount: number; due: string; sayad: string | null; status: string }[];
  buyStatusLogs: {
    id: string;
    buyId: string;
    fromStatus: string | null;
    toStatus: string;
    at: number;
    byUserId: string | null;
    note: string | null;
  }[];
  jobs: {
    id: string;
    productId: string;
    qty: number;
    color: string | null;
    end: number | null;
    status: string;
    good: number | null;
    waste: number | null;
    startedAt: number | null;
    qcAt: number | null;
    recvQty: number | null;
    recvAt: number | null;
    bomSnapshot: unknown;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
  }[];
  moves: {
    id: string;
    wh: string;
    item: string;
    qty: number;
    kind: string;
    ref: string | null;
    at: number;
    byUserId: string | null;
    note: string;
  }[];
  /** فیلدهای Demo که مدل هدف ندارند — گزارش شفاف (R-27). */
  droppedFields: { collection: string; id: string; fields: string[] }[];
};

/**
 * نتیجه نقشه‌گذاری — فقط جداول موجودیت‌ها.
 * جداول کاتالوگ توسط mapMeta تولید می‌شوند و در run.ts ادغام می‌شوند.
 */
export type EntityData = Pick<
  MappedData,
  | "accounts" | "phones" | "contacts" | "leads" | "interests" | "followups"
  | "orders" | "items" | "payments" | "cheques" | "stageLogs" | "handoffs"
  | "buys" | "buyItems" | "buyCheques" | "buyStatusLogs" | "jobs" | "moves"
  | "droppedFields"
>;

/** نتیجه نقشه‌گذاری — داده + رد‌شده‌ها. */
export type MappingResult = {
  data: EntityData;
  rejected: RejectedRecord[];
};

/** تولید id یکتای ردیف‌های فرزند — Demo برای برخی ردیف‌ها id ندارد. */
function childId(parent: string, key: string, index: number, suffix = ""): string {
  return `${parent}-${key}-${index}${suffix}`;
}

// ---------------------------------------------------------------------------
// مرحله ۲ — تجزیه meta
// ---------------------------------------------------------------------------

/**
 * تجزیه meta.json → کاربران، نقش‌ها، کاتالوگ، فهرست‌ها، تنظیمات.
 *
 * @param meta محتوای meta.json (می‌تواند ناقص باشد — Demo همیشه کامل نیست)
 * @param fallbackUsers کاربران پیش‌فرض وقتی meta.users وجود ندارد
 */
export function mapMeta(meta: unknown, fallbackUsers: readonly { id: string; name: string; role: string; title?: string }[] = DEMO_USERS_FALLBACK): {
  roles: MappedData["roles"];
  users: MappedData["users"];
  settings: MappedData["settings"];
  lists: MappedData["lists"];
  suppliers: MappedData["suppliers"];
  products: MappedData["products"];
  bom: MappedData["bom"];
  materials: MappedData["materials"];
  droppedFields: MappedData["droppedFields"];
} {
  const m = isRecord(meta) ? (meta as DemoMeta) : {};
  const now = Date.now();
  const droppedFields: MappedData["droppedFields"] = [];

  const roles = ROLES.map((key) => ({ key, name: ROLE_LABELS[key] }));

  const metaUsers = Array.isArray(m.users) ? m.users : [];
  const users: MappedData["users"] = (metaUsers.length > 0 ? metaUsers : fallbackUsers).map((u) => {
    const role = typeof u.role === "string" && (ROLES as readonly string[]).includes(u.role) ? u.role : "sales";
    return {
      id: String(u.id),
      name: String(u.name ?? u.id),
      title: String(u.title ?? ""),
      // Demo هش رمز ذخیره نمی‌کند — reset هماهنگ (MIGRATION_STRATEGY §۴).
      passwordHash: hashSync(INITIAL_PASSWORD, 10),
      roles: [role],
      createdAt: 0,
    };
  });

  const settingsRaw = isRecord(m.settings) ? (m.settings as DemoMeta["settings"]) : {};
  const settings: MappedData["settings"] = {
    vat: Number(settingsRaw?.vat ?? 0) || 0,
    validDays: Number(settingsRaw?.validDays ?? 0) || 0,
    // Q-01 (تصمیم نهایی فاز ۸): rate در Demo فقط تعریف شده و هرگز خوانده
    // نمی‌شود — مقدار منتقل می‌شود بدون اختراع قانون.
    rate: Number(settingsRaw?.rate ?? 0) || 0,
    discountCap: settingsRaw?.discountCap ?? {},
    company: settingsRaw?.company ?? {},
    updatedAt: now,
  };

  const cat = isRecord(m.cat) ? (m.cat as DemoMeta["cat"]) : {};
  // در Demo ثابت‌های کسب‌کار داخل meta.cat.lists هستند (app/data.js).
  const listsRaw = isRecord(cat?.lists) ? (cat!.lists as Record<string, string[]>) : {};
  const lists: MappedData["lists"] = Object.entries(listsRaw)
    .filter(([, items]) => Array.isArray(items))
    .map(([key, items]) => ({ key, items }));

  const materials: MappedData["materials"] = (cat?.materials ?? []).map((mat) => ({
    id: String(mat.id),
    code: String(mat.code ?? mat.id),
    name: String(mat.name ?? ""),
    unit: String(mat.unit ?? ""),
    price: Number(mat.price ?? 0) || 0,
    min: Number(mat?.min ?? 0) || 0,
    createdAt: now,
  }));
  const materialIds = new Set(materials.map((x) => x.id));

  const suppliers: MappedData["suppliers"] = (cat?.suppliers ?? []).map((sup) => ({
    id: String(sup.id),
    name: String(sup.name ?? ""),
    kind: String(sup.kind ?? "raw"),
    phone: String(sup?.phone ?? ""),
    terms: String(sup?.terms ?? ""),
    items: Array.isArray(sup?.items) ? sup.items : [],
    createdAt: now,
  }));
  const supplierIds = new Set(suppliers.map((x) => x.id));

  const products: MappedData["products"] = (cat?.products ?? []).map((p) => {
    const supplierId = typeof p?.sup === "string" && supplierIds.has(p.sup) ? p.sup : null;
    return {
      id: String(p.id),
      code: String(p.code ?? p.id),
      name: String(p.name ?? ""),
      line: String(p.line ?? "prod"),
      category: String(p.cat ?? ""),
      unit: String(p.unit ?? ""),
      price: Number(p.price ?? 0) || 0,
      active: p?.active !== false,
      days: Number(p?.days ?? 0) || 0,
      supplierId,
      colors: Array.isArray(p?.colors) ? p.colors : [],
      createdAt: now,
    };
  });

  const bom: MappedData["bom"] = [];
  for (const p of cat?.products ?? []) {
    for (const entry of p?.bom ?? []) {
      const materialId = String(entry?.m ?? "");
      if (!materialIds.has(materialId)) {
        droppedFields.push({
          collection: "products",
          id: String(p.id),
          fields: [`bom[].m=${materialId} (ماده ناموجود)`],
        });
        continue;
      }
      bom.push({ productId: String(p.id), materialId, qty: Number(entry?.q ?? 0) || 0 });
    }
  }
  if (m.feed) droppedFields.push({ collection: "meta", id: "meta.json", fields: ["feed (مدل هدف وجود ندارد)"] });

  return { roles, users, settings, lists, suppliers, products, bom, materials, droppedFields };
}

// ---------------------------------------------------------------------------
// مرحله ۴ — نقشه‌گذاری موجودیت‌ها
// ---------------------------------------------------------------------------

/**
 * کاتالوگ موجود برای محاسبه bomSnapshot کارهای تولید (مرحله ۵ — PHASE_05 §۶).
 */
export type Catalog = {
  products: MappedData["products"];
  materials: MappedData["materials"];
  bom: MappedData["bom"];
};

/**
 * نقشه‌گذاری همه موجودیت‌های پوشه data → ساختار هدف.
 *
 * @param docs مجموعه‌های استخراج‌شده (extract.ts)
 * @param catalog کاتالوگ meta (برای bomSnapshot کار تولید) — اختیاری
 */
export function mapEntities(
  docs: {
    accounts: unknown[];
    leads: unknown[];
    orders: unknown[];
    buys: unknown[];
    jobs: unknown[];
    moves: unknown[];
  },
  catalog: Catalog = { products: [], materials: [], bom: [] },
): MappingResult {
  const rejected: RejectedRecord[] = [];
  const droppedFields: MappedData["droppedFields"] = [];

  // --- accounts ---
  const accounts: MappedData["accounts"] = [];
  const phones: MappedData["phones"] = [];
  const contacts: MappedData["contacts"] = [];
  for (const raw of docs.accounts) {
    const a = raw as DemoAccount;
    if (!isRecord(raw) || typeof a.id !== "string" || a.id.length === 0) {
      rejected.push({ collection: "accounts", id: "?", step: "map", reason: "سند فاقد شناسه است" });
      continue;
    }
    const kind = ACCOUNT_KIND_MAP[String(a.kind ?? "unknown")] ?? null;
    if (kind === null) {
      rejected.push({
        collection: "accounts",
        id: a.id,
        step: "map",
        reason: `نوع حساب پشتیبانی نمی‌شود: ${String(a.kind)}`,
      });
      continue;
    }
    const created = normalizeInstant(a.created) ?? 0;
    accounts.push({
      id: a.id,
      name: String(a.name ?? ""),
      kind,
      active: true,
      address: "",
      note: "",
      createdAt: created,
      updatedAt: created,
    });
    for (const [i, number] of (a.phones ?? []).entries()) {
      if (typeof number !== "string" || number.length === 0) continue;
      phones.push({ id: childId(a.id, "ph", i), accountId: a.id, kind: "", number });
    }
    for (const [i, c] of (a.contacts ?? []).entries()) {
      if (!isRecord(c) || typeof c.name !== "string" || c.name.length === 0) continue;
      contacts.push({
        // شناسه Demo (مثل c90) برای ارجاع orders.contact حفظ می‌شود.
        id: typeof c.id === "string" && c.id.length > 0 ? c.id : childId(a.id, "ct", i),
        accountId: a.id,
        name: c.name,
        role: String(c.role ?? ""),
        phone: String(c.phone ?? ""),
      });
    }
    const dropped: string[] = [];
    if (a.city) dropped.push("city");
    if (a.src) dropped.push("src");
    if (a.owner) dropped.push("owner");
    if (dropped.length > 0) droppedFields.push({ collection: "accounts", id: a.id, fields: dropped });
  }

  // --- leads ---
  const leads: MappedData["leads"] = [];
  const interests: MappedData["interests"] = [];
  const followups: MappedData["followups"] = [];
  for (const raw of docs.leads) {
    const l = raw as DemoLead;
    if (!isRecord(raw) || typeof l.id !== "string" || l.id.length === 0) {
      rejected.push({ collection: "leads", id: "?", step: "map", reason: "سند فاقد شناسه است" });
      continue;
    }
    const created = normalizeInstant(l.created) ?? 0;
    const updated = normalizeInstant(l.updated) ?? created;
    leads.push({
      id: l.id,
      accountId: typeof l.acct === "string" && l.acct.length > 0 ? l.acct : null,
      line: String(l.line ?? "prod"),
      stage: String(l.stage ?? "raw"),
      title: String(l.project ?? ""),
      // مقدار ۰ در Demo یعنی «نامشخص» — nullable نگه داشته می‌شود.
      amount: typeof l.value === "number" && l.value > 0 ? l.value : null,
      ownerId: typeof l.owner === "string" && l.owner.length > 0 ? l.owner : null,
      source: String(l.src ?? ""),
      note: String(l.note ?? ""),
      lostReason: typeof l.lostWhy === "string" && l.lostWhy.length > 0 ? l.lostWhy : null,
      lostFrom: typeof l.lostFrom === "string" && l.lostFrom.length > 0 ? l.lostFrom : null,
      createdAt: created,
      updatedAt: updated,
    });
    for (const pid of l.interest ?? []) {
      if (typeof pid === "string") interests.push({ leadId: l.id, productId: pid });
    }
    for (const [i, h] of (l.hist ?? []).entries()) {
      const entry = mapHist(l.id, i, h);
      if (entry !== null) followups.push(entry);
    }
    // پیگیری بعدی (Demo: next) → یک رویداد پیگیری با nextAt.
    if (isRecord(l.next) && typeof l.next["t"] === "number") {
      const nextAt = normalizeDateOnly(l.next["t"]);
      if (nextAt !== null) {
        followups.push({
          id: childId(l.id, "nx", 0),
          leadId: l.id,
          at: updated,
          kind: "note",
          result: "",
          note: String(l.next["what"] ?? ""),
          nextAt,
          byUserId: typeof l.owner === "string" ? l.owner : null,
        });
      }
    }
    const dropped: string[] = [];
    if (l.srcNote) dropped.push("srcNote");
    if (typeof l.area === "number" && l.area > 0) dropped.push("area");
    if (typeof l.prob === "number" && l.prob > 0) dropped.push("prob");
    if (typeof l.tries === "number" && l.tries > 0) dropped.push("tries");
    if (l.sub || l.subs) dropped.push("sub/subs (زیرمرحله)");
    if (l.order) dropped.push("order (ارجاع از سمت سفارش حفظ می‌شود)");
    if (dropped.length > 0) droppedFields.push({ collection: "leads", id: l.id, fields: dropped });
  }

  // --- orders ---
  const orders: MappedData["orders"] = [];
  const items: MappedData["items"] = [];
  const payments: MappedData["payments"] = [];
  const cheques: MappedData["cheques"] = [];
  const stageLogs: MappedData["stageLogs"] = [];
  const handoffs: MappedData["handoffs"] = [];
  for (const raw of docs.orders) {
    const o = raw as DemoOrder;
    if (!isRecord(raw) || typeof o.id !== "string" || o.id.length === 0) {
      rejected.push({ collection: "orders", id: "?", step: "map", reason: "سند فاقد شناسه است" });
      continue;
    }
    const created = normalizeInstant(o.created) ?? 0;
    const stageAt = normalizeInstant(o.stageAt) ?? created;
    const lastLogT = (o.log ?? []).reduce((max, e) => Math.max(max, normalizeInstant(e.t) ?? 0), 0);
    const status: string = o.cancelled ? "cancelled" : o.closed ? "done" : "open";
    const times = isRecord(o.times) ? o.times : {};
    const prod = mapProd(o, droppedFields);
    orders.push({
      id: o.id,
      accountId: typeof o.acct === "string" && o.acct.length > 0 ? o.acct : null,
      contactId: typeof o.contact === "string" && o.contact.length > 0 ? o.contact : null,
      leadId: typeof o.lead === "string" && o.lead.length > 0 ? o.lead : null,
      line: String(o.line ?? "prod"),
      stage: Number(o.stage ?? 1) || 1,
      status,
      discPct: Number(o.discPct ?? 0) || 0,
      discAmt: Number(o.discAmt ?? 0) || 0,
      ship: Number(o.ship ?? 0) || 0,
      install: Number(o.install ?? 0) || 0,
      noVat: o.noVat === true,
      validDays: Number(o.validDays ?? 3) || 3,
      note: String(o.note ?? ""),
      preset: String(o.preset ?? ""),
      skipped: Array.isArray(o.skipped) ? o.skipped : [],
      planBuilder: isRecord(o.pb) ? o.pb : null,
      backNote: isRecord(o.backNote) ? o.backNote : null,
      smOk: isRecord(o.smOk) ? o.smOk : null,
      mgrOk: isRecord(o.mgrOk) ? o.mgrOk : null,
      due: normalizeInstant(o.due) ?? 0,
      stageAt,
      times,
      sent:
        Array.isArray(o.sentVia) && o.sentVia.length > 0
          ? { via: o.sentVia.join("،"), at: normalizeInstant(o.sentAt) ?? created }
          : null,
      prod: prod.mapped,
      prep: mapPrep(o),
      delivered: isRecord(o.delivered)
        ? { t: normalizeInstant(o.delivered["t"]) ?? 0, to: String(o.delivered["to"] ?? "") }
        : null,
      agreed: isRecord(o.agreed)
        ? { t: normalizeInstant(o.agreed["t"]) ?? 0, how: String(o.agreed["how"] ?? ""), note: String(o.agreed["note"] ?? "") }
        : null,
      cancelReason: typeof o.cancelReason === "string" && o.cancelReason.length > 0 ? o.cancelReason : null,
      ownerId: typeof o.owner === "string" && o.owner.length > 0 ? o.owner : null,
      // Demo فقط owner دارد — ایجادکننده همان مالک ثبت می‌شود.
      createdById: typeof o.owner === "string" && o.owner.length > 0 ? o.owner : null,
      createdAt: created,
      updatedAt: Math.max(stageAt, created, lastLogT),
    });

    const colorOf = new Map((o.items ?? []).map((it) => [String(it.pid), String(it.color ?? "")]));
    for (const [i, it] of (o.items ?? []).entries()) {
      if (!isRecord(it) || typeof it.pid !== "string") continue;
      items.push({
        id: childId(o.id, "it", i),
        orderId: o.id,
        productId: String(it.pid),
        qty: Number(it.qty ?? 0) || 0,
        price: Number(it.price ?? 0) || 0,
        // اقلام Demo تخفیف قلم ندارند (order.js — فاز ۴ §۶).
        discount: 0,
        color: String(it.color ?? ""),
      });
    }

    for (const r of o.receipts ?? []) {
      if (!isRecord(r)) continue;
      const t = normalizeInstant(r.t) ?? created;
      const kind = String(r.kind ?? "");
      if (kind === "cash") {
        const date = normalizeDateOnly(r.t);
        if (date === null) {
          rejected.push({
            collection: "orders",
            id: o.id,
            step: "normalize",
            reason: `رسید ${String(r.id ?? "?")} تاریخ قابل تجزیه ندارد`,
          });
          continue;
        }
        payments.push({
          // شناسه رسیدها در Demo به‌ازای هر سفارش تکرار می‌شوند (r1, r2) —
          // پیشوند سفارش یکتایی سراسری می‌سازد.
          id: typeof r.id === "string" ? `${o.id}-${r.id}` : childId(o.id, "pay", payments.length),
          orderId: o.id,
          kind: "cash",
          amount: Number(r.amount ?? 0) || 0,
          date,
          void: false,
          note: String(r.ref ?? ""),
          byUserId: typeof r.by === "string" ? r.by : null,
          createdAt: t,
        });
      } else if (kind === "cheque") {
        const chq = isRecord(r.chq) ? r.chq : {};
        const due = chequeDue(chq["due"], r.due ?? r.t);
        if (due === null) {
          rejected.push({
            collection: "orders",
            id: o.id,
            step: "normalize",
            reason: `چک ${String(r.id ?? "?")} سررسید قابل تجزیه ندارد`,
          });
          continue;
        }
        const status = String(chq["status"] ?? "hand");
        cheques.push({
          id: typeof r.id === "string" ? `${o.id}-${r.id}` : childId(o.id, "chq", cheques.length),
          orderId: o.id,
          sayad: String(chq["sayad"] ?? ""),
          amount: Number(r.amount ?? 0) || 0,
          due,
          status: ["hand", "bank", "clear", "bounce"].includes(status) ? status : "hand",
          bank: String(chq["bank"] ?? ""),
          owner: String(chq["owner"] ?? ""),
          note: String(r.ref ?? ""),
          createdAt: t,
          updatedAt: t,
        });
      } else {
        rejected.push({
          collection: "orders",
          id: o.id,
          step: "map",
          reason: `رسید با نوع ناشناخته: ${kind}`,
        });
      }
    }

    for (const [i, e] of deriveStageLogs(o).entries()) {
      stageLogs.push({ id: childId(o.id, "sl", i), orderId: o.id, ...e });
    }

    const handoff = o.prod?.handoff;
    if (isRecord(handoff) && typeof handoff.id === "string") {
      const lines = Array.isArray(handoff.lines)
        ? handoff.lines
        : Array.isArray(o.prod?.lines)
          ? o.prod!.lines
          : [];
      handoffs.push({
        id: handoff.id, // شناسه TR- بدون تغییر منتقل می‌شود (R-12)
        orderId: o.id,
        lines: lines
          .filter((ln) => isRecord(ln) && typeof ln["pid"] === "string")
          .map((ln) => ({
            productId: String(ln!["pid"]),
            qty: Number(ln!["qty"] ?? 0) || 0,
            color: colorOf.get(String(ln!["pid"])) ?? "",
          })),
        at: normalizeInstant(handoff.t) ?? normalizeInstant(o.prod?.qc?.t) ?? stageAt,
        byUserId: typeof handoff.recv?.by === "string" ? handoff.recv.by : null,
        note: "",
      });
    }

    const dropped: string[] = [];
    if (Array.isArray(o.plan) && o.plan.length > 0) dropped.push("plan (برنامه پرداخت — رسیدها منتقل می‌شوند)");
    if (o.resv && Object.keys(o.resv as object).length > 0) dropped.push("resv (Q-04 معوق)");
    if (Array.isArray(o.agencyShort) && o.agencyShort.length > 0) dropped.push("agencyShort");
    if (isRecord(o.prod) && typeof o.prod.shortReq === "string") dropped.push(`prod.shortReq=${o.prod.shortReq}`);
    if (isRecord(o.delivered) && typeof o.delivered["by"] === "string") dropped.push("delivered.by");
    if (isRecord(o.agreed)) {
      if (typeof o.agreed["by"] === "string") dropped.push("agreed.by");
      if (o.agreed["diff"] !== undefined) dropped.push("agreed.diff");
    }
    if (dropped.length > 0) droppedFields.push({ collection: "orders", id: o.id, fields: dropped });
  }

  // --- buys ---
  const buys: MappedData["buys"] = [];
  const buyItems: MappedData["buyItems"] = [];
  const buyCheques: MappedData["buyCheques"] = [];
  const buyStatusLogs: MappedData["buyStatusLogs"] = [];
  for (const raw of docs.buys) {
    const b = raw as DemoBuy;
    if (!isRecord(raw) || typeof b.id !== "string" || b.id.length === 0) {
      rejected.push({ collection: "buys", id: "?", step: "map", reason: "سند فاقد شناسه است" });
      continue;
    }
    // خرید آژانسی (کالای نمایندگی) — BuyItem فقط مواد خام را پشتیبانی
    // می‌کند (schema فاز ۶)؛ بدون اصلاح ساکت رد می‌شود.
    if (b.kind === "agency") {
      rejected.push({
        collection: "buys",
        id: b.id,
        step: "map",
        reason: "خرید آژانسی — BuyItem فقط مواد خام را پشتیبانی می‌کند (schema فاز ۶)",
      });
      continue;
    }
    const status = BUY_STATUS_MAP[String(b.status ?? "")] ?? null;
    if (status === null) {
      rejected.push({
        collection: "buys",
        id: b.id,
        step: "map",
        reason: `وضعیت خرید پشتیبانی نمی‌شود: ${String(b.status)}`,
      });
      continue;
    }
    const created = normalizeInstant(b.created) ?? 0;
    const lines = (b.lines ?? []).filter((ln) => isRecord(ln));
    const total = lines.reduce((sum, ln) => sum + (Number(ln.qty ?? 0) || 0) * (Number(ln.price ?? 0) || 0), 0);
    const lastLogT = (b.log ?? []).reduce((max, e) => Math.max(max, normalizeInstant(e.t) ?? 0), 0);
    buys.push({
      id: b.id,
      supplierId: typeof b.sup === "string" && b.sup.length > 0 ? b.sup : null,
      status,
      total,
      note: String(b.note ?? ""),
      createdBy: typeof b.by === "string" && b.by.length > 0 ? b.by : "u1",
      createdAt: created,
      updatedAt: Math.max(created, lastLogT),
    });
    for (const [i, ln] of lines.entries()) {
      buyItems.push({
        id: childId(b.id, "li", i),
        buyId: b.id,
        materialId: String(ln.item ?? ""),
        qty: Number(ln.qty ?? 0) || 0,
        price: Number(ln.price ?? 0) || 0,
      });
    }
    for (const p of b.payments ?? []) {
      if (!isRecord(p) || String(p.kind ?? "") !== "cheque") {
        // پرداخت نقدی خرید در مدل هدف وجود دارد؟ خیر — BuyCheque فقط چک
        // است؛ پرداخت نقدی در statusLog/مجموع حفظ می‌شود.
        if (isRecord(p)) {
          droppedFields.push({
            collection: "buys",
            id: b.id,
            fields: [`payments[].cash (${String(p.id ?? "?")} — مدل هدف ندارد)`],
          });
        }
        continue;
      }
      const chq = isRecord(p.chq) ? p.chq : {};
      const due = chequeDue(chq["due"], p.t);
      if (due === null) {
        rejected.push({
          collection: "buys",
          id: b.id,
          step: "normalize",
          reason: `چک خرید ${String(p.id ?? "?")} سررسید قابل تجزیه ندارد`,
        });
        continue;
      }
      buyCheques.push({
        id: typeof p.id === "string" ? `${b.id}-${p.id}` : childId(b.id, "bc", buyCheques.length),
        buyId: b.id,
        amount: Number(p.amount ?? 0) || 0,
        due,
        sayad: typeof chq["sayad"] === "string" && chq["sayad"].length > 0 ? chq["sayad"] : null,
        status: chq["status"] === "paid" ? "paid" : "issued",
      });
    }
    for (const [i, e] of deriveBuyStatusLogs(b, status).entries()) {
      buyStatusLogs.push({ id: childId(b.id, "st", i), buyId: b.id, ...e });
    }
    if (isRecord(b.recv) && typeof b.recv["note"] === "string" && b.recv["note"].length > 0) {
      droppedFields.push({ collection: "buys", id: b.id, fields: ["recv.note"] });
    }
    if (isRecord(b.pay) && typeof b.pay["method"] === "string") {
      droppedFields.push({ collection: "buys", id: b.id, fields: ["pay.method/note"] });
    }
  }

  // --- jobs ---
  const jobs: MappedData["jobs"] = [];
  const materialById = new Map(catalog.materials.map((m) => [m.id, m] as const));
  const bomByProduct = new Map<string, MappedData["bom"]>(
    Object.entries(
      catalog.bom.reduce<Record<string, MappedData["bom"]>>((acc, entry) => {
        (acc[entry.productId] ??= []).push(entry);
        return acc;
      }, {}),
    ),
  );
  for (const raw of docs.jobs) {
    const j = raw as DemoJob;
    if (!isRecord(raw) || typeof j.id !== "string" || j.id.length === 0) {
      rejected.push({ collection: "jobs", id: "?", step: "map", reason: "سند فاقد شناسه است" });
      continue;
    }
    const created = normalizeInstant(j.created) ?? 0;
    const qty = Number(j.qty ?? 0) || 0;
    jobs.push({
      id: j.id,
      productId: String(j.pid ?? ""),
      qty,
      color: typeof j.color === "string" && j.color.length > 0 ? j.color : null,
      end: normalizeInstant(j.end),
      status: String(j.status ?? "plan"),
      good: typeof j.good === "number" ? j.good : null,
      waste: typeof j.waste === "number" ? j.waste : null,
      startedAt: normalizeInstant(j.startedAt),
      qcAt: normalizeInstant(j.qcAt),
      recvQty: null,
      recvAt: null,
      // پیش‌نمایش BOM در زمان ایجاد — از کاتالوگ محاسبه می‌شود (PHASE_05 §۶).
      bomSnapshot: bomSnapshotOf(String(j.pid ?? ""), qty, bomByProduct, materialById),
      createdBy: typeof j.by === "string" && j.by.length > 0 ? j.by : "u1",
      createdAt: created,
      updatedAt: created,
    });
  }

  // --- moves ---
  const moves: MappedData["moves"] = [];
  for (const raw of docs.moves) {
    const mv = raw as DemoMove;
    if (!isRecord(raw) || typeof mv.id !== "string" || mv.id.length === 0) {
      rejected.push({ collection: "moves", id: "?", step: "map", reason: "سند فاقد شناسه است" });
      continue;
    }
    moves.push({
      id: mv.id,
      wh: String(mv.wh ?? "raw"),
      item: String(mv.item ?? ""),
      qty: Number(mv.qty ?? 0) || 0,
      kind: String(mv.kind ?? ""),
      ref: typeof mv.ref === "string" && mv.ref.length > 0 ? mv.ref : null,
      at: normalizeInstant(mv.t) ?? 0,
      byUserId: typeof mv.by === "string" && mv.by.length > 0 ? mv.by : null,
      note: String(mv.note ?? ""),
    });
  }

  return {
    data: {
      accounts,
      phones,
      contacts,
      leads,
      interests,
      followups,
      orders,
      items,
      payments,
      cheques,
      stageLogs,
      handoffs,
      buys,
      buyItems,
      buyCheques,
      buyStatusLogs,
      jobs,
      moves,
      droppedFields,
    },
    rejected,
  };
}

// --- کمک‌ها ----------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** hist سرنخ → رویداد پیگیری. */
function mapHist(
  leadId: string,
  index: number,
  hist: unknown,
): MappedData["followups"][number] | null {
  const h = hist as DemoHist;
  if (!isRecord(hist)) return null;
  const kindRaw = String(h.kind ?? "note");
  // Demo: in (ورود) | call (تماس) | stage (جابه‌جایی) — هدف: in | stage | note.
  const kind = kindRaw === "in" || kindRaw === "stage" ? kindRaw : "note";
  return {
    id: typeof h.id === "string" && h.id.length > 0 ? h.id : childId(leadId, "fh", index),
    leadId,
    at: normalizeInstant(h.t) ?? 0,
    kind,
    result: String(h.result ?? ""),
    note: String(h.text ?? ""),
    nextAt: null,
    byUserId: typeof h.who === "string" && h.who.length > 0 ? h.who : null,
  };
}

/**
 * o.prod → شکل هدف.
 *
 * Demo: prod {lines, start, end, acceptedAt, startedAt, qc{t,good{},waste{}}, handoff, shortReq}
 * هدف: {start, end, acceptedAt, startedAt, note, qc{good, waste, why}, used}
 */
function mapProd(
  o: DemoOrder,
  droppedFields: MappedData["droppedFields"],
): { mapped: MappedData["orders"][number]["prod"] } {
  const p = o.prod;
  if (!isRecord(p)) return { mapped: null };
  const start = normalizeDateOnly(p.start);
  const end = normalizeDateOnly(p.end);
  const qc = isRecord(p.qc) ? p.qc : null;
  const good = qc && isRecord(qc.good) ? Object.values(qc.good).reduce((a, b) => a + (Number(b) || 0), 0) : 0;
  const waste = qc && isRecord(qc.waste) ? Object.values(qc.waste).reduce((a, b) => a + (Number(b) || 0), 0) : 0;
  if (typeof p.shortReq === "string" && p.shortReq.length > 0) {
    droppedFields.push({ collection: "orders", id: o.id, fields: [`prod.shortReq=${p.shortReq}`] });
  }
  return {
    mapped: {
      start: start ?? "",
      end: end ?? "",
      acceptedAt: normalizeInstant(p.acceptedAt),
      startedAt: normalizeInstant(p.startedAt),
      note: String(p.note ?? ""),
      // QC جمع‌جبری per-product Demo → اعداد کلی هدف.
      qc: qc !== null ? { good, waste, why: "" } : null,
      used: null,
    },
  };
}

/** prep — Demo ممکن است فقط prepAt داشته باشد (PF-1201). */
function mapPrep(o: DemoOrder): MappedData["orders"][number]["prep"] {
  const p = o.prep;
  if (isRecord(p)) {
    return {
      t: normalizeInstant(p.t) ?? 0,
      packs: Number(p.packs ?? 0) || 0,
      checks: Array.isArray(p.checks) ? p.checks.filter((x): x is string => typeof x === "string") : [],
      note: String(p.note ?? ""),
    };
  }
  const prepAt = normalizeInstant(o.prepAt);
  return prepAt !== null ? { t: prepAt, packs: 0, checks: [], note: "" } : null;
}

/**
 * مشتق تاریخچه انتقال مراحل از `times` و `log` (R-28 / order.js log()).
 *
 * `log` Demo شماره مرحله ندارد؛ مرحله هر ورودی از `times` استنتاج
 * می‌شود: مرحله در زمان t = آخرین stage k با times[k] ≤ t.
 */
function deriveStageLogs(
  o: DemoOrder,
): Omit<MappedData["stageLogs"][number], "id" | "orderId">[] {
  const times = isRecord(o.times) ? (o.times as Record<string, number>) : {};
  const stageTimes = Object.entries(times)
    .map(([k, t]) => ({ stage: Number(k), t: Number(t) }))
    .filter((x) => Number.isInteger(x.stage) && Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t);

  const logs = (o.log ?? []).slice().sort((a, b) => (normalizeInstant(a.t) ?? 0) - (normalizeInstant(b.t) ?? 0));
  let prevStage: number | null = null;
  const out: Omit<MappedData["stageLogs"][number], "id" | "orderId">[] = [];

  for (const [i, entry] of logs.entries()) {
    const e = entry as DemoLogEntry;
    const t = normalizeInstant(e.t) ?? 0;
    const toStage = stageAtTime(stageTimes, t) ?? (Number(o.stage ?? 1) || 1);
    const fromStage = prevStage;
    prevStage = toStage;
    out.push({
      fromStage,
      toStage,
      at: t,
      byUserId: typeof e.who === "string" && e.who.length > 0 ? e.who : null,
      note: String(e.text ?? ""),
      kind: inferStageKind(e.text, fromStage, toStage, i === logs.length - 1, o),
    });
  }
  return out;
}

/** آخرین مرحله‌ای که تا زمان t طی شده. */
function stageAtTime(stageTimes: { stage: number; t: number }[], t: number): number | null {
  let result: number | null = null;
  for (const x of stageTimes) {
    if (x.t <= t) result = x.stage;
  }
  return result;
}

/** نوع انتقال از متن ورودی log — معادل kinds در Demo (core.js:172). */
function inferStageKind(
  text: string,
  fromStage: number | null,
  toStage: number,
  isLast: boolean,
  o: DemoOrder,
): string {
  if (/لغو/.test(text)) return "cancel";
  if (/بازگشت/.test(text)) return "back";
  if (fromStage !== null && toStage > fromStage + 1) return "skip";
  if (isLast && o.closed === true && toStage === 11) return "done";
  return "stage";
}

/**
 * مشتق تاریخچه وضعیت خرید از متن log (fin-core.js:35 log()).
 *
 * وضعیت نهایی خرید از وضعیت Demo نگاشت می‌شود؛ اگر متن آخرین ورودی
 * به آن نرسد، آخرین ورقه به وضعیت نهایی تصحیح می‌شود (شفاف در گزارش).
 */
function deriveBuyStatusLogs(
  b: DemoBuy,
  finalStatus: string,
): Omit<MappedData["buyStatusLogs"][number], "id" | "buyId">[] {
  const logs = (b.log ?? []).slice().sort((a, b2) => (normalizeInstant(a.t) ?? 0) - (normalizeInstant(b2.t) ?? 0));
  let prev: string | null = null;
  const out: Omit<MappedData["buyStatusLogs"][number], "id" | "buyId">[] = [];

  for (const [i, entry] of logs.entries()) {
    const t = normalizeInstant(entry.t) ?? 0;
    let to = inferBuyStatus(String(entry.text ?? ""), prev);
    if (i === logs.length - 1 && to !== finalStatus) to = finalStatus;
    out.push({
      fromStatus: prev,
      toStatus: to,
      at: t,
      byUserId: typeof entry.who === "string" && entry.who.length > 0 ? entry.who : null,
      note: String(entry.text ?? ""),
    });
    prev = to;
  }
  return out;
}

/** نگاشت متن log خرید → وضعیت (الگوی ثابت Demo — fin-core.js). */
function inferBuyStatus(text: string, prev: string | null): string {
  if (/به مالی فرستاده شد/.test(text)) return "ok";
  if (/مالی .* پرداخت کرد|پرداخت\/?تأیید کرد/.test(text)) return "fin";
  if (/وارد انبار شد|رسید/.test(text)) return "recv";
  if (/ثبت شد/.test(text)) return "req";
  return prev ?? "req";
}


/**
 * پیش‌نمایش BOM کار تولید — معادل `bomSnapshot` در سرویس فاز ۵.
 *
 * هر ورودی: {materialId, code, name, unit, qty (مصرف کل), total}.
 * اگر محصول BOM نداشته باشد، آرایه خالی برمی‌گردد (محصول آژانسی).
 */
function bomSnapshotOf(
  productId: string,
  qty: number,
  bomByProduct: Map<string, MappedData["bom"]>,
  materialById: Map<string, MappedData["materials"][number]>,
): MappedData["jobs"][number]["bomSnapshot"] {
  const entries = bomByProduct.get(productId) ?? [];
  return entries
    .map((entry) => {
      const material = materialById.get(entry.materialId);
      if (material === undefined) return null;
      const used = round3(entry.qty * qty);
      return {
        materialId: material.id,
        code: material.code,
        name: material.name,
        unit: material.unit,
        qty: used,
        total: used,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

/** گردکردن سه رقم اعشار (مصرف BOM اعشاری است — PHASE_05 §۶). */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
