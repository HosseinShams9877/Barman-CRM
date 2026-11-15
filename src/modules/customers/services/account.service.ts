/**
 * سرویس حساب‌های مشتری — منطق کسب‌وکار (CD-04 گام ۴ / CD-02).
 *
 * قوانین کسب‌کار (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - شناسه با پیشوند `AC-` و شمارنده از SEQ0.AC = ۱۰۰ (app/core.js:۳۶۴).
 *  - شماره تلفن نرمال‌شده یکتا است بین **همه** حساب‌ها؛ تکرار → ۴۰۹ با
 *    پیام Demo (app/order.js:۲۸۸: «این شماره برای «X» ثبت شده؛ از فهرست
 *    انتخابش کنید»).
 *  - مهر زمان: UTC ms (CD-07 / CLAUDE.md §۸).
 *  - `unknown` یعنی سرنخ بدون حساب شناخته‌شده (app/lead-core.js:۵۷).
 */
import { z } from "zod";
import { prisma } from "@core/database/client";
import { nextPrefixedId } from "@core/database";
import { conflict, notFound } from "@core/errors";
import type { AccountDetail, AccountListItem, AccountListResult } from "../types/account.types";
import {
  createAccountSchema,
  listAccountsQuerySchema,
  updateAccountSchema,
} from "../schemas/account.schema";
import type { Prisma } from "@prisma/client";

type CreateInput = z.infer<typeof createAccountSchema>;
type UpdateInput = z.infer<typeof updateAccountSchema>;
type ListQuery = z.infer<typeof listAccountsQuerySchema>;

/** تبدیل رکورد Prisma به آیتم لیست (بدون مخاطبین کامل). */
function toListItem(
  a: Prisma.AccountGetPayload<{
    include: {
      phones: true;
      contacts: { select: { id: true } };
      leads: { select: { id: true } };
    };
  }>,
): AccountListItem {
  return {
    id: a.id,
    name: a.name,
    kind: a.kind,
    active: a.active,
    address: a.address,
    note: a.note,
    phones: a.phones
      .map((p) => ({ id: p.id, kind: p.kind, number: p.number }))
      .sort((x, y) => x.kind.localeCompare(y.kind)),
    contactCount: a.contacts.length,
    leadCount: a.leads.length,
    createdAt: Number(a.createdAt),
  };
}

/**
 * لیست حساب‌ها — جستجو روی نام/شماره/شهر، صفحه‌بندی.
 * `includeInactive === false` حساب‌های غیرفعال را پنهان می‌کند.
 */
export async function listAccounts(query: ListQuery): Promise<AccountListResult> {
  const where: Prisma.AccountWhereInput = {};
  if (!query.includeInactive) where.active = true;
  if (query.q.length > 0) {
    where.OR = [
      { name: { contains: query.q } },
      { phones: { some: { number: { contains: query.q } } } },
      { address: { contains: query.q } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.account.count({ where }),
    prisma.account.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { phones: true, contacts: { select: { id: true } }, leads: { select: { id: true } } },
    }),
  ]);

  return {
    items: rows.map(toListItem),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/** حساب کامل با مخاطبین — ۴۰۴ اگر نبود. */
export async function getAccount(id: string): Promise<AccountDetail> {
  const a = await prisma.account.findUnique({
    where: { id },
    include: { phones: true, contacts: true, leads: { select: { id: true } } },
  });
  if (!a) throw notFound("حساب مورد نظر پیدا نشد.");

  return {
    ...toListItem({
      ...a,
      contacts: a.contacts.map((c) => ({ id: c.id })),
    }),
    contacts: a.contacts
      .map((c) => ({ id: c.id, name: c.name, role: c.role, phone: c.phone }))
      .sort((x, y) => x.name.localeCompare(y.name, "fa")),
  };
}

/**
 * بررسی تکراری‌بودن شماره نرمال‌شده در **سایر** حساب‌ها.
 * قانون Demo: هر شماره فقط روی یک حساب ثبت می‌شود (order.js:۲۸۸).
 *
 * @param numbers  شماره‌های نرمال‌شده درخواست.
 * @param excludeAccountId حسابی که باید از بررسی مستثنی شود (ویرایش).
 */
async function assertPhonesAvailable(
  numbers: string[],
  excludeAccountId: string | null,
): Promise<void> {
  if (numbers.length === 0) return;
  const dup = await prisma.accountPhone.findFirst({
    where: {
      number: { in: numbers },
      ...(excludeAccountId ? { accountId: { not: excludeAccountId } } : {}),
    },
    include: { account: { select: { name: true } } },
  });
  if (dup) {
    const label = dup.account.name || "اکانت دیگر";
    throw conflict(`این شماره برای «${label}» ثبت شده؛ از فهرست انتخابش کنید.`);
  }
}

/** ایجاد حساب — شناسه `AC-<n>`، مهر زمان UTC ms. */
export async function createAccount(input: CreateInput): Promise<AccountDetail> {
  await assertPhonesAvailable(
    input.phones.map((p) => p.number),
    null,
  );

  const ids = await prisma.account.findMany({ select: { id: true } });
  const id = nextPrefixedId("AC", ids.map((a) => a.id));
  const now = Date.now();

  const a = await prisma.account.create({
    data: {
      id,
      name: input.name,
      kind: input.kind,
      active: input.active,
      address: input.address,
      note: input.note,
      createdAt: now,
      updatedAt: now,
      phones: { create: input.phones },
      contacts: { create: input.contacts },
    },
    include: { phones: true, contacts: true, leads: { select: { id: true } } },
  });

  return {
    ...toListItem({ ...a, contacts: a.contacts.map((c) => ({ id: c.id })) }),
    contacts: a.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      phone: c.phone,
    })),
  };
}

/**
 * ویرایش حساب — `phones`/`contacts` ارسالی **جایگزین کامل** می‌شوند.
 *
 * پیاده‌سازی: چون Prisma به‌صورت اتمیک جایگزینی روابط many را پشتیبانی
 * نمی‌کند، ابتدا رکوردهای قدیمی حذف و سپس جدیدها در یک تراکنش ایجاد
 * می‌شوند.
 */
export async function updateAccount(id: string, input: UpdateInput): Promise<AccountDetail> {
  const existing = await prisma.account.findUnique({ where: { id } });
  if (!existing) throw notFound("حساب مورد نظر پیدا نشد.");

  if (input.phones) {
    await assertPhonesAvailable(
      input.phones.map((p) => p.number),
      id,
    );
  }

  const now = Date.now();
  const a = await prisma.$transaction(async (tx) => {
    if (input.phones) {
      await tx.accountPhone.deleteMany({ where: { accountId: id } });
    }
    if (input.contacts) {
      await tx.accountContact.deleteMany({ where: { accountId: id } });
    }
    return tx.account.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
        updatedAt: now,
        ...(input.phones ? { phones: { create: input.phones } } : {}),
        ...(input.contacts ? { contacts: { create: input.contacts } } : {}),
      },
      include: { phones: true, contacts: true, leads: { select: { id: true } } },
    });
  });

  return {
    ...toListItem({ ...a, contacts: a.contacts.map((c) => ({ id: c.id })) }),
    contacts: a.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      phone: c.phone,
    })),
  };
}

/** غیرفعال‌سازی حساب (حذف نرم — حساب در لیست غیرفعال می‌رود). */
export async function deactivateAccount(id: string): Promise<void> {
  const existing = await prisma.account.findUnique({ where: { id } });
  if (!existing) throw notFound("حساب مورد نظر پیدا نشد.");

  await prisma.account.update({
    where: { id },
    data: { active: false, updatedAt: Date.now() },
  });
}
