"use client";

import { useState } from "react";
import { Button, Dialog } from "@components/ui";
import { ErrorState, LoadingState } from "@components/feedback";
import { useMeQuery } from "@modules/auth/hooks/useAuth";
import { formatMoney, formatPhoneFa, toFaDigits } from "@core/formatting";
import {
  TEHRAN_UTC_OFFSET_MS,
  instantToJalaliIso,
  parseJalali,
  formatJalaliFa,
} from "@core/calendar";
import type { JalaliDate } from "@core/calendar";
import { useLeadDetailQuery } from "../hooks/useLeads";
import { useMoveLeadStageMutation } from "../hooks/useLeadMutations";
import { BOARD_STAGES, stageLabel, stageGroupOf, reviveTarget } from "../constants/STAGE";
import type { LeadStageKey } from "../constants/STAGE";
import { lineLabel } from "../constants/LINE";
import type { FollowupRow } from "../types/lead.types";
import { FollowupDialog } from "./FollowupDialog";
import { LostDialog } from "./LostDialog";

export type LeadQuickViewProps = {
  /** شناسه سرنخ — `null` یعنی بسته. */
  leadId: string | null;
  onClose: () => void;
};

/** نوع رویداد تاریخچه → برچسب فارسی (app/lead-core.js:72). */
const KIND_LABELS: Readonly<Record<string, string>> = Object.freeze({
  in: "ورود سرنخ",
  stage: "جابه‌جایی مرحله",
  note: "پیگیری",
  lost: "از دست رفتن",
});

const MS_PER_DAY = 86_400_000;

/** مهر زمان UTC ms → تاریخ شمسی + ساعت تهران (CD-06 / CD-07). */
function formatInstantFa(ms: number): string {
  const date = toFaDigits(instantToJalaliIso(ms));
  const sinceMidnight = (ms + TEHRAN_UTC_OFFSET_MS) % MS_PER_DAY;
  const totalMinutes = Math.floor(sinceMidnight / 60_000);
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const mm = String(totalMinutes % 60).padStart(2, "0");
  return `${date} ساعت ${toFaDigits(hh)}:${toFaDigits(mm)}`;
}

/** نمایش ایمن تاریخ خالص شمسی. */
function formatJalaliFaSafe(iso: string): string {
  const parsed: JalaliDate | null = parseJalali(iso);
  return parsed ? formatJalaliFa(parsed) : toFaDigits(iso);
}

/**
 * نمای سریع سرنخ — جزئیات + تاریخچه پیگیری + عملیات (PHASE_03 §۱۰).
 *
 * عملیات بر اساس مجوز کلاینت پنهان می‌شوند (R-02) — سرور همچنان منبع
 * حقیقت است و هر درخواست دوباره بررسی می‌شود (CD-04).
 */
export function LeadQuickView({ leadId, onClose }: LeadQuickViewProps) {
  const me = useMeQuery();
  const permissions = new Set(me.data?.permissions ?? []);
  const canEdit = permissions.has("leads.edit");
  const canSeeMoney = permissions.has("money.view");

  const detail = useLeadDetailQuery(leadId);
  const moveStage = useMoveLeadStageMutation();
  const [followupOpen, setFollowupOpen] = useState<boolean>(false);
  const [lostOpen, setLostOpen] = useState<boolean>(false);

  const handleMove = (to: LeadStageKey): void => {
    if (leadId === null) return;
    moveStage.mutate({ id: leadId, data: { to } });
  };

  const handleRevive = (): void => {
    if (leadId === null || detail.data === undefined) return;
    moveStage.mutate({
      id: leadId,
      data: { to: reviveTarget(detail.data.lostFrom), reason: "بازگردانده شد" },
    });
  };

  if (leadId === null) return null;

  if (detail.isLoading) {
    return (
      <Dialog open={true} onClose={onClose} size="lg" title="جزئیات سرنخ">
        <LoadingState label="در حال بارگذاری جزئیات سرنخ…" />
      </Dialog>
    );
  }

  if (detail.isError || detail.data === undefined) {
    return (
      <Dialog open={true} onClose={onClose} size="lg" title="جزئیات سرنخ">
        <ErrorState
          title="بارگذاری ناموفق"
          message={detail.error?.message ?? "خطا در دریافت جزئیات سرنخ."}
          onRetry={() => void detail.refetch()}
          retrying={detail.isFetching}
        />
      </Dialog>
    );
  }

  const lead = detail.data;
  const title = lead.title.length > 0 ? lead.title : (lead.account?.phones[0] ?? lead.id);

  return (
    <>
      <Dialog
        open={true}
        onClose={onClose}
        size="lg"
        title={title}
        description={
          <span dir="ltr">
            {lead.id} — {lineLabel(lead.line)}
          </span>
        }
      >
        <div className="stack gap-4">
          <div className="lead-card-meta">
            <span className="stage-chip" data-stage-group={stageGroupOf(lead.stage)}>
              {stageLabel(lead.stage)}
            </span>
            {lead.stage === "lost" && lead.lostReason ? (
              <span className="tag-chip" data-tone="danger">
                {lead.lostReason}
              </span>
            ) : null}
            <span className="tag-chip" data-tone="info">
              منبع: {lead.source}
            </span>
            <span className="text-muted">کارشناس: {lead.ownerName ?? "—"}</span>
          </div>

          {lead.account ? (
            <div className="stack gap-1">
              {lead.account.name.length > 0 ? (
                <p>
                  <strong>{lead.account.name}</strong>
                </p>
              ) : null}
              {lead.account.phones.map((p) => (
                <span key={p} className="text-muted" dir="ltr">
                  {formatPhoneFa(p)}
                </span>
              ))}
            </div>
          ) : null}

          {canSeeMoney && lead.amount !== null ? (
            <p>
              مبلغ تخمینی: <strong>{formatMoney(lead.amount)} ریال</strong>
            </p>
          ) : null}

          {lead.note.length > 0 ? <p className="text-muted">{lead.note}</p> : null}

          {canEdit ? (
            <div className="toolbar">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFollowupOpen(true)}
                disabled={moveStage.isPending}
              >
                چی شد؟
              </Button>
              {BOARD_STAGES.filter((s) => s !== lead.stage && s !== "lost").map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="ghost"
                  onClick={() => handleMove(s)}
                  disabled={moveStage.isPending}
                >
                  ← {stageLabel(s)}
                </Button>
              ))}
              {lead.stage === "lost" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRevive}
                  disabled={moveStage.isPending}
                  isLoading={moveStage.isPending}
                >
                  بازگرداندن به {stageLabel(reviveTarget(lead.lostFrom))}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setLostOpen(true)}
                  disabled={moveStage.isPending}
                >
                  از دست رفت
                </Button>
              )}
            </div>
          ) : null}

          {moveStage.error ? (
            <p className="field-error" role="alert">
              {moveStage.error.message}
            </p>
          ) : null}

          <h3 className="h3">تاریخچه</h3>
          {lead.followups.length === 0 ? (
            <p className="text-muted">هنوز رویدادی ثبت نشده است.</p>
          ) : (
            <div className="timeline">
              {lead.followups.map((f: FollowupRow) => (
                <article key={f.id} className="timeline-item">
                  <div className="timeline-item-head">
                    <span className="tag-chip" data-tone="info">
                      {KIND_LABELS[f.kind] ?? f.kind}
                    </span>
                    <span className="text-muted">{formatInstantFa(f.at)}</span>
                  </div>
                  {f.result.length > 0 ? <p className="timeline-note">نتیجه: {f.result}</p> : null}
                  {f.note.length > 0 ? <p className="timeline-note">{f.note}</p> : null}
                  <div className="timeline-item-head">
                    {f.nextAt ? (
                      <span className="text-muted">
                        پیگیری بعدی: {formatJalaliFaSafe(f.nextAt)}
                      </span>
                    ) : null}
                    {f.byName ? <span className="text-muted">{f.byName}</span> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </Dialog>

      {followupOpen ? (
        <FollowupDialog
          open={followupOpen}
          leadId={leadId}
          onClose={() => setFollowupOpen(false)}
        />
      ) : null}
      {lostOpen ? (
        <LostDialog open={lostOpen} leadId={leadId} onClose={() => setLostOpen(false)} />
      ) : null}
    </>
  );
}
