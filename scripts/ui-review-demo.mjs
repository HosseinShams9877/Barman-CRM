import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { browser, artifacts, root, pause } from "./ui-review-cdp.mjs";

const b = await browser();
const results = [];
try {
  await b.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  for (const [page, role] of [["home", "management"], ["home", "sales"], ["home", "finance"], ["home", "depot"], ["leads", "salesManager"], ["flow", "management"], ["orders", "management"], ["order", "management"], ["stock", "management"], ["prod", "production"], ["buy", "management"], ["fin", "finance"], ["reports", "management"], ["admin", "admin"]]) {
    const file = pathToFileURL(resolve(root, "پلتفرم نهایی تیم بارمان/app", `${page}.html`));
    file.search = `as=${role}`;
    if (page === "order") file.search += "&new=1";
    await b.navigate(file.href);
    await pause(200);
    await b.screenshot(`demo-${page}-${role}`);
    const content = await b.evaluate(`(() => ({
      page: location.href,
      headings: [...document.querySelectorAll('h1,h2,h3,h4')].map(x=>x.textContent),
      tables: [...document.querySelectorAll('table')].map(t=>[...t.querySelectorAll('thead th')].map(x=>x.textContent)),
      buttons: [...document.querySelectorAll('#page button')].map(x=>x.textContent),
      text: document.querySelector('#page')?.innerText,
      nav: [...document.querySelectorAll('.side-nav a,.side-cap')].map(x=>({text:x.textContent,href:x.getAttribute('href')})),
      styles: Object.fromEntries(['.side','.side-brand','.side-nav a','.side-cap','.topbar','.card','.page-head','.ph','.tbl th','.input','.btn','.pv-hi'].map(s=>{const e=document.querySelector(s);const c=e&&getComputedStyle(e);return [s,c?{padding:c.padding,fontSize:c.fontSize,gap:c.gap,border:c.border,background:c.background,margin:c.margin,height:c.height,color:c.color}:null]})),
    }))()`);
    results.push({ page, role, ...content, errors: b.errors() });
    console.log(page, role, JSON.stringify({ headings: content.headings, tables: content.tables }));
  }
  await b.navigate(pathToFileURL(resolve(root, "پلتفرم نهایی تیم بارمان/app/admin.html")).href + "?as=admin");
  for (const tab of ["products", "materials", "bom", "customers", "suppliers", "users", "lists", "leadcols", "settings"]) {
    await b.evaluate(`location.hash=${JSON.stringify(tab)}`); await pause(300);
    await b.screenshot(`demo-admin-${tab}`);
    results.push({ page: "admin", tab, text: await b.evaluate("document.querySelector('#page')?.innerText"), tables: await b.evaluate("[...document.querySelectorAll('table')].map(t=>[...t.querySelectorAll('thead th')].map(x=>x.textContent))") });
  }
  writeFileSync(resolve(artifacts, "demo-panels.json"), JSON.stringify(results, null, 2));
} finally { b.close(); }
