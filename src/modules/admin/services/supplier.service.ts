/**
 * سرویس مدیریت تأمین‌کنندگان — PHASE_07 §۵ (write ops).
 *
 * قوانین کسب‌وکار (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - نام اجباری است (admin.js:110: `if (!n) toast`).
 *  - دو نوع: `raw` (فروشنده مواد اولیه) و `agency` (نمایندگی)
 *    (admin.js:108-109).
 *  - تلفن با normPhone نرمال می‌شود (admin.js:112).
 *  - `rev` در هر به‌روزرسانی یک واحد افزایش می‌یابد (R-06).
 *  - `bank` (شماره حساب/شبا) در Demo هست (admin.js:109) ولی در طرح داده
 *    فاز ۲ مدل نشده است — خارج از دامنه (بدون تغییر Schema در این فاز).
 */
import { prisma } from "@core/database/client";
import { notFound } from "@core/errors";
import { normalizePhone } from "@core/formatting";

/** نوع تأمین‌کننده — admin.js:108-109. */
export const SUPPLIER_KINDS = ["raw", "agency"] as const;
export type SupplierKind = (typeof SUPPLIER_KINDS)[number];

/** تأمین‌کننده برای فهرست مدیریت. */
export type SupplierAdminRow = {
  id: string;
  name: string;
  kind: SupplierKind;
  phone: string;
  terms: string;
  items: string[];
};

const now = () => Date.now();

/** همه تأمین‌کنندگان (هر دو نوع) برای مدیریت — admin.js:102. */
export async function listAllSuppliers(): Promise<SupplierAdminRow[]> {
  const rows = await prisma.supplier.findMany({ orderBy: [{ name: "asc" }] });
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.kind as SupplierKind,
    phone: s.phone,
    terms: s.terms,
    items: Array.isArray(s.items) ? (s.items as string[]) : [],
  }));
}

/** ایجاد تأمین‌کننده. */
export async function createSupplier(input: {
  name: string;
  kind: SupplierKind;
  phone?: string;
  terms?: string;
}): Promise<SupplierAdminRow> {
  const ts = now();
  const s = await prisma.supplier.create({
    data: {
      name: input.name,
      kind: input.kind,
      phone: input.phone ? normalizePhone(input.phone) : "",
      terms: input.terms ?? "",
      items: [],
      createdAt: ts,
      updatedAt: ts,
    },
  });
  return listOne(s.id);
}

/** ویرایش تأمین‌کننده — admin.js:112. */
export async function updateSupplier(
  id: string,
  input: {
    name: string;
    kind: SupplierKind;
    phone?: string;
    terms?: string;
    },
): Promise<SupplierAdminRow> {
  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) throw notFound("تأمین‌کننده پیدا نشد.");

  await prisma.supplier.update({
    where: { id },
    data: {
      name: input.name,
      kind: input.kind,
      phone: input.phone ? normalizePhone(input.phone) : "",
      terms: input.terms ?? "",
      updatedAt: now(),
      rev: { increment: 1 },
    },
  });
  return listOne(id);
}

async function listOne(id: string): Promise<SupplierAdminRow> {
  const s = await prisma.supplier.findUniqueOrThrow({ where: { id } });
  return {
    id: s.id,
    name: s.name,
    kind: s.kind as SupplierKind,
    phone: s.phone,
    terms: s.terms,
    items: Array.isArray(s.items) ? (s.items as string[]) : [],
  };
}
