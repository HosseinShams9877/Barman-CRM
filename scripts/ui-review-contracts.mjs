import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { browser, artifacts, pause } from "./ui-review-cdp.mjs";

const origin = process.env.UI_REVIEW_ORIGIN || "http://localhost:3159";
const b = await browser();
const checks = [];
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
async function check(name, action) {
  try { checks.push({ name, passed: true, evidence: await action() }); console.log(`PASS ${name}`); }
  catch (error) { checks.push({ name, passed: false, error: error.message }); console.log(`FAIL ${name}: ${error.message}`); }
}
async function request(path, method = "GET", body) {
  return b.evaluate(`fetch(${JSON.stringify(path)}, {method:${JSON.stringify(method)},headers:{'Content-Type':'application/json'},${body ? `body:${JSON.stringify(JSON.stringify(body))}` : ''}}).then(async r=>({status:r.status,data:await r.json()}))`);
}
async function login(role) {
  await b.send("Network.clearBrowserCookies");
  await b.navigate(origin + "/login");
  ensure((await request("/api/auth/login", "POST", { name: `ui-review-${role}`, password: "Review1405!" })).status === 200, "Login failed");
  await b.navigate(origin + (role === "production" ? "/production" : "/"));
  await pause(400);
}
async function visit(path, width = 1440) {
  await b.send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
  await b.navigate(origin + path);
  await b.waitFor("!document.querySelector('.loading-state')", 30000);
  await pause(250);
}
async function click(selector) {
  await b.evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing control');e.click();})()`);
  await pause(600);
}
async function type(selector, value) {
  await b.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  for (const text of value) await b.send("Input.insertText", { text });
  ensure(await b.evaluate(`document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(value)}`), "Characters lost while typing");
}
try {
  await login("admin");
  for (const [path, hashes] of [
    ["/finance", ["pay", "rec", "txns", "cashflow"]],
    ["/reports", ["sales", "prod", "fin", "leads"]],
    ["/stock", ["raw", "depot", "moves", "in"]],
    ["/production", ["stock", "hist", "overview"]],
  ]) await check(`click-tabs ${path}`, async () => {
    await visit(path);
    const evidence = [];
    for (const hash of hashes) {
      const selector = `main a[role=tab][href="#${hash}"]`;
      await click(selector);
      await b.waitFor(`document.querySelector(${JSON.stringify(selector)})?.getAttribute('aria-selected')==='true'`);
      evidence.push({ hash, selected: true });
    }
    ensure(!b.errors().length, "Browser error during tab clicks");
    return evidence;
  });
  await check("employee-save-refresh", async () => {
    await visit("/admin/users");
    await b.evaluate("[...document.querySelectorAll('main button')].find(e=>e.textContent.trim()==='کاربر جدید').click()");
    const name = `ui-created-${Date.now()}`;
    await type('input[name="uname"]', name);
    await type('input[name="utitle"]', "بارمان");
    await type('input[name="upassword"]', "Review1405!");
    await b.evaluate("document.querySelector('#user-form').requestSubmit()");
    await b.waitFor(`!document.querySelector('[role=dialog]')&&document.querySelector('main').textContent.includes(${JSON.stringify(name)})`);
    ensure(!b.errors().length, "Error saving employee");
    return { saved: true, refreshedWithoutReload: true, cloneOnly: true };
  });
  await check("order-buckets-pagination", async () => {
    const evidence = [];
    for (const [bucket, stages] of [["pf",[1,2,3]], ["cust",[4,5]], ["make",[6,7,8]], ["depot",[9,10]], ["deliv",[11]]]) {
      const { status, data } = await request(`/api/orders?bucket=${bucket}&pageSize=2`);
      ensure(status === 200 && data.items.every(o=>stages.includes(o.stage)&&o.status==='open'), "Invalid bucket rows");
      ensure(data.items.length<=2&&data.total>=data.items.length, "Pagination failed");
      evidence.push({ bucket, stages: data.items.map(o=>o.stage), total: data.total });
    }
    return evidence;
  });
  await check("incoming-cheque-refresh-history", async () => {
    await visit("/finance#rec-c");
    const original = (await request("/api/orders/PF-UI05")).data;
    const cheque = original.cheques[0];
    ensure(cheque && cheque.status === 'hand', "Expected review cheque in hand");
    await b.evaluate("[...document.querySelectorAll('main tbody tr')].find(r=>r.textContent.includes('PF-UI05')).querySelector('button').click()");
    await b.waitFor("[...document.querySelectorAll('main tbody tr')].some(r=>r.textContent.includes('PF-UI05')&&r.textContent.includes('در بانک'))");
    await b.evaluate("[...document.querySelectorAll('main tbody tr')].find(r=>r.textContent.includes('PF-UI05')).querySelector('button').click()");
    await b.waitFor("[...document.querySelectorAll('main tbody tr')].some(r=>r.textContent.includes('PF-UI05')&&r.textContent.includes('وصول شد'))");
    const updated = (await request("/api/orders/PF-UI05")).data;
    ensure(updated.paid===original.paid+cheque.amount, "Paid total did not refresh");
    ensure(!b.errors().length, "Browser error updating cheque");
    return { handToBankToClear: true, clearedChequeRemainsVisible: true, paidDelta: cheque.amount };
  });
  await check("outgoing-cheque-refresh-history", async () => {
    await visit("/finance#pay-c");
    await b.evaluate("[...document.querySelectorAll('main tbody tr')].find(r=>r.textContent.includes('BY-UI-fin')).querySelector('button').click()");
    await b.waitFor("[...document.querySelectorAll('main tbody tr')].some(r=>r.textContent.includes('BY-UI-fin')&&r.textContent.includes('پاس شد'))");
    ensure(!b.errors().length, "Browser error paying cheque");
    return { issuedToPaid: true, paidChequeRemainsVisible: true };
  });
  await login("sales");
  await check("sales-owner-scope", async () => {
    const me = (await request("/api/auth/me")).data.user.id;
    const leads = (await request('/api/leads?ownerId=another-user&pageSize=100')).data;
    const orders = (await request('/api/orders?ownerId=another-user&pageSize=100')).data;
    ensure(leads.items.every(l=>l.ownerId===me), "Lead scope leak");
    ensure(orders.items.every(o=>o.ownerId===me), "Order scope leak");
    const denied = await request('/api/leads/board','PATCH',{id:'LD-UI-other',stage:'raw',column:'retry'});
    ensure(denied.status===403, "Foreign lead column update was allowed");
    return { ownLeads: leads.total, ownOrders: orders.total, foreignColumnUpdate: denied.status };
  });
  await check("lead-mobile-column-persistence", async () => {
    await b.evaluate("localStorage.setItem('barman.leads.filters.v1',JSON.stringify({line:'prod',stage:'raw',q:''}))");
    await visit('/leads?q=LD-UI-own',500);
    const original = await b.evaluate("document.querySelector('.kc select').value");
    const target = await b.evaluate("[...document.querySelector('.kc select').options].find(o=>o.value!==document.querySelector('.kc select').value).value");
    await b.evaluate(`(() => {const e=document.querySelector('.kc select');e.focus();e.value=${JSON.stringify(target)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await b.waitFor(`document.querySelector('.kc select')?.value===${JSON.stringify(target)}`);
    await visit('/leads?q=LD-UI-own',500);
    ensure(await b.evaluate(`document.querySelector('.kc select').value===${JSON.stringify(target)}`), "Column not persisted");
    ensure((await request('/api/leads/board','PATCH',{id:'LD-UI-own',stage:'raw',column:original})).status===200, "Restore failed");
    return { selected: target, persistedAcrossReload: true, restored: true };
  });
  await check("lead-native-drag-persistence", async () => {
    await visit('/leads?q=LD-UI-own',1440);
    const column = await b.evaluate("document.querySelector('.kc select').value");
    const target = await b.evaluate("[...document.querySelector('.kc select').options].find(o=>o.value!==document.querySelector('.kc select').value).value");
    const point = await b.evaluate(`(() => {const i=[...document.querySelector('.kc select').options].findIndex(o=>o.value===${JSON.stringify(target)});const rect=document.querySelectorAll('.kb-col')[i].getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+80};})()`);
    for (const type of ['dragEnter','dragOver','drop']) await b.send('Input.dispatchDragEvent',{type,...point,data:{items:[{mimeType:'text/plain',data:'LD-UI-own'}],dragOperationsMask:1}});
    await pause(500);
    await visit('/leads?q=LD-UI-own',1440);
    ensure(await b.evaluate(`document.querySelector('.kc select').value===${JSON.stringify(target)}`), "Drag move not persisted");
    ensure((await request('/api/leads/board','PATCH',{id:'LD-UI-own',stage:'raw',column})).status===200, "Restore failed");
    return { nativeChromeDrag: true, persistedAcrossReload: true, restored: true };
  });
  for (const role of ['production','depot']) {
    await login(role);
    await check(`noMoney ${role}`, async () => {
      const orders = (await request('/api/orders?pageSize=100')).data;
      const detail = (await request('/api/orders/PF-UI07')).data;
      const buys = (await request('/api/buys')).data;
      const products = (await request('/api/catalog/products')).data;
      const home = (await request('/api/home/summary')).data;
      ensure(orders.items.every(o=>!['calc','paid','balance','discPct'].some(k=>k in o)), "Money in order list");
      ensure(!['calc','paid','balance','discPct','discAmt','ship','install'].some(k=>k in detail), "Money in detail");
      ensure(detail.items.every(i=>!('price' in i))&&detail.cheques.every(c=>!('amount' in c)), "Nested money leak");
      ensure(buys.items.every(o=>!('calc' in o)), "Money in buys");
      ensure(products.items.every(p=>!('price' in p)), "Money in catalogue");
      ensure(home.workspace.orders.every(o=>!('total' in o))&&!('finance' in home.workspace), "Money in workspace");
      return { orderList: true, orderDetail: true, nestedItems: true, buys: true, catalogue: true, workspace: true };
    });
  }
} finally {
  writeFileSync(resolve(artifacts,'contracts.json'),JSON.stringify(checks,null,2));
  b.close();
}
console.log(JSON.stringify({checks:checks.length,failures:checks.filter(c=>!c.passed).length}));
if(checks.some(c=>!c.passed))process.exitCode=1;
