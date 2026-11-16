"use client";

import { useRef, useState } from "react";
import { Button } from "@components/ui";
import { ErrorState, LoadingState } from "@components/feedback";
import { useToast } from "@components/feedback";
import { useLeadColsQuery, useSaveLeadColsMutation, type LeadColRow } from "../hooks/useAdmin";
import { LEADCOLS_STAGES, LEADCOLS_DEFAULT_COLOR } from "../constants/leadcols";
import { stageLabel } from "@modules/leads/constants/STAGE";

/**
 * تب «ستون‌های بورد سرنخ» در /admin — بازگردانده شده از Demo
 * (admin.js:135 leadColsView / lead-core.js colEditor).
 *
 * ساختار ساده: هر مرحله (raw/opp/pf) ستون‌های خود را با عنوان و رنگ
 * نشان می‌دهد؛ ویرایش عنوان/رنگ و افزودن/حذف ستون ممکن است. ذخیره در
 * ردیف List کلید "leadcols" (بدون تغییر schema).
 */
export function LeadColsPanel({ canEdit }: { canEdit: boolean }) {
  const query = useLeadColsQuery();
  const save = useSaveLeadColsMutation();
  const toast = useToast();
  const [draft, setDraft] = useState<LeadColRow[] | null>(null);
  const newKey = useRef(0);

  if (query.isLoading) return <LoadingState label="در حال خواندن ستون‌ها" />;
  if (query.isError) return <ErrorState message={query.error?.message ?? "خطا در خواندن ستون‌ها"} />;
  if (query.data === undefined) return null;

  const columns = draft ?? query.data.columns;

  const setColumn = (index: number, patch: Partial<LeadColRow>): void => {
    setDraft(columns.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const addColumn = (stage: string): void => {
    newKey.current += 1;
    setDraft([
      ...columns,
      { stage, key: `col${newKey.current}`, label: "ستون جدید", color: LEADCOLS_DEFAULT_COLOR },
    ]);
  };

  const removeColumn = (index: number): void => {
    setDraft(columns.filter((_, i) => i !== index));
  };

  const handleSave = (): void => {
    if (draft === null) return;
    save.mutate(
      { columns: draft },
      {
        onSuccess: () => {
          toast.push("ستون‌های بورد ذخیره شد", "success");
          setDraft(null);
        },
        onError: (err) => toast.push(err.message, "danger"),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <p className="hint">
        ستون‌های بورد هر مرحله در بخش سرنخ‌ها ({LEADCOLS_STAGES.map((s) => stageLabel(s)).join("، ")}).
        کارشناس فروش و مدیر فروش از داخل بورد هم می‌توانند ستون‌ها را تغییر دهند (app/lead-core.js colEditor).
      </p>

      {LEADCOLS_STAGES.map((stage) => (
        <section key={stage} className="ws-sec">
          <h3 className="h4">{stageLabel(stage)}</h3>
          <div className="cnt-list">
            {columns
              .map((c, i) => ({ c, i }))
              .filter(({ c }) => c.stage === stage)
              .map(({ c, i }) => (
                <div key={c.key} className="cnt-row">
                  <span className="color-dot" style={{ background: c.color }} aria-hidden="true" />
                  <input
                    className="input"
                    value={c.label}
                    disabled={!canEdit}
                    aria-label="عنوان ستون"
                    onChange={(e) => setColumn(i, { label: e.target.value })}
                  />
                  <input
                    className="input"
                    value={c.color}
                    disabled={!canEdit}
                    aria-label="رنگ ستون"
                    onChange={(e) => setColumn(i, { color: e.target.value })}
                  />
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="حذف ستون"
                      onClick={() => removeColumn(i)}
                    >
                      حذف
                    </Button>
                  ) : null}
                </div>
              ))}
            {canEdit ? (
              <Button variant="ghost" size="sm" onClick={() => addColumn(stage)}>
                + ستون جدید
              </Button>
            ) : null}
          </div>
        </section>
      ))}

      {canEdit ? (
        <div className="flex gap-3">
          <Button variant="primary" onClick={handleSave} disabled={draft === null || save.isPending}>
            ذخیره ستون‌ها
          </Button>
          {draft !== null ? (
            <Button variant="ghost" onClick={() => setDraft(null)}>
              انصراف
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="hint">فقط مشاهده — ویرایش برای مدیران سیستم ممکن است.</p>
      )}
    </div>
  );
}
