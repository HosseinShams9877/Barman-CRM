"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouteDraft } from "@core/utils/useRouteDraft";
import { PageHeader } from "@components/shared/PageHeader";
import { useSummaryQuery } from "@modules/home/hooks/useSummary";
import { LEAD_SOURCES } from "../constants/lists";
import { LeadStageView } from "./LeadStageView";
import { FollowupDialog } from "./FollowupDialog";
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
  const search = useSearchParams();
  const [q, setQ] = useRouteDraft(search.get("q") ?? filters.q);
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const [owner, setOwner] = useState("");
  const [near, setNear] = useState(false);
  const [view, setView] = useState(false);
  const [followup, setFollowup] = useState<string | null>(null);
  const summary = useSummaryQuery(Boolean(me.data));
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [lostLeadId, setLostLeadId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [importOpen, setImportOpen] = useState<boolean>(false);

  const moveStage = useMoveLeadStageMutation();

  const query = useLeadsQuery({
    page,
    pageSize: PAGE_SIZE,
    q,
    ...(filters.stage !== "all" ? { stage: filters.stage } : {}),
    ...(filters.line !== "all" ? { line: filters.line } : {}),
    ...(source ? { source } : {}),
    ...(owner ? { ownerId: owner } : {}),
    ...(near && summary.data?.workspace?.today ? { dueBefore: summary.data.workspace.today } : {}),
  });

  const base = query.data?.items ?? [];
  const items = base;
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
    setPage(1);
    void query.refetch();
  };

  return (
    <>
      <PageHeader icon="phone" title="سرنخ‌ها" description="هر شماره از «سرنخ اولیه» شروع می‌شود و مرحله‌به‌مرحله تا «خرید قطعی» جلو می‌رود.">
        <div className="flex gap-2 flex-wrap">
          {canImport ? (
            <Button variant="ghost" onClick={() => setImportOpen(true)}>
              ورود گروهی شماره‌ها
            </Button>
          ) : null}
          {canCreate ? (
            <Button onClick={() => setFormOpen(true)} leadingIcon={<span aria-hidden="true">+</span>}>
              سرنخ جدید
            </Button>
          ) : null}
        </div>
      </PageHeader>

      <Card>
        <div className="seg-tabs" role="tablist" aria-label="نوع محصول">{LEAD_LINES.map((l) => <button type="button" role="tab" key={l.key} aria-selected={filters.line === l.key} onClick={()=>{setPage(1);setFilters((f)=>({...f,line:l.key}));}}>{l.label}</button>)}</div>
        <nav className="lh-flow" role="tablist" aria-label="مرحله سرنخ">{BOARD_STAGES.map((s,index)=><button type="button" role="tab" data-stage={s} key={s} aria-selected={(filters.stage === "all" ? "raw" : filters.stage) === s} onClick={()=>{setPage(1);setFilters((f)=>({...f,stage:s}));}}><i>{s === "lost" ? "×" : toFaDigits(index+1)}</i><span>{stageLabel(s)}</span><b>{toFaDigits(query.data?.stageCounts?.[s] ?? byStage.get(s)?.length ?? 0)}</b></button>)}</nav>
        <form className="toolbar leads-filters" onSubmit={onSearch} role="search">
          <div className="field toolbar-field">
            <label className="field-label" htmlFor="leads-q">
              جستجو
            </label>
            <input
              id="leads-q"
              className="input"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
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
              onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, line: e.target.value as Filters["line"] })); }}
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
                { setPage(1); setFilters((f) => ({ ...f, stage: e.target.value as Filters["stage"] })); }
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
          <select className="select" aria-label="منبع ورود" value={source} onChange={(e)=>{setSource(e.target.value);setPage(1);}}><option value="">همه منابع</option>{LEAD_SOURCES.map((s)=><option key={s} value={s}>{s}</option>)}</select>
          {permissions.has("leads.viewAll") ? <select className="select" aria-label="کارشناس" value={owner} onChange={(e)=>{setOwner(e.target.value);setPage(1);}}><option value="">همه کارشناس‌ها</option>{(query.data?.owners ?? [...new Map(base.filter((l)=>l.ownerId).map((l)=>[l.ownerId,l.ownerName])).entries()].map(([id,name])=>({id:id!,name:name ?? "—"}))).map(({id,name})=><option key={id} value={id}>{name}</option>)}</select> : null}
          <label className="flex gap-2 items-center"><input type="checkbox" checked={near} onChange={(e)=>setNear(e.target.checked)} />فقط پیگیری‌های نزدیک</label>
          <Button type="button" variant="ghost" onClick={()=>setView((v)=>!v)}>{view ? "بورد" : "جدول"}</Button>
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
          {filters.stage !== "all" ? <LeadStageView stage={filters.stage} rows={byStage.get(filters.stage) ?? []} table={view} canMove={canMove} money={canSeeMoney} onOpen={setOpenLeadId} onFollowup={setFollowup} /> : <div className="board" aria-label="بورد سرنخ‌ها">
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
          </div>}
          {query.data && query.data.total > query.data.items.length ? (
            <div className="toolbar"><Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>صفحه قبل</Button><p className="text-muted">
              {toFaDigits(query.data.items.length)} سرنخ از {toFaDigits(query.data.total)} نمایش
              داده شد — با جستجو سرنخ موردنظر را پیدا کنید.
            </p><Button size="sm" variant="ghost" disabled={page * PAGE_SIZE >= query.data.total} onClick={() => setPage((p) => p + 1)}>صفحه بعد</Button></div>
          ) : null}
        </>
      )}

      <LeadQuickView leadId={openLeadId} onClose={() => setOpenLeadId(null)} />
      {followup ? <FollowupDialog open leadId={followup} onClose={()=>setFollowup(null)} /> : null}
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
