/**
 * لوله انتشار ثابت‌های مالی (CD-02 / PHASE_06 §۶).
 */
export {
  EXPENSE_KIND_LABELS,
  toStoredKind,
  toDisplayKind,
  directionOfKind,
  directionSign,
  txnDirectionOf,
  TXN_STORED_KINDS,
} from "./TXN_KINDS";
export type { ExpenseKindLabel, TxnDirection } from "./TXN_KINDS";
