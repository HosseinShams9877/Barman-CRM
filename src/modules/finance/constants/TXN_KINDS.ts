/**
 * انواع تراکنش مالی — نمای مالی روی ثابت‌های خرید (PHASE_06 §۶).
 *
 * منبع یکپارچه ثابت‌ها ماژول خرید است (`@modules/purchasing/constants` —
 * مطابق فهرست ۸ گزینه‌ای Demo در app/fin.js:145). این فایل فقط لایه
 * نمایش/کنترل مالی را اضافه می‌کند تا دو ماژول روی یک حقیقت
 * (single source of truth) کار کنند (CLAUDE.md §۱۳).
 */
export {
  EXPENSE_KIND_LABELS,
  toStoredKind,
  toDisplayKind,
  directionOfKind,
  directionSign,
  TXN_STORED_KINDS,
} from "@modules/purchasing/constants";
export type { ExpenseKindLabel, TxnDirection } from "@modules/purchasing/constants";

import { directionOfKind, type TxnDirection } from "@modules/purchasing/constants";

/**
 * جهت تراکنش — alias خالص برای استفاده در لایه مالی بدون ارجاع مستقیم
 * به سمبل‌های ماژول خرید.
 */
export function txnDirectionOf(storedKind: string): TxnDirection {
  return directionOfKind(storedKind);
}
