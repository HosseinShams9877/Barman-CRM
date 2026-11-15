"use client";

import { useState } from "react";
import { stageLabel } from "../constants/STAGE";
import type { LeadStageKey } from "../constants/STAGE";
import type { LeadListItem } from "../types/lead.types";
import { LeadCard } from "./LeadCard";

export type LeadColumnProps = {
  stage: LeadStageKey;
  leads: LeadListItem[];
  canSeeMoney: boolean;
  canMove: boolean;
  onOpen: (lead: LeadListItem) => void;
  onMove: (lead: LeadListItem, to: LeadStageKey) => void;
  onDrop: (leadId: string, to: LeadStageKey) => void;
};

/**
 * ستون بورد سرنخ‌ها — یک مرحله با کارت‌های آن (PHASE_03 §۱۰).
 *
 * بدنه ستون یک هدف رهاکردن (drop target) است: `dragover` پیش‌فرض
 * را لغو می‌کند تا HTML5 DnD کار کند و صفت `data-drop-active` را
 * برای بازخورد بصری تنظیم می‌کند (CD-12).
 */
export function LeadColumn({
  stage,
  leads,
  canSeeMoney,
  canMove,
  onOpen,
  onMove,
  onDrop,
}: LeadColumnProps) {
  const [dropActive, setDropActive] = useState<boolean>(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!dropActive) setDropActive(true);
  };

  const handleDragLeave = (): void => {
    if (dropActive) setDropActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setDropActive(false);
    const leadId = e.dataTransfer.getData("text/plain");
    if (leadId.length > 0) onDrop(leadId, stage);
  };

  return (
    <section className="board-col" aria-label={`ستون ${stageLabel(stage)}`}>
      <div className="board-col-head">
        <span>{stageLabel(stage)}</span>
        <span className="tag-chip" data-tone="info">
          {leads.length}
        </span>
      </div>
      <div
        className="board-col-body"
        data-drop-active={dropActive ? "true" : undefined}
        onDragOver={canMove ? handleDragOver : undefined}
        onDragLeave={handleDragLeave}
        onDrop={canMove ? handleDrop : undefined}
      >
        {leads.length === 0 ? (
          <p className="text-muted">سرنخی در این مرحله نیست.</p>
        ) : (
          leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              canSeeMoney={canSeeMoney}
              canMove={canMove}
              onOpen={() => onOpen(lead)}
              onMove={(to) => onMove(lead, to)}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", lead.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={handleDragLeave}
            />
          ))
        )}
      </div>
    </section>
  );
}
