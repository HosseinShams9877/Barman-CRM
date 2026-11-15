/**
 * core/permissions — لوله انتشار (CD-02).
 *
 * منبع واحد ماتریس مجوزها — هم در سرور (اجرا) هم در کلاینت (UX).
 */
export {
  ROLES,
  PERMISSIONS,
  PERMISSION_MATRIX,
  ROLE_LABELS,
  roleHasPermission,
  rolesHavePermission,
  isNoMoneyRole,
} from "./matrix";
export type { Role, Permission, PermissionMatrix } from "./matrix";
export {
  hasPermission,
  requirePermission,
  requireAnyPermission,
  shouldHideMoney,
  listPermissions,
  listRoles,
} from "./requirePermission";
