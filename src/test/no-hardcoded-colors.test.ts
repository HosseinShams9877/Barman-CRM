import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const scriptPath = resolve(projectRoot, "scripts/check-hardcoded-colors.mjs");

/**
 * آزمون خودکار «بدون رنگ hardcoded» (D-05 / A-1.5).
 * معادل اجرای `npm run check:colors` — هر رنگ خام جدید، این آزمون را خراب می‌کند.
 */
describe("D-05: بدون رنگ hardcoded", () => {
  it("هیچ رنگ خامی بیرون tokens.css/themes.css وجود ندارد", () => {
    let stdout = "";
    let stderr = "";
    let exit = 0;
    try {
      stdout = execFileSync(process.execPath, [scriptPath], {
        cwd: projectRoot,
        encoding: "utf8",
        env: { ...process.env },
      });
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string; status?: number };
      stdout = err.stdout ?? "";
      stderr = err.stderr ?? "";
      exit = err.status ?? 1;
    }
    expect.soft(exit, `colors check failed:\n${stdout}\n${stderr}`).toBe(0);
    expect(stdout).toContain("OK");
  });
});
