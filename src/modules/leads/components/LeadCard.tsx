"use client";

import { formatMoney, formatPhoneFa, toFaDigits } from "@core/formatting";
import { parseJalali, formatJalaliFa } from "@core/calendar";
import { BOARD_STAGES, stageLabel, stageGroupOf } from "../constants/STAGE";
import type { LeadStageKey } from "../constants/STAGE";
import { lineLabel } from "../constants/LINE";
import type { LeadListItem } from "../types/lead.types";

export type LeadCardProps = {
  lead: LeadListItem;
  /** نمایش مبلغ فقط با مجوز money.view (CD-05). */
  canSeeMoney: boolean;
  /** جابه‌جایی مرحله مجاز است (leads.edit). */
  canMove: boolean;
  onOpen: () => void;
  /** انتقال از راه select (موبایل) — برای lost به دیالوگ دلیل می‌رسد. */
  onMove: (to: LeadStageKey) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
};

/**
 * کارت سرنخ در ستون بورد — PHASE_03 §۱۰.
 *
 * عنوان (یا نخستین شماره)، برچسب خط، مرحله و تاریخ پیگیری بعدی را نشان
 * می‌دهد. مبلغ فقط با مجوز `money.view` نمایش داده می‌شود (CD-05).
 * HTML5 drag&drop در دسکتاپ و select انتقال در موبایل (CD-12).
 */
export function LeadCard({
  lead,
  canSeeMoney,
  canMove,
  onOpen,
  onMove,
  onDragStart,
  onDragEnd,
}: LeadCardProps) {
  const title = lead.title.length > 0 ? lead.title : (lead.account?.phones[0] ?? lead.id);
  const parsedNext = lead.nextAt ? parseJalali(lead.nextAt) : null;
  const nextAt = parsedNext ? formatJalaliFa(parsedNext) : null;
  const isLost = lead.stage === "lost";

  return (
    <div
      className="lead-card"
      draggable={canMove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="lead-card-title">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onOpen}
          aria-label={`جزئیات سرنخ ${lead.id}`}
        >
          {title}
        </button>
      </div>
      <div className="lead-card-meta">
        <span className="tag-chip" data-tone="info">
          {lineLabel(lead.line)}
        </span>
        <span className="stage-chip" data-stage-group={stageGroupOf(lead.stage)}>
          {stageLabel(lead.stage)}
        </span>
        {isLost && lead.lostReason ? (
          <span className="tag-chip" data-tone="danger">
            {lead.lostReason}
          </span>
        ) : null}
      </div>
      {lead.account && lead.account.phones.length > 0 ? (
        <div className="lead-card-meta">
          {lead.account.phones.slice(0, 2).map((p) => (
            <span key={p} className="text-muted" dir="ltr">
              {formatPhoneFa(p)}
            </span>
          ))}
        </div>
      ) : null}
      <div className="lead-card-foot">
        {canSeeMoney && lead.amount !== null ? (
          <span className="text-muted">{formatMoney(lead.amount)} ریال</span>
        ) : null}
        {nextAt ? (
          <span className="text-muted">پیگیری بعدی: {toFaDigits(nextAt)}</span>
        ) : null}
      </div>
      {canMove ? (
        <div className="lead-card-foot md:hidden">
          <label className="field-label" htmlFor={`move-${lead.id}`}>
            انتقال مرحله
          </label>
          <select
            id={`move-${lead.id}`}
            className="select"
            value={lead.stage}
            onChange={(e) => onMove(e.target.value as LeadStageKey)}
          >
            {BOARD_STAGES.map((s) => (
              <option key={s} value={s}>
                {stageLabel(s)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}
