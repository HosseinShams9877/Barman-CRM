/**
 * پیکربندی مرکزی TanStack React Query v5 (CD-09 / STATE_MANAGEMENT §۲ و §۳).
 *
 * - staleTime پایه: ۳۰s (R-29: جایگزین polling هر ۳s)
 * - retry: ۲
 * - gcTime: ۵ دقیقه
 * - refetchInterval: **ممنوع** (R-29 / CLAUDE.md §۱۰) — مگر تأیید Q-15
 * - refetchOnWindowFocus: روشن (جایگزین polling)
 */
import { QueryClient } from "@tanstack/react-query";

/** پیکربندی ثابت سراسری — همه queryها این مقادیر پیش‌فرض را می‌گیرند. */
export const DEFAULT_QUERY_CONFIG = {
  staleTime: 30 * 1000,
  retry: 2,
  gcTime: 5 * 60 * 1000,
  refetchOnWindowFocus: true,
  refetchInterval: false as const,
} as const;

/**
 * ساخت QueryClient — در سرور برای هر session یک نمونه، در کلاینت یک نمونه مرکزی.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_QUERY_CONFIG.staleTime,
        retry: DEFAULT_QUERY_CONFIG.retry,
        gcTime: DEFAULT_QUERY_CONFIG.gcTime,
        refetchOnWindowFocus: DEFAULT_QUERY_CONFIG.refetchOnWindowFocus,
        refetchInterval: DEFAULT_QUERY_CONFIG.refetchInterval,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

/** کلیدهای متمرکز — منبع واحد ساخت query key (CD-09). */
export const queryKeys = {
  /** نشست کاربر جاری */
  auth: {
    all: ["auth"] as const,
    me: () => [...queryKeys.auth.all, "me"] as const,
  },
  /** حساب‌های مشتری (فاز ۳) */
  customers: {
    all: ["customers"] as const,
    list: (params: { q: string; page: number; pageSize: number; includeInactive: boolean }) =>
      [...queryKeys.customers.all, "list", params] as const,
    detail: (id: string) => [...queryKeys.customers.all, "detail", id] as const,
  },
  /** سرنخ‌ها (فاز ۳) */
  leads: {
    all: ["leads"] as const,
    list: (params: {
      line: string | null;
      stage: string | null;
      ownerId: string | null;
      q: string;
    }) => [...queryKeys.leads.all, "list", params] as const,
    detail: (id: string) => [...queryKeys.leads.all, "detail", id] as const,
    followups: (id: string) => [...queryKeys.leads.detail(id), "followups"] as const,
  },
  /** سفارش‌ها / پیش‌فاکتورها (فاز ۴) */
  orders: {
    all: ["orders"] as const,
    list: (params: {
      stage: number | null;
      status: string | null;
      ownerId: string | null;
      q: string;
      page: number;
      pageSize: number;
    }) => [...queryKeys.orders.all, "list", params] as const,
    detail: (id: string) => [...queryKeys.orders.all, "detail", id] as const,
  },
  /** حرکت‌های انبار (فاز ۵) */
  moves: {
    all: ["moves"] as const,
    list: (params: { wh: string | null; kind: string | null; q: string; page: number; pageSize: number }) =>
      [...queryKeys.moves.all, "list", params] as const,
  },
  /** موجودی و هشدارها (فاز ۵) — تجمع لحظه‌ای از حرکت‌ها (CD-08) */
  stock: {
    all: ["stock"] as const,
    list: (wh: string | null) => [...queryKeys.stock.all, "list", wh] as const,
    alerts: () => [...queryKeys.stock.all, "alerts"] as const,
  },
  /** کارهای تولید (فاز ۵) */
  jobs: {
    all: ["jobs"] as const,
    list: (params: { status: string | null; q: string; page: number; pageSize: number }) =>
      [...queryKeys.jobs.all, "list", params] as const,
    detail: (id: string) => [...queryKeys.jobs.all, "detail", id] as const,
  },
  /** کاتالوگ محصولات و مواد (فاز ۵ — فقط‌خواندن، برای فرم‌ها) */
  catalog: {
    all: ["catalog"] as const,
    products: () => [...queryKeys.catalog.all, "products"] as const,
    materials: () => [...queryKeys.catalog.all, "materials"] as const,
  },
  /** خریدها (فاز ۶) */
  buys: {
    all: ["buys"] as const,
    list: (params: { status: string | null; supplierId: string | null; q: string; page: number; pageSize: number }) =>
      [...queryKeys.buys.all, "list", params] as const,
    detail: (id: string) => [...queryKeys.buys.all, "detail", id] as const,
  },
  /** تراکنش‌های مالی (فاز ۶) */
  txns: {
    all: ["txns"] as const,
    list: (params: { kind: string | null; direction: string | null; page: number; pageSize: number }) =>
      [...queryKeys.txns.all, "list", params] as const,
  },
  /** گزارش‌های مالی (فاز ۶) */
  finance: {
    all: ["finance"] as const,
    receivables: () => [...queryKeys.finance.all, "receivables"] as const,
    payables: () => [...queryKeys.finance.all, "payables"] as const,
    cashflow: (month: string | null) => [...queryKeys.finance.all, "cashflow", month] as const,
  },
  /** خانه (فاز ۷) */
  home: {
    all: ["home"] as const,
    summary: () => [...queryKeys.home.all, "summary"] as const,
  },
  /** مدیریت و کاتالوگ (فاز ۷) */
  admin: {
    all: ["admin"] as const,
    products: () => [...queryKeys.admin.all, "products"] as const,
    materials: () => [...queryKeys.admin.all, "materials"] as const,
    bom: (productId: string) => [...queryKeys.admin.all, "bom", productId] as const,
    suppliers: () => [...queryKeys.admin.all, "suppliers"] as const,
    users: () => [...queryKeys.admin.all, "users"] as const,
    lists: () => [...queryKeys.admin.all, "lists"] as const,
    /** ستون‌های بورد سرنخ (فاز ۸ — ذخیره در List key "leadcols") */
    leadcols: () => [...queryKeys.admin.all, "leadcols"] as const,
    settings: () => [...queryKeys.admin.all, "settings"] as const,
  },
  /** گزارش‌های تجمیعی (فاز ۷) */
  reports: {
    all: ["reports"] as const,
    byKind: (kind: string, days: number, line: string | null) =>
      [...queryKeys.reports.all, kind, days, line] as const,
  },
} as const;
