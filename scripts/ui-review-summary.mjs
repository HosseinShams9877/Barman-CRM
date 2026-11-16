import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const artifacts = resolve(root, ".cache/ui-parity");
const read = (name) => JSON.parse(readFileSync(resolve(artifacts, name), "utf8").replace(/^\uFEFF/, ""));
const verification = read("verification.json");
const contracts = read("contracts.json");
const formFailures = verification.forms.filter((form) => form.error || form.errors?.length || form.fields?.some((field) => !field.passed) || form.controls?.some((control) => !control.active || !control.present || !control.same || !control.selected));
const pageFailures = verification.pages.filter((page) => page.error || page.errors?.length || page.bodyWidth > page.width);
const summary = {
  origin: verification.origin,
  realRoleLogins: verification.login.filter((login) => login.real).length,
  loginErrors: verification.login.filter((login) => login.errors?.length).length,
  pages: verification.pages.length,
  forms: verification.forms.length,
  typedFields: verification.forms.reduce((count, form) => count + (form.fields?.length ?? 0), 0),
  typedCharacters: verification.forms.reduce((count, form) => count + (form.fields?.reduce((total, field) => total + field.steps.length, 0) ?? 0), 0),
  selections: verification.forms.reduce((count, form) => count + (form.controls?.length ?? 0), 0),
  widths: [...new Set(verification.pages.map((page) => page.width))].sort((a, b) => a - b),
  pageFailures,
  formFailures,
  contractChecks: contracts.length,
  contractFailures: contracts.filter((check) => !check.passed),
  formsChecked: verification.forms.map((form) => ({ name: form.name, typedFields: form.fields?.length ?? 0, typedCharacters: form.fields?.reduce((count, field) => count + field.steps.length, 0) ?? 0, selections: form.controls?.length ?? 0 })),
};
writeFileSync(resolve(artifacts, "verification-summary.json"), JSON.stringify(summary, null, 2));

const demo = resolve(root, "پلتفرم نهایی تیم بارمان");
function manifest(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return manifest(path);
    const name = relative(demo, path);
    // Protected files are presence-only. Their contents are never read.
    if ([".env.local", ".secrets.local.json"].includes(entry.name)) return [{ name, present: true }];
    return [{ name, sha256: createHash("sha256").update(readFileSync(path)).digest("hex") }];
  });
}
const before = read("demo-before.json");
const after = manifest(demo);
writeFileSync(resolve(artifacts, "demo-after.json"), JSON.stringify(after, null, 2));
const same = JSON.stringify(before) === JSON.stringify(after);
const integrity = { identical: same, entries: after.length, hashesCompared: after.filter((entry) => entry.sha256).length, protectedFilesPresenceOnly: after.filter((entry) => entry.present).map((entry) => entry.name) };
writeFileSync(resolve(artifacts, "demo-integrity.json"), JSON.stringify(integrity, null, 2));
console.log(JSON.stringify({ ...summary, formsChecked: undefined, demoIntegrity: integrity }, null, 2));
if (!same || summary.loginErrors || pageFailures.length || formFailures.length || summary.contractFailures.length) process.exitCode = 1;
