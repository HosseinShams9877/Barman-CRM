"use client";

import { useState } from "react";
import { Button, Card } from "@components/ui";
import { EmptyState } from "@components/shared";
import { ErrorState, LoadingState } from "@components/feedback";
import { useToast } from "@components/feedback";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { ApiError } from "@core/errors";
import { toFaDigits } from "@core/formatting";
import { useLeadsQuery } from "../hooks/useLeads";
import { useMoveLeadStageMutation } from "../hooks/useLeadMutations";
import { useLeadFilters } from "../hooks/useLeadFilters";
import { BOARD_STAGES, stageLabel } from "../constants/STAGE";
import type { LeadStageKey } from "../constants/STAGE";
import { LEAD_LINES } from "../constants/LINE";
import type { LeadLineKey } from "../constants/LINE";
import type { LeadListItem } from "../types/lead.types";
import { LeadColumn } from "./LeadColumn";
import { LeadQuickView } from "./LeadQuickView";
import { LeadFormDialog } from "./LeadFormDialog";
import { ImportDialog } from "./ImportDialog";
import { LostDialog } from "./LostDialog";

const PAGE_SIZE = 100;

type Filters = {
  line: LeadLineKey | "all";
  stage: LeadStageKey | "all";
  q: string;
};

/**
 * بورد سرنخ‌ها — ۵ ستون افقی با drag&drop (PHASE_03 §۱۰).
 *
 * فیلترها (خط، مرحله، جستجو) در localStorage ذخیره می‌شوند (CD-09) و
 * بدون setState در effect از طریق `useLeadFilters` خوانده می‌شوند.
 * جابه‌جایی مرحله با HTML5 DnD در دسکتاپ و با select در موبایل انجام
 * می‌شود (CD-12). انتقال به «از دست رفته» همیشه از دیالوگ دلیل
 * می‌گذرد (app/leads.js:474).
 *
 * دیالوگ‌ها فقط در حالت باز mount می‌شوند تا state فرم با هر باز شدن
 * تازه شود.
 */
export function LeadBoard() {
  const me = useMeQuery();
  const permissions = new Set(me.data?.permissions ?? []);
  const canCreate = permissions.has("leads.create");
  const canImport = permissions.has("leads.import");
  const canMove = permissions.has("leads.edit");
  const canSeeMoney = permissions.has("money.view");
  const toast = useToast();

  const [filters, setFilters] = useLeadFilters();
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [lostLeadId, setLostLeadId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [importOpen, setImportOpen] = useState<boolean>(false);

  const moveStage = useMoveLeadStageMutation();

  const query = useLeadsQuery({
    page: 1,
    pageSize: PAGE_SIZE,
    q: filters.q,
    ...(filters.line !== "all" ? { line: filters.line } : {}),
    ...(filters.stage !== "all" ? { stage: filters.stage } : {}),
  });

  const items = query.data?.items ?? [];
  const byStage = new Map<LeadStageKey, LeadListItem[]>();
  for (const stage of BOARD_STAGES) byStage.set(stage, []);
  for (const lead of items) {
    const list = byStage.get(lead.stage);
    if (list) list.push(lead);
  }

  const handleMove = (lead: LeadListItem, to: LeadStageKey): void => {
    if (to === "lost") {
      setLostLeadId(lead.id);
      return;
    }
    moveStage.mutate(
      { id: lead.id, data: { to } },
      {
        onSuccess: () => toast.push(`سرنخ به «${stageLabel(to)}» منتقل شد.`, "success"),
        onError: (err) => {
          const message = err instanceof ApiError ? err.message : "خطای غیرمنتظره.";
          toast.push(message, "danger");
        },
      },
    );
  };

  const handleDrop = (leadId: string, to: LeadStageKey): void => {
    const lead = items.find((l) => l.id === leadId);
    if (!lead) return;
    handleMove(lead, to);
  };

  const onSearch = (e: React.FormEvent): void => {
    e.preventDefault();
    void query.refetch();
  };

  return (
    <>
      <div className="page-head">
        <h1 className="h1">سرنخ‌ها</h1>
        <div className="flex gap-2 flex-wrap">
          {canImport ? (
            <Button variant="ghost" onClick={() => setImportOpen(true)}>
              ورود گروهی
            </Button>
          ) : null}
          {canCreate ? (
            <Button onClick={() => setFormOpen(true)} leadingIcon={<span aria-hidden="true">+</span>}>
              سرنخ جدید
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <form className="toolbar" onSubmit={onSearch} role="search">
          <div className="field toolbar-field">
            <label className="field-label" htmlFor="leads-q">
              جستجو
            </label>
            <input
              id="leads-q"
              className="input"
              type="search"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="نام، شماره تلفن یا شناسه سرنخ"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="leads-line">
              خط محصول
            </label>
            <select
              id="leads-line"
              className="select"
              value={filters.line}
              onChange={(e) => setFilters((f) => ({ ...f, line: e.target.value as Filters["line"] }))}
            >
              {LEAD_LINES.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
              <option value="all">همه خطوط</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="leads-stage">
              مرحله
            </label>
            <select
              id="leads-stage"
              className="select"
              value={filters.stage}
              onChange={(e) =>
                setFilters((f) => ({ ...f, stage: e.target.value as Filters["stage"] }))
              }
            >
              <option value="all">همه مراحل</option>
              {BOARD_STAGES.map((s) => (
                <option key={s} value={s}>
                  {stageLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="ghost" isLoading={query.isFetching}>
            جستجو
          </Button>
        </form>
      </Card>

      {query.isLoading ? (
        <LoadingState label="در حال بارگذاری سرنخ‌ها…" />
      ) : query.isError ? (
        <ErrorState
          title="بارگذاری ناموفق"
          message={query.error?.message ?? "خطا در دریافت سرنخ‌ها."}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="سرنخی وجود ندارد"
          description={
            filters.q.length > 0
              ? "نتیجه‌ای برای جستجوی شما پیدا نشد. عبارت دیگری را امتحان کنید."
              : "در این خط هنوز سرنخی ثبت نشده است."
          }
          action={
            canCreate ? (
              <Button onClick={() => setFormOpen(true)}>ایجاد اولین سرنخ</Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="board" aria-label="بورد سرنخ‌ها">
            {BOARD_STAGES.map((stage) => (
              <LeadColumn
                key={stage}
                stage={stage}
                leads={byStage.get(stage) ?? []}
                canSeeMoney={canSeeMoney}
                canMove={canMove}
                onOpen={(lead) => setOpenLeadId(lead.id)}
                onMove={handleMove}
                onDrop={handleDrop}
              />
            ))}
          </div>
          {query.data && query.data.total > query.data.items.length ? (
            <p className="text-muted">
              {toFaDigits(query.data.items.length)} سرنخ از {toFaDigits(query.data.total)} نمایش
              داده شد — با جستجو سرنخ موردنظر را پیدا کنید.
            </p>
          ) : null}
        </>
      )}

      <LeadQuickView leadId={openLeadId} onClose={() => setOpenLeadId(null)} />
      {lostLeadId !== null ? (
        <LostDialog
          open={lostLeadId !== null}
          leadId={lostLeadId}
          onClose={() => setLostLeadId(null)}
        />
      ) : null}
      {formOpen ? (
        <LeadFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
      ) : null}
      {importOpen ? <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} /> : null}
    </>
  );
}
