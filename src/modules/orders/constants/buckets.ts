/** Demo app/flow.js PH — only a presentation grouping of existing stages. */
export const ORDER_BUCKETS = [
  { key: "pf", label: "پیش‌فاکتور", stages: [1, 2, 3], color: "var(--color-flow-invoice)" },
  { key: "cust", label: "منتظر مشتری", stages: [4, 5], color: "var(--color-flow-customer)" },
  { key: "make", label: "تولید", stages: [6, 7, 8], color: "var(--color-flow-production)" },
  { key: "depot", label: "انبار", stages: [9, 10], color: "var(--color-flow-depot)" },
  { key: "deliv", label: "تحویل", stages: [11], color: "var(--color-flow-delivery)" },
] as const;
export type OrderBucket = typeof ORDER_BUCKETS[number]["key"] | "mine";
