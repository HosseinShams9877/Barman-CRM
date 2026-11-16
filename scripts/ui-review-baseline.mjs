import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { browser, artifacts, pause } from "./ui-review-cdp.mjs";

const b = await browser();
const results = [];
try {
  await b.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await b.send("Network.clearBrowserCookies");
  await b.navigate("http://localhost:3159/login");
  await b.waitFor("document.querySelector('#login-name') !== null");
  await b.screenshot("before-login");
  results.push({ page: "login", errors: b.errors() });
  // Use the actual login form and keyboard events, with isolated review credentials.
  await b.evaluate("document.querySelector('#login-name').focus()");
  await b.send("Input.insertText", { text: "ui-review-admin" });
  await b.evaluate("document.querySelector('#login-password').focus()");
  await b.send("Input.insertText", { text: "Review1405!" });
  await b.evaluate("document.querySelector('form.login-form').requestSubmit()");
  await pause(4000);
  results.push({ page: "login-submit", errors: b.errors(), text: await b.evaluate("document.body.innerText.slice(-2000)") });
  // Reset with a fresh document after capturing the login failure.
  await b.navigate("http://localhost:3159/admin/users");
  await b.waitFor("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'کاربر جدید')");
  await b.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'کاربر جدید').click()");
  await b.evaluate("document.querySelector('input[name=uname]').focus()");
  const typing = [];
  for (const ch of "Barman") {
    await b.send("Input.insertText", { text: ch }); await pause(60);
    typing.push(await b.evaluate("({value:document.querySelector('input[name=uname]').value,active:document.activeElement.name||document.activeElement.className})"));
  }
  results.push({ page: "user-form", typing, errors: b.errors() });
  await b.screenshot("before-user-form");
  writeFileSync(resolve(artifacts, "baseline.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { b.close(); }
