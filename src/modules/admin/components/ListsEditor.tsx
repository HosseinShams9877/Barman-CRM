"use client";

import { useMemo, useState } from "react";
import { Button } from "@components/ui";
import { EmptyState } from "@components/shared";
import { ErrorState, LoadingState } from "@components/feedback";
import { useToast } from "@components/feedback";
import { ApiError } from "@core/errors";
import { LIST_KEYS, LIST_LABELS, linesToList, type ListKey } from "../constants/lists";
import { useListsQuery, useSaveListsMutation } from "../hooks/useAdmin";

type Props = {
  /** مجوز ویرایش (admin.lists) — فقط admin/management (FULL). */
  canEdit: boolean;
};

/**
 * ویرایشگر ۷ فهرست ثابت — PHASE_07 §۱۰ / دروازه خروج ۳.
 *
 * بازسازی admin.js:133: هر فهرست یک textarea با هر مورد در یک خط.
 * ذخیره همه فهرست‌ها با هم انجام می‌شود (admin.js:174).
 *
 * ویرایش‌های محلی روی نقشه `edits` نگه داشته می‌شوند و مقدار نمایش‌داده‌شده
 * پیش‌فرض از داده سرور است (بدون	effect همگان‌سازی — react-hooks lint).
 */
export function ListsEditor({ canEdit }: Props) {
  const query = useListsQuery();
  const saveMutation = useSaveListsMutation();
  const toast = useToast();

  /** ویرایش‌های محلی به ازای کلید فهرست — مقدار غایب یعنی دست‌نخورده. */
  const [edits, setEdits] = useState<Partial<Record<ListKey, string>>>({});

  const serverTexts = useMemo(() => {
    const map: Partial<Record<ListKey, string>> = {};
    for (const row of query.data?.items ?? []) map[row.key] = row.items.join("\n");
    return map;
  }, [query.data]);

  const dirty = Object.keys(edits).length > 0;

  const save = (): void => {
    const lists = {} as Record<ListKey, string[]>;
    for (const key of LIST_KEYS) {
      lists[key] = linesToList(edits[key] ?? serverTexts[key] ?? "");
    }
    saveMutation.mutate(
      { lists },
      {
        onSuccess: () => {
          setEdits({});
          toast.push("فهرست‌ها ذخیره شد.", "success");
        },
        onError: (err) => toast.push(err instanceof ApiError ? err.message : "خطای غیرمنتظره.", "danger"),
      },
    );
  };

  if (query.isLoading) return <LoadingState label="در حال بارگذاری فهرست‌ها…" />;
  if (query.isError) return <ErrorState message={query.error?.message ?? "خطا در بارگذاری."} />;
  if (!query.data || query.data.items.length === 0) {
    return <EmptyState title="فهرستی وجود ندارد" description="۷ فهرست ثابت در seed ساخته می‌شوند." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="hint">هر مورد در یک خط (admin.js:133).</p>
      <div className="grid2">
        {LIST_KEYS.map((key) => {
          const value = edits[key] ?? serverTexts[key] ?? "";
          return (
            <section key={key} className="card flex flex-col gap-2">
              <h3 className="m-0 text-base">{LIST_LABELS[key]}</h3>
              <textarea
                className="input"
                rows={7}
                aria-label={LIST_LABELS[key]}
                disabled={!canEdit}
                value={value}
                onChange={(e) => setEdits((prev) => ({ ...prev, [key]: e.target.value }))}
              />
              <small className="hint">{linesToList(value).length} مورد</small>
            </section>
          );
        })}
      </div>
      {canEdit ? (
        <div className="flex justify-end">
          <Button variant="primary" onClick={save} isLoading={saveMutation.isPending} disabled={!dirty}>
            ذخیره فهرست‌ها
          </Button>
        </div>
      ) : null}
    </div>
  );
}
