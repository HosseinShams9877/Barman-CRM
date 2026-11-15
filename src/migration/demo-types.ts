/**
 * اشکال ساختار یافته اسناد Demo — ورودی مهاجرت (MIGRATION_STRATEGY §۳).
 *
 * این انواع فقط ستون‌هایی را اعلام می‌کنند که مهاجرت می‌خواند.
 * هر ستون اضافی Demo که مدل هدف ندارد، در `map.ts` به‌صورت صریح
 * گزارش «فیلد رهاشده» می‌شود (اصلاح ساکت ممنوع — R-27).
 */

/** meta.json — nucleus داده Demo (core.js meta()). */
export type DemoMeta = {
  v?: number;
  seq?: Record<string, number>;
  cat?: {
    products?: DemoProduct[];
    materials?: DemoMaterial[];
    suppliers?: DemoSupplier[];
    lists?: Record<string, string[]>;
  };
  lists?: Record<string, string[]>;
  settings?: DemoSettings;
  users?: DemoUser[];
  feed?: unknown[];
};

export type DemoProduct = {
  id: string;
  code: string;
  name: string;
  line: string;
  cat: string;
  unit: string;
  price: number;
  colors?: string[];
  active?: boolean;
  days?: number;
  sup?: string;
  bom?: { m: string; q: number }[];
};

export type DemoMaterial = {
  id: string;
  code: string;
  name: string;
  unit: string;
  price: number;
  min?: number;
};

export type DemoSupplier = {
  id: string;
  name: string;
  kind: string;
  phone?: string;
  terms?: string;
  items?: string[];
};

export type DemoSettings = {
  vat?: number;
  validDays?: number;
  rate?: number;
  discountCap?: Record<string, number>;
  company?: Record<string, string>;
};

export type DemoUser = {
  id: string;
  name: string;
  role: string;
  title?: string;
};

/** account — app/order.js accounts. */
export type DemoAccount = {
  id: string;
  name: string;
  kind: string;
  city?: string;
  phones?: string[];
  created?: number;
  src?: string;
  owner?: string;
  contacts?: DemoContact[];
};

export type DemoContact = {
  id: string;
  name: string;
  role?: string;
  phone?: string;
};

/** lead — app/lead-core.js. */
export type DemoLead = {
  id: string;
  acct?: string;
  line?: string;
  stage?: string;
  owner?: string;
  src?: string;
  srcNote?: string;
  created?: number;
  updated?: number;
  interest?: string[];
  area?: number;
  value?: number;
  prob?: number;
  project?: string;
  next?: { t: number; what: string };
  note?: string;
  hist?: DemoHist[];
  tries?: number;
  order?: string;
  lostWhy?: string;
  lostFrom?: string;
  sub?: string;
  subs?: Record<string, string>;
};

export type DemoHist = {
  id?: string;
  t?: number;
  who?: string;
  kind?: string;
  text?: string;
  contact?: string;
  result?: string;
};

/** order — app/order.js. */
export type DemoOrder = {
  id: string;
  created?: number;
  owner?: string;
  acct?: string;
  contact?: string;
  lead?: string;
  line?: string;
  items?: DemoOrderItem[];
  discPct?: number;
  discAmt?: number;
  ship?: number;
  install?: number;
  validDays?: number;
  plan?: DemoPlanItem[];
  receipts?: DemoReceipt[];
  log?: DemoLogEntry[];
  times?: Record<string, number>;
  stage?: number;
  stageAt?: number;
  due?: number;
  sentVia?: string[];
  sentAt?: number;
  agreed?: { by?: string; t?: number; how?: string; note?: string; diff?: boolean };
  resv?: unknown;
  agencyShort?: unknown[];
  prod?: DemoProd;
  prepAt?: number;
  prep?: { t?: number; by?: string; packs?: number; checks?: string[]; note?: string };
  delivered?: { t?: number; to?: string; by?: string };
  closed?: boolean;
  closedAt?: number;
  cancelled?: boolean;
  cancelReason?: string;
  note?: string;
  noVat?: boolean;
  preset?: string;
  skipped?: number[];
  smOk?: { by?: string; t?: number };
  mgrOk?: { by?: string; t?: number };
  pb?: Record<string, unknown>;
  backNote?: { by?: string; t?: number; text?: string } | null;
};

export type DemoOrderItem = {
  pid: string;
  qty: number;
  price: number;
  color?: string;
};

export type DemoPlanItem = {
  kind: string;
  amount: number;
  due?: number;
  note?: string;
};

export type DemoReceipt = {
  id: string;
  kind: string;
  amount: number;
  t?: number;
  due?: number;
  ref?: string;
  by?: string;
  chq?: {
    sayad?: string;
    bank?: string;
    due?: number;
    owner?: string;
    status?: string;
  } | null;
};

export type DemoLogEntry = {
  t?: number;
  who?: string;
  text: string;
};

export type DemoProd = {
  lines?: { pid: string; qty: number }[];
  start?: number;
  end?: number;
  acceptedAt?: number;
  startedAt?: number;
  qc?: { t?: number; good?: Record<string, number>; waste?: Record<string, number> };
  handoff?: {
    id: string;
    t?: number;
    lines?: { pid: string; qty: number }[];
    recv?: { t?: number; by?: string; lines?: { pid: string; qty: number }[] };
  };
  shortReq?: string;
  used?: Record<string, number>;
  note?: string;
};

/** buy — app/fin-core.js. */
export type DemoBuy = {
  id: string;
  kind?: string;
  sup?: string;
  created?: number;
  by?: string;
  lines?: { item: string; qty: number; price: number }[];
  pay?: { method?: string; note?: string };
  status?: string;
  note?: string;
  log?: DemoLogEntry[];
  payments?: (DemoBuyPayment & { chq?: { sayad?: string; bank?: string; due?: number; status?: string } })[];
  recv?: { t?: number; by?: string; note?: string };
  paidAt?: number;
};

export type DemoBuyPayment = {
  id: string;
  kind: string;
  amount: number;
  t?: number;
  ref?: string;
  by?: string;
};

/** job — app/prod.js. */
export type DemoJob = {
  id: string;
  pid: string;
  qty: number;
  color?: string;
  end?: number;
  status: string;
  created?: number;
  by?: string;
  startedAt?: number;
  good?: number;
  waste?: number;
  qcAt?: number;
};

/** move — app/stock.js addMove. */
export type DemoMove = {
  id: string;
  wh: string;
  item: string;
  qty: number;
  kind: string;
  ref?: string;
  t?: number;
  by?: string;
  note?: string;
};

/** مجموعه‌های قابل مهاجرت در پوشه data. */
export const DEMO_COLLECTIONS = ["accounts", "leads", "orders", "buys", "jobs", "moves"] as const;
export type DemoCollection = (typeof DEMO_COLLECTIONS)[number];
