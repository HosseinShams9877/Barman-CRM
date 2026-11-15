/**
 * سرویس تأمین‌کننده — فقط خواندن (PHASE_06 §۵: مدیریت تأمین‌کنندگان در
 * فاز ۷ است؛ این فاز فقط فهرست را برای فرم خرید می‌خواند).
 *
 * فیلتر پیش‌فرض: تأمین‌کنندگان مواد خام (`kind: "raw"`) — خرید این فاز
 * فقط مواد اولیه را شامل می‌شود (PHASE_06 §۳.۴). با `includeAll` همه
 * نوع‌ها برمی‌گردند (BLANK استفاده در آینده).
 */
import { prisma } from "@core/database/client";
import type { SupplierKind, SupplierRow } from "../types/supplier.types";

/** GET /api/suppliers — فهرست تأمین‌کنندگان مواد خام (فقط‌خواندن). */
export async function listSuppliers(): Promise<SupplierRow[]> {
  const rows = await prisma.supplier.findMany({
    where: { kind: "raw" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, kind: true },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind as SupplierKind }));
}
