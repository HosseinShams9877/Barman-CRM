/**
 * ماژول انبار — حرکت‌ها و موجودی (CD-02 / PHASE_05 §۵).
 *
 * `moves` تنها منبع حقیقت موجودی است — هیچ فیلد موجودی ذخیره نمی‌شود
 * (CD-08). موجودی همیشه read-time aggregation از حرکت‌هاست.
 */
// components
export { MovesTable } from "./components/MovesTable";
export { StockView } from "./components/StockView";
export { MoveFormDialog } from "./components/MoveFormDialog";
export type { MoveFormDialogProps } from "./components/MoveFormDialog";
export { EditMoveDialog } from "./components/EditMoveDialog";
export type { EditMoveDialogProps } from "./components/EditMoveDialog";
// hooks
export { useMovesQuery, useStockQuery, useStockAlertsQuery } from "./hooks/useMoves";
export {
  useCatalogProductsQuery,
  useCatalogMaterialsQuery,
} from "./hooks/useCatalog";
export type { CatalogProduct, CatalogMaterial, CatalogBomItem } from "./hooks/useCatalog";
export {
  useCreateMoveMutation,
  useUpdateMoveMutation,
  useDeleteMoveMutation,
} from "./hooks/useMoveMutations";
// queries
export { invalidateInventory } from "./queries/invalidations";
// schemas
export {
  createMoveSchema,
  updateMoveSchema,
  moveListQuerySchema,
  moveIdParamSchema,
  reservationCheckSchema,
} from "./schemas/move.schema";
export type {
  CreateMoveInput,
  UpdateMoveInput,
  MoveListQuery,
  ReservationCheckInput,
} from "./schemas/move.schema";
// services
export {
  listMoves,
  getMove,
  createMove,
  updateMove,
  deleteMove,
} from "./services/move.service";
export type { Actor as MoveActor } from "./services/move.service";
export {
  computeOnHand,
  reservedQty,
  freeQtyOf,
  getStock,
  getStockAlerts,
  checkReservations,
} from "./services/stock.service";
// constants
export {
  WAREHOUSES,
  WAREHOUSE_LABELS,
  MOVE_KINDS,
  MOVE_KIND_LABELS,
  MANUAL_ENTRY_KINDS,
  EDITABLE_KINDS,
  SIGN_BY_KIND,
} from "./constants";
export type { Warehouse, MoveKind, ManualEntryKind, EditableKind } from "./constants";
// lib
export { signedQty, isSystemKind } from "./lib/kinds";
// types
export type {
  MoveRow,
  MoveListParams,
  MoveListResult,
  StockRow,
  StockRowNoMoney,
  StockAlert,
  ReservationCheckItem,
  ReservationCheckResult,
} from "./types/move.types";
