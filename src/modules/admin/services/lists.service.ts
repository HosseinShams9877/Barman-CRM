/**
 * سرویس ۷ فهرست ثابت — PHASE_07 §۵.
 *
 * قوانین کسب‌وکار (همه با ارجاع به Demo — CLAUDE.md §۱۳):
 *  - هفت کلید ثابت (admin.js:131 — LNAMES).
 *  - ذخیره همه فهرست‌ها با هم (admin.js:174) — هر مورد در یک خط،
 *    trim و حذف موارد خالی.
 *  - هر فهرست در یک ردیف `List` با کلید یکتا.
 *  - `rev` در هر ذخیره یک واحد افزایش می‌یابد (R-06).
 */
import { prisma } from "@core/database/client";
import { LIST_KEYS, LIST_LABELS, type ListKey } from "../constants/lists";
import type { ListsSaveInput } from "../schemas/admin.schema";

/** یک فهرست با برچسب فارسی. */
export type ListRow = {
  key: ListKey;
  label: string;
  items: string[];
};

/** همه ۷ فهرست — ردیف‌های غایب با فهرست خالی برمی‌گردند. */
export async function listLists(): Promise<ListRow[]> {
  const rows = await prisma.list.findMany();
  const map = new Map(rows.map((r) => [r.key, r.items]));

  return LIST_KEYS.map((key) => ({
    key,
    label: LIST_LABELS[key],
    items: Array.isArray(map.get(key)) ? (map.get(key) as string[]) : [],
  }));
}

/**
 * ذخیره فهرست‌ها — فقط کلیدهای ۷گانه پذیرفته می‌شوند (admin.js:174).
 *
 * کلیدهای ناشناخته در لایه Zod رد می‌شوند؛ اینجا هر کلید معتبر را
 * upsert می‌کنیم.
 */
export async function saveLists(input: ListsSaveInput): Promise<ListRow[]> {
  const ts = Date.now();
  await prisma.$transaction(
    Object.entries(input.lists).map(([key, items]) =>
      prisma.list.upsert({
        where: { key },
        update: { items, updatedAt: ts, rev: { increment: 1 } },
        create: { key, items, updatedAt: ts },
      }),
    ),
  );

  return listLists();
}
