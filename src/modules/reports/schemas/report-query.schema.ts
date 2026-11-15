/**
 * اسکیمای فرمان گزارش — PHASE_07 §۹.
 *
 * فیلترهای Demo (reports.js:56-58): بازه روزهای اخیر و نوع خط محصول.
 */
import { z } from "zod";

/** بازه‌های ثابت Demo — reports.js:57. */
export const REPORT_DAYS = [30, 90, 180, 365] as const;

export const reportQuerySchema = z.object({
  days: z.coerce.number().int().refine((d) => (REPORT_DAYS as readonly number[]).includes(d), {
    message: "بازه نامعتبر است.",
  }),
  line: z.enum(["prod", "agency"]).optional(),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;

/** نوع گزارش — reports.js TABS. */
export const REPORT_KINDS = ["leads", "sales", "prod", "fin"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_KIND_LABELS: Readonly<Record<ReportKind, string>> = {
  leads: "سرنخ‌ها و منبع ورود",
  sales: "فروش",
  prod: "تولید و مواد",
  fin: "مالی",
};
