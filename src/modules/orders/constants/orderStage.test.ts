import { describe, expect, it } from "vitest";
import {
  LAST_STAGE_STEP,
  ORDER_STAGES,
  STAGE_GROUP_LABELS,
  STAGE_GROUP_TOKENS,
  TERMINAL_STAGE_TOKENS,
  getStage,
  stageGroup,
  stageToken,
  type StageGroup,
} from "./orderStage";

const GROUPS: readonly StageGroup[] = ["sales", "approval", "production", "fulfillment"];

describe("orderStage (Q-09)", () => {
  it("دقیقاً ۱۱ مرحله با کلید و شماره یکتا وجود دارد", () => {
    expect(ORDER_STAGES).toHaveLength(11);
    expect(LAST_STAGE_STEP).toBe(11);
    const keys = ORDER_STAGES.map((s) => s.key);
    expect(new Set(keys).size).toBe(11);
    expect(ORDER_STAGES.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("هر مرحله دقیقاً به یکی از ۴ گروه معنایی نگاشته می‌شود", () => {
    for (const stage of ORDER_STAGES) {
      expect(GROUPS).toContain(stage.group);
    }
  });

  it("گروه‌بندی مطابق Q-09: sales=۱/۲/۴، approval=۳/۵، production=۶/۷/۸، fulfillment=۹/۱۰/۱۱", () => {
    const byGroup = (g: StageGroup) =>
      ORDER_STAGES.filter((s) => s.group === g).map((s) => s.step);
    expect(byGroup("sales")).toEqual([1, 2, 4]);
    expect(byGroup("approval")).toEqual([3, 5]);
    expect(byGroup("production")).toEqual([6, 7, 8]);
    expect(byGroup("fulfillment")).toEqual([9, 10, 11]);
  });

  it("هر گروه دقیقاً یک توکن رنگ معنایی دارد", () => {
    expect(Object.keys(STAGE_GROUP_TOKENS)).toHaveLength(4);
    for (const g of GROUPS) {
      const token = STAGE_GROUP_TOKENS[g];
      expect(token.startsWith("var(--color-stage-")).toBe(true);
      expect(token.endsWith(")")).toBe(true);
    }
    // توکن‌ها یکتا — چهار رنگ متمایز
    expect(new Set(Object.values(STAGE_GROUP_TOKENS)).size).toBe(4);
  });

  it("stageToken هر مرحله به توکن گروه آن مرحله است", () => {
    for (const stage of ORDER_STAGES) {
      expect(stageToken(stage.key)).toBe(STAGE_GROUP_TOKENS[stage.group]);
      expect(stageGroup(stage.key)).toBe(stage.group);
      expect(getStage(stage.key)).toBe(stage);
    }
  });

  it("برچسب‌های فارسی همه مراحل پر شده است", () => {
    for (const stage of ORDER_STAGES) {
      expect(stage.label.trim().length).toBeGreaterThan(0);
    }
    expect(STAGE_GROUP_LABELS).toEqual({
      sales: "فروش",
      approval: "تأیید",
      production: "تولید",
      fulfillment: "تحویل",
    });
  });

  it("حالت‌های پایانی از توکن success/danger استفاده می‌کنند (بیرون خط لوله)", () => {
    expect(TERMINAL_STAGE_TOKENS.done).toBe("var(--color-success)");
    expect(TERMINAL_STAGE_TOKENS.cancelled).toBe("var(--color-danger)");
  });
});
