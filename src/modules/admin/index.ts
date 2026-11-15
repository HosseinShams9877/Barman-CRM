/**
 * ماژول مدیریت — لوله انتشار (CD-02).
 */
export { AdminPage } from "./components/AdminPage";
export { ProductCatalog } from "./components/ProductCatalog";
export { MaterialCatalog } from "./components/MaterialCatalog";
export { BomEditor } from "./components/BomEditor";
export { SuppliersPanel } from "./components/SuppliersPanel";
export { UserManager } from "./components/UserManager";
export { ListsEditor } from "./components/ListsEditor";
export { SettingsPanel } from "./components/SettingsPanel";
export { ADMIN_TABS, type AdminTab, type AdminTabKey } from "./constants/tabs";
export { LIST_KEYS, LIST_LABELS, linesToList, type ListKey } from "./constants/lists";
export {
  PRODUCT_LINES,
  PRODUCT_LINE_LABELS,
  PRODUCT_UNITS,
  MATERIAL_UNITS,
  type ProductLine,
} from "./constants/units";
export { queryKeys } from "@core/query";
