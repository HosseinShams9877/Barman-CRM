/**
 * ماژول سرنخ‌ها — لوله انتشار (CD-02 / PHASE_03 §۵).
 */
export { LeadBoard } from "./components/LeadBoard";
export { LeadColumn } from "./components/LeadColumn";
export { LeadCard } from "./components/LeadCard";
export type { LeadCardProps } from "./components/LeadCard";
export { LeadQuickView } from "./components/LeadQuickView";
export type { LeadQuickViewProps } from "./components/LeadQuickView";
export { FollowupDialog } from "./components/FollowupDialog";
export type { FollowupDialogProps } from "./components/FollowupDialog";
export { LostDialog } from "./components/LostDialog";
export type { LostDialogProps } from "./components/LostDialog";
export { LeadFormDialog } from "./components/LeadFormDialog";
export type { LeadFormDialogProps } from "./components/LeadFormDialog";
export { ImportDialog } from "./components/ImportDialog";
export type { ImportDialogProps } from "./components/ImportDialog";
export { useLeadsQuery, useLeadDetailQuery, useLeadFollowupsQuery } from "./hooks/useLeads";
export type { LeadListParams } from "./hooks/useLeads";
export { useLeadFilters, setLeadFilters, resetLeadFilters } from "./hooks/useLeadFilters";
export type { LeadFilters } from "./hooks/useLeadFilters";
export {
  useCreateLeadMutation,
  useUpdateLeadMutation,
  useMoveLeadStageMutation,
  useAddFollowupMutation,
  useImportLeadsMutation,
} from "./hooks/useLeadMutations";
export { invalidateLeads } from "./queries/invalidations";
export { queryKeys } from "./queries/keys";
export {
  createLeadSchema,
  updateLeadSchema,
  moveStageSchema,
  listLeadsQuerySchema,
  leadStageSchema,
  leadLineSchema,
  leadSourceSchema,
  createFollowupSchema,
} from "./schemas/lead.schema";
export { importLeadsSchema } from "./schemas/import.schema";
export type { ImportResult, ImportRowResult } from "./schemas/import.schema";
export {
  listLeads,
  getLead,
  createLead,
  updateLead,
  moveLeadStage,
  importLeads,
} from "./services/lead.service";
export type { LeadListScope } from "./services/lead.service";
export { listFollowups, addFollowup } from "./services/followup.service";
export {
  LEAD_STAGES,
  BOARD_STAGES,
  OPEN_STAGES,
  stageLabel,
  stageGroupOf,
  isOpenStage,
  isLostStage,
  isLeadStageKey,
  reviveTarget,
} from "./constants/STAGE";
export type { LeadStageKey, LeadStage } from "./constants/STAGE";
export { LEAD_LINES, lineLabel, isLeadLineKey } from "./constants/LINE";
export type { LeadLineKey, LeadLine } from "./constants/LINE";
export { LEAD_SOURCES, FOLLOWUP_RESULTS, LOST_REASONS } from "./constants/lists";
export type {
  LeadListItem,
  LeadDetail,
  LeadListResult,
  LeadCardPhones,
  FollowupRow,
  LeadStageKeyType,
} from "./types/lead.types";
