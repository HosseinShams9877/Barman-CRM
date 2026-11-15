"use client";

import { useCallback, useSyncExternalStore } from "react";
import { BOARD_STAGES } from "../constants/STAGE";
import type { LeadStageKey } from "../constants/STAGE";
import type { LeadLineKey } from "../constants/LINE";

const FILTERS_KEY = "barman.leads.filters.v1";

export type LeadFilters = {
  line: LeadLineKey | "all";
  stage: LeadStageKey | "all";
  q: string;
};

const DEFAULT_FILTERS: LeadFilters = { line: "prod", stage: "all", q: "" };

/**
 * ذخیره‌سازی فیلترهای بورد سرنخ‌ها در localStorage — CD-09.
 *
 * بورد یک کامپوننت سمت کلاینت است ولی Next.js آن را در سرور هم
 * رندر می‌کند؛ به همین دلیل خواندن localStorage نه در بدنه کامپوننت
 * و نه در `useEffect` (قانون react-hooks/set-state-in-effect) انجام
 * نمی‌شود. `useSyncExternalStore` با `getServerSnapshot` دقیقاً همین
 * کار را بدون mismatch هیدراتاسیون انجام می‌دهد: رندر سرور و اولین
 * رندر کلاینت هر دو `DEFAULT_FILTERS` را می‌بینند و بعد از هیدراتاسیون
 * مقدار ذخیره‌شده جایگزین می‌شود.
 */
let cached: LeadFilters | null = null;
const listeners = new Set<() => void>();

/** خواندن و اعتبارسنجی فیلترهای ذخیره‌شده — هر خطا نادیده گرفته می‌شود. */
function loadFilters(): LeadFilters {
  const raw = window.localStorage.getItem(FILTERS_KEY);
  if (!raw) return DEFAULT_FILTERS;
  try {
    const parsed = JSON.parse(raw) as Partial<LeadFilters>;
    return {
      line: parsed.line === "agency" || parsed.line === "prod" ? parsed.line : "all",
      stage:
        parsed.stage && (BOARD_STAGES as readonly string[]).includes(parsed.stage)
          ? (parsed.stage as LeadStageKey)
          : "all",
      q: typeof parsed.q === "string" ? parsed.q : "",
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function getSnapshot(): LeadFilters {
  if (cached === null) cached = loadFilters();
  return cached;
}

function getServerSnapshot(): LeadFilters {
  return DEFAULT_FILTERS;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function emit(): void {
  for (const callback of listeners) callback();
}

/** نوشتن فیلترها در localStorage و آگاه‌کردن مشترکین. */
export function setLeadFilters(next: LeadFilters): void {
  cached = next;
  try {
    window.localStorage.setItem(FILTERS_KEY, JSON.stringify(next));
  } catch {
    /* ذخیره‌سازی اختیاری است — نادیده گرفته می‌شود */
  }
  emit();
}

export function resetLeadFilters(): void {
  setLeadFilters(DEFAULT_FILTERS);
}

export type SetLeadFilters = (next: LeadFilters | ((prev: LeadFilters) => LeadFilters)) => void;

/**
 * فیلترهای پایدار بورد سرنخ‌ها — منبع حقیقت localStorage، بدون
 * setState در effect (قانون ESLint پروژه).
 */
export function useLeadFilters(): [LeadFilters, SetLeadFilters] {
  const filters = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const set = useCallback<SetLeadFilters>(
    (next) => {
      setLeadFilters(typeof next === "function" ? next(cached ?? DEFAULT_FILTERS) : next);
    },
    [],
  );
  return [filters, set];
}
