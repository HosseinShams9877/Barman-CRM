/**
 * ماژول تولید — کارهای تولید و BOM (CD-02 / PHASE_05 §۵).
 *
 * گذارهای وضعیت هر کدام همراه با حرکت‌های انبار اجرا می‌شوند
 * (شروع: کسر مواد؛ دریافت: ورود به دپو) — PHASE_05 §۸.
 */
// components
export { JobList } from "./components/JobList";
export { JobDetail } from "./components/JobDetail";
export type { JobDetailProps } from "./components/JobDetail";
export { JobFormDialog } from "./components/JobFormDialog";
export type { JobFormDialogProps } from "./components/JobFormDialog";
export { BomPreview, computeBomLines } from "./components/BomPreview";
export type { BomPreviewProps } from "./components/BomPreview";
// hooks
export { useJobsQuery, useJobDetailQuery } from "./hooks/useJobs";
export {
  useCreateJobMutation,
  useUpdateJobMutation,
  useStartJobMutation,
  useQcJobMutation,
  useReceiveJobMutation,
} from "./hooks/useJobMutations";
// queries
export { invalidateProduction } from "./queries/invalidations";
// schemas
export {
  createJobSchema,
  updateJobSchema,
  qcSchema,
  receiveJobSchema,
  jobListQuerySchema,
  jobIdParamSchema,
  DEFAULT_END_MS,
} from "./schemas/job.schema";
export type {
  CreateJobInput,
  UpdateJobInput,
  QcInput,
  ReceiveInput,
} from "./types/job.types";
// services
export { listJobs, getJob, createJob, startJob, updateJob, qcJob, receiveJob } from "./services/job.service";
export { computeBomNeed, buildBomPreview, round3 } from "./services/bom.service";
// constants
export {
  JOB_STATUS,
  JOB_STATUS_LABELS,
  JOB_STEP_NAMES,
  JOB_TRANSITIONS,
  JOB_ID_PREFIX,
  JOB_END_DEFAULT_DAYS,
  JOB_MESSAGES,
} from "./constants";
export type { JobStatus } from "./constants";
// types
export type {
  BomLine,
  BomPreview as BomPreviewResult,
  JobRow,
  JobDetail as JobDetailData,
  JobListParams,
  JobListResult,
} from "./types/job.types";
