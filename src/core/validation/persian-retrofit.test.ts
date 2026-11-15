/**
 * آزمون retrofit پیام‌های فارسی Zod — PHASE_08 Part A (CD-28).
 *
 * دستور مالک فاز ۴: اسکیماهای فاز ۱–۳ ایرانی نشوند. فاز ۸ این شکاف را
 * می‌بندد: همه مسیرهای فاز ۱–۳ اکنون `faErrorMap` به `parseOrFail` پاس
 * می‌دهند. این آزمون اثبات می‌کند که پیام Issueهای زود بدون پیام صریح،
 * فارسی است — برای هر اسکیمای فاز ۱–۳.
 */
import { describe, expect, it } from "vitest";
import { faErrorMap } from "@core/validation";
import { loginSchema } from "@modules/auth/schemas";
import { createAccountSchema, updateAccountSchema, listAccountsQuerySchema } from "@modules/customers/schemas/account.schema";
import {
  createLeadSchema,
  updateLeadSchema,
  moveStageSchema,
  listLeadsQuerySchema,
} from "@modules/leads/schemas/lead.schema";
import { createFollowupSchema } from "../../modules/leads/schemas/lead.schema";
import { importLeadsSchema } from "../../modules/leads/schemas/import.schema";

const FA = { error: faErrorMap as never };

/** همه پیام‌های تولیدشده باید فارسی باشند — بدون کلمه کلیدی انگلیسی زود. */
function expectPersian(schema: unknown, raw: unknown): void {
  // @ts-expect-error — اسکمای زود در زمان اجرا فراخوانی می‌شود
  const res = schema.safeParse(raw, FA);
  if (res.success) {
    throw new Error("ورودی نامعتبر به‌عنوان معتبر پذیرفته شد — آزمون بی‌معنی است.");
  }
  const messages = res.error.issues.map((i: { message: string }) => i.message);
  expect(messages.length).toBeGreaterThan(0);
  for (const m of messages) {
    expect(m).toMatch(/[ا-ی]/); // حداقل یک حرف فارسی
  }
}

describe("retrofit پیام فارسی — اسکیماهای فاز ۱–۳", () => {
  it("فاز ۲: ورود (loginSchema)", () => {
    expectPersian(loginSchema, {});
  });

  it("فاز ۳: حساب مشتری (create/update/list)", () => {
    expectPersian(createAccountSchema, { kind: "customer", phones: [{ number: "x" }] });
    expectPersian(updateAccountSchema, { phones: [{ number: "" }] });
    expectPersian(listAccountsQuerySchema, { page: "abc", pageSize: "xyz" });
  });

  it("فاز ۳: سرنخ (create/update/move/list)", () => {
    expectPersian(createLeadSchema, { stage: "alien" });
    expectPersian(updateLeadSchema, { amount: "غلط" });
    expectPersian(moveStageSchema, { to: "nope" });
    expectPersian(listLeadsQuerySchema, { page: "abc", stage: "weird" });
  });

  it("فاز ۳: پیگیری و واردات CSV", () => {
    expectPersian(createFollowupSchema, { kind: "weird" });
    expectPersian(importLeadsSchema, { rows: "not-an-array" });
  });
});
