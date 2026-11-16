import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { browser, artifacts, pause } from "./ui-review-cdp.mjs";

const origin = process.env.UI_REVIEW_ORIGIN || "http://localhost:3159";
const b = await browser();
const results = { origin, login: [], pages: [], forms: [], navigation: [], interactions: [] };
const save = () => writeFileSync(resolve(artifacts,"verification.json"),JSON.stringify(results,null,2));
const click = async (label, exact = false) => {
  const found = await b.evaluate(`(() => { const dialogs=[...document.querySelectorAll('[role=dialog]')];const root=dialogs.at(-1)||document.querySelector('main')||document;const button=[...root.querySelectorAll('button')].find(b => ${exact ? "b.textContent.trim() === " : "b.textContent.includes("}${JSON.stringify(label)}${exact ? "" : ")"}); if(!button)return false;button.click();return true; })()`);
  if (!found) throw new Error(`Button missing: ${label}`);
  await pause(500);
};
async function settled() {
  await b.waitFor("!document.querySelector('.loading-state')",40000);
  await pause(400);
}
async function page(role,path,width=1440) {
  await b.send("Emulation.setDeviceMetricsOverride",{width,height:1000,deviceScaleFactor:1,mobile:false});
  if(path.startsWith('/leads')) await b.evaluate("localStorage.setItem('barman.leads.filters.v1',JSON.stringify({line:'prod',stage:'raw',q:''}))");
  await b.navigate(origin+path);
  await settled();
  const info=await b.evaluate("({title:document.querySelector('.ac-head h1, .pv-hi h2, .login-title')?.textContent, bodyWidth:document.documentElement.scrollWidth, width:innerWidth, tabs:[...document.querySelectorAll('[role=tab]')].map(t=>({label:t.textContent,selected:t.getAttribute('aria-selected')})), headings:[...document.querySelectorAll('main h1, main h2, main h3')].map(h=>h.textContent), columns:[...document.querySelectorAll('main th')].map(t=>t.textContent)})");
  results.pages.push({role,path,width,...info,errors:b.errors()});
  if(width===1440 || path==="/")await b.screenshot(`after-${role}-${path.replace(/[^a-z0-9]/gi,'-')}-${width}`);
  save();console.log(`PAGE ${role} ${path} ${width}: ${b.errors().length} errors; overflow=${info.bodyWidth>width}`);
}
async function login(role,real=false) {
  await b.send("Network.clearBrowserCookies");
  await b.navigate(origin+"/login");
  if(real) {
    for(const [selector,text] of [["#login-name",`ui-review-${role}`],["#login-password","Review1405!"]]) {
      await b.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
      for(const ch of text)await b.send("Input.insertText",{text:ch});
    }
    await b.evaluate("document.querySelector('form.login-form').requestSubmit()");
    await b.waitFor("location.pathname !== '/login'",40000);
    await settled();
  } else {
    const status=await b.evaluate(`fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:${JSON.stringify(`ui-review-${role}`)},password:'Review1405!'})}).then(r=>r.status)`);
    if(status!==200)throw new Error(`Login ${role}: ${status}`);
  }
  results.login.push({role,real,errors:b.errors()});save();
}
async function typeFields(name,scope="[role=dialog]") {
  await settled();
  if(scope === "[role=dialog]") { await b.evaluate("document.querySelectorAll('[role=dialog]').item(document.querySelectorAll('[role=dialog]').length-1).dataset.reviewScope='active'"); scope="[data-review-scope=active]"; }
  const fields=await b.evaluate(`(() => { const root=document.querySelector(${JSON.stringify(scope)});if(!root)throw new Error('Form scope missing');return [...root.querySelectorAll('input,textarea')].filter(e=>!e.disabled && !e.readOnly && e.getClientRects().length && !['checkbox','radio','file','color','hidden','submit','button'].includes(e.type)).map((e,i)=>{e.dataset.reviewInput=String(i);return {index:i,type:e.type,inputMode:e.inputMode,id:e.id,name:e.name,label:e.labels?.[0]?.textContent||e.getAttribute('aria-label')||'',placeholder:e.placeholder};});})()`);
  await b.screenshot(`form-${name}-before`);
  const checks=[];
  for(const field of fields) {
    const selector=`${scope} [data-review-input="${field.index}"]`;
    const target=/تاریخ|سررسید|پایان|140|۱۴۰/.test(field.label+field.placeholder) ? "1405/08/25" : field.type === "email" ? "barman@example.com" : /تلفن|شماره تماس|شماره همراه|phone|موبایل/.test(field.label+field.name) ? "09121234567" : /sayad|صیاد/.test(field.label+field.name) ? "1234567890123456" : field.type === "number" || ["numeric","decimal"].includes(field.inputMode) ? "12345" : field.type === "password" ? "Barman123!" : "بارمان";
    await b.evaluate(`window.__reviewNode=document.querySelector(${JSON.stringify(selector)});window.__reviewNode.focus()`);
    await b.send("Input.dispatchKeyEvent",{type:"keyDown",key:"a",code:"KeyA",modifiers:2,windowsVirtualKeyCode:65});
    await b.send("Input.dispatchKeyEvent",{type:"keyUp",key:"a",code:"KeyA",modifiers:2,windowsVirtualKeyCode:65});
    await b.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Backspace",code:"Backspace",windowsVirtualKeyCode:8});
    await b.send("Input.dispatchKeyEvent",{type:"keyUp",key:"Backspace",code:"Backspace",windowsVirtualKeyCode:8});
    let prefix="";const steps=[];
    for(const ch of target) {
      prefix+=ch;await b.send("Input.insertText",{text:ch});await pause(30);
      const step=await b.evaluate(`({active:document.activeElement===window.__reviewNode,same:document.querySelector(${JSON.stringify(selector)})===window.__reviewNode,value:window.__reviewNode.value})`);
      steps.push({...step,expected:prefix});
    }
    checks.push({...field,target,steps,passed:steps.every((s)=>s.active&&s.same&&s.value===s.expected)});
  }
  const controls = await b.evaluate(`(() => {const root=document.querySelector(${JSON.stringify(scope)});return [...root.querySelectorAll('select,input[type=checkbox],input[type=radio]')].filter(e=>!e.disabled&&e.getClientRects().length).map((e,i)=>{e.dataset.reviewControl=String(i);return {index:i,type:e.type,id:e.id,options:e.options?[...e.options].map(o=>({value:o.value,disabled:o.disabled})):null,value:e.value,checked:e.checked};});})()`);
  const selections=[];
  if(!fields.length && !controls.length) throw new Error("Expected editable fields or selectable controls but found none");
  // Mode radios deliberately replace their dependent controls. Exercise them last
  // and restore the original mode after each check, so each variant is tested.
  controls.sort((a,c)=>(a.type==='radio'?2:a.type==='checkbox'?1:0)-(c.type==='radio'?2:c.type==='checkbox'?1:0));
  for(const c of controls) {
    const selector=`${scope} [data-review-control="${c.index}"]`;
    const originalRadio= c.type==='radio' ? await b.evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});return [...document.querySelectorAll(${JSON.stringify(scope+' input[type=radio]')})].find(r=>r.name===e.name&&r.checked)?.dataset.reviewControl;})()`) : null;
    const options=c.options?.filter(o=>!o.disabled).slice(0,4)??[{value:c.value}];
    for(const o of options) {
      await b.evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Control missing');window.__reviewControl=e;e.focus();if(e.tagName==='SELECT'){Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(o.value)});e.dispatchEvent(new Event('change',{bubbles:true}));}else e.click();})()`);
      await pause(100);
      const stable=await b.evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});return {active:!!e&&document.activeElement===e,present:!!e,same:e===window.__reviewControl,value:e?.value,checked:e?.checked};})()`);
      const selected=c.options ? stable.value===o.value : c.type==='radio' ? stable.checked===true : stable.checked===!c.checked;
      selections.push({...c,option:o.value,...stable,selected});
    }
    await b.evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});if(!e)return;if(e.tagName==='SELECT'){Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(c.value)});e.dispatchEvent(new Event('change',{bubbles:true}));}else if(e.type==='checkbox'&&e.checked!==${JSON.stringify(c.checked)})e.click();${originalRadio === null || originalRadio === undefined ? '' : `else if(e.type==='radio')document.querySelector(${JSON.stringify(scope+' [data-review-control="'+originalRadio+'"]')})?.click();`}})()`);
    await pause(120);
  }
  results.forms.push({name,scope,fields:checks,controls:selections,errors:b.errors()});save();console.log(`FORM ${name}: ${checks.length} inputs, ${checks.filter(c=>!c.passed).length} failures`);
}
async function form(role,path,button,name,scope="[role=dialog]",prepare=[]) {
  try {await page(role,path);if(button)await click(button);for(const action of prepare){if(action.startsWith("js:"))await b.evaluate(action.slice(3));else await click(action);await settled();}await typeFields(name,scope);if(scope==="[role=dialog]"){await b.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",windowsVirtualKeyCode:27});await pause(200);}}
  catch(error){results.forms.push({name,error:error.message});save();console.log(`FORM ERROR ${name}: ${error.message}`);}
}

try {
  mkdirSync(artifacts,{recursive:true});
  await login("admin",true);
  if(!process.env.UI_REVIEW_FORMS_ONLY) for(const path of ["/","/leads","/customers","/orders","/production","/stock","/buys","/finance","/reports","/admin","/admin/products","/admin/materials","/admin/bom","/admin/customers","/admin/suppliers","/admin/users","/admin/lists","/admin/leadcols","/admin/settings"]) {
    try{await page("admin",path);}catch(error){results.pages.push({role:"admin",path,error:error.message,errors:b.errors()});save();console.log(`PAGE ERROR ${path}: ${error.message}`);}
  }
  for(const [path,button,name,scope,prepare] of [
    ["/admin/users","کاربر جدید","employee-create"],["/admin/users","ویرایش","employee-edit"],
    ["/admin/products","محصول جدید","product-create"],["/admin/products","ویرایش","product-edit"],
    ["/admin/materials","ماده اولیه جدید","material-create"],["/admin/materials","ویرایش","material-edit"],
    ["/admin/suppliers","تأمین‌کننده جدید","supplier-create"],["/admin/suppliers","ویرایش","supplier-edit"],
    ["/admin/customers","حساب جدید","account-create","[role=dialog]",["افزودن تلفن","افزودن مخاطب","افزودن تلفن","افزودن مخاطب"]],["/admin/customers","ویرایش","account-edit","[role=dialog]",["افزودن تلفن","افزودن مخاطب"]],
    ["/admin/settings",null,"settings","main"],["/admin/lists",null,"lists","main"],
    ["/admin/leadcols",null,"lead-columns","main"],["/admin/bom",null,"bom","main",["افزودن ماده"]],
    ["/leads","سرنخ جدید","lead-create"],["/orders?new=1",null,"order-create","[role=dialog]",["افزودن قلم"]],
    ["/production#stock","کار جدید","job-create"],["/stock#out",null,"move-inline","main"],
    ["/stock#moves","ثبت حرکت","move-create"],["/stock#moves","ویرایش","move-edit"],
    ["/buys?new=1",null,"buy-create","[role=dialog]",["افزودن قلم"]],["/finance","ثبت هزینه / دریافت","transaction-create"],
    ["/finance#rec", "بازه دلخواه", "finance-date-filters", "main"],
  ]) await form("admin",path,button,name,scope,prepare);

  for(const [path,button,name,scope,prepare] of [
    ["/leads", "ورود گروهی", "lead-import"],
    ["/leads", "ثبت تماس", "lead-followup"],
    ["/leads", null, "lead-lost", "[role=dialog]", ["js:document.querySelector('.kc-title').click()", "از دست رفت"]],
    ["/leads", null, "lead-followup-nested", "[role=dialog]", ["js:document.querySelector('.kc-title').click()", "چی شد؟"]],
    ["/orders/PF-UI01", "ویرایش", "order-edit"],
    ["/orders/PF-UI05", null, "payment-plan-custom", "[data-review-plan]", ["js:document.querySelectorAll('input[name=plan-mode]')[1].click(); document.querySelector('input[name=plan-mode]').closest('form').dataset.reviewPlan=''" ]],
    ["/orders/PF-UI05", null, "payment-plan-amount", "[data-review-plan]", ["js:document.querySelectorAll('input[name=plan-mode]')[1].click();document.querySelector('#plan-premode').value='amt';document.querySelector('#plan-premode').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('input[name=plan-mode]').closest('form').dataset.reviewPlan=''" ]],
    ["/orders/PF-UI05", null, "order-payment", "[data-review-form]", ["js:document.querySelector('#pay-amount').closest('form').dataset.reviewForm=''" ]],
    ["/orders/PF-UI05", null, "order-cheque", "[data-review-form]", ["js:document.querySelector('#cheque-amount').closest('form').dataset.reviewForm=''" ]],
    ["/orders/PF-UI01", null, "order-cancel", "[data-review-form]", ["js:document.querySelector('main form:last-of-type textarea[id*=cancel]').closest('form').dataset.reviewForm=''" ]],
    ["/production/PJ-99003", "ثبت کنترل کیفیت", "job-qc"],
    ["/production/PJ-99004", "دریافت در دپو", "job-receive"],
    ["/buys/BY-UI-req", "ویرایش", "buy-edit", "[role=dialog]", ["افزودن قلم"]],
    ["/buys/BY-UI-ok", "تأیید مالی", "buy-finance", "[role=dialog]", ["افزودن چک","افزودن چک"]],
  ]) await form("admin",path,button,name,scope,prepare);
  for(let stage=1;stage<=11;stage++) {
    const path="/orders/PF-UI"+String(stage).padStart(2,"0");
    await form("admin",path,null,"order-stage-"+stage,"[data-review-form]",["js:document.querySelector('main form').dataset.reviewForm=''"]);
    if(stage===2||stage===3||stage===9)await form("admin",path,null,"order-stage-"+stage+"-secondary","[data-review-form]",["js:document.querySelectorAll('main form')[1].dataset.reviewForm=''"]);
  }
  for(const [path,name,scope] of [
    ["/admin/products","product-filters","main"],
    ["/leads","lead-filters","main"], ["/orders","order-filters","main"],
    ["/customers","account-filters","main"], ["/production#stock","job-filters","main"],
    ["/stock#depot","stock-filters","main"], ["/stock#moves","move-filters","main"],
    ["/buys","buy-filters","main"], ["/finance#txns","transaction-filters","main"],
    ["/finance#cashflow","cashflow-filters","main"], ["/reports#sales","report-filters","main"],
    ["/orders","navbar-search","header.topbar"], ["/login","login-inputs","form.login-form"],
  ]) await form("admin",path,null,name,scope);

  if(!process.env.UI_REVIEW_FORMS_ONLY) for(const role of ["management","finance","salesManager","sales","production","depot"]) {
    await login(role,true);
    const home=role==="production" ? "/production" : "/";
    await page(role,home);
    const nav=await b.evaluate("[...document.querySelectorAll('.side-link')].map(a=>({label:a.textContent.trim(),href:a.getAttribute('href')}))");
    results.navigation.push({role,links:nav});
    for(const link of nav) {try{await page(role,link.href);}catch(error){results.pages.push({role,path:link.href,error:error.message,errors:b.errors()});save();}}
    for(const width of [500,768,1024,1280,1440]) {await page(role,home,width);if(width<1024){await b.evaluate("document.querySelector('.menu-btn').click()");const open=await b.evaluate("document.querySelector('.sidebar').getAttribute('data-open')");results.navigation.push({role,width,drawerOpen:open});await b.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",windowsVirtualKeyCode:27});}}
  }
  if(!process.env.UI_REVIEW_FORMS_ONLY) { await login("admin");
  for(const path of ["/stock#raw","/stock#in","/stock#moves","/production#use","/production#hist","/finance#rec-d","/finance#rec-c","/finance#pay","/finance#pay-d","/finance#pay-c","/finance#txns","/finance#cashflow","/reports#leads","/reports#sales","/reports#prod","/reports#fin"])await page("admin",path);
  for(const width of [500,768,1024,1280,1440])for(const path of ["/login","/leads","/customers","/orders","/production","/stock","/buys","/finance","/reports","/admin/users"])await page("admin",path,width);
  }
} finally {save();b.close();}
const pageErrors=results.pages.filter(p=>p.error||p.errors?.length||p.bodyWidth>p.width);
const formErrors=results.forms.filter(f=>f.error||f.errors?.length||f.fields?.some(i=>!i.passed)||f.controls?.some(c=>!c.active||!c.present||!c.same||!c.selected));
console.log(JSON.stringify({pages:results.pages.length,forms:results.forms.length,pageErrors:pageErrors.length,formErrors:formErrors.map(f=>({name:f.name,error:f.error,failed:f.fields?.filter(i=>!i.passed).map(i=>i.label)}))},null,2));
if(pageErrors.length||formErrors.length)process.exitCode=1;
