/**
 * بررسی واکنکشگرایی در عرض‌های واقعی — نسخه احراز‌هویت‌شده (CD-12).
 *
 * مشابه `viewport-check.mjs` ولی نشست را از فایل کوکی (قالب Netscape که
 * curl -c می‌نویسد) می‌خواند و پیش از ناوبری با `Network.setCookie` در
 * مرورگر قرار می‌دهد. کاربرد: صفحاتی که بدون ورود به /login هدایت
 * می‌شوند (مثل LeadsBoard و AccountList).
 *
 * اجرا:
 *   node scripts/viewport-check-auth.mjs [url] [cookie-file]
 *
 * پیش‌فرض‌ها:
 *   url          = http://localhost:3159/leads
 *   cookie-file  = .cookies.tmp (دقت کنید: هرگز در git commit نشود)
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const URL_TO_CHECK = process.argv[2] ?? "http://localhost:3159/leads";
const COOKIE_FILE = process.argv[3] ?? ".cookies.tmp";
const WIDTHS = [500, 768, 1024, 1280, 1440];
const HEIGHT = 900;
const DEBUG_PORT = 9334;

const CHROME_CANDIDATES = [
  process.env["CHROME_PATH"],
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
];

const chromePath = CHROME_CANDIDATES.find((p) => p && existsSync(p));
if (!chromePath) {
  console.error("chrome پیدا نشد. CHROME_PATH را تنظیم کنید.");
  process.exit(2);
}

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * خواندن کوکی `br_s` از فایل قالب Netscape (curl -c).
 * @returns {{name: string, value: string}}
 */
function readSessionCookie() {
  if (!existsSync(COOKIE_FILE)) {
    throw new Error(`فایل کوکی پیدا نشد: ${COOKIE_FILE}`);
  }
  const lines = readFileSync(COOKIE_FILE, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    // کوکی‌های HttpOnly با پیشوند `#HttpOnly_` نوشته می‌شوند و همچنان
    // ردیف داده‌ای هستند — فقط خط‌های توضیحی خالص (`#` و سپس فاصله) رد می‌شوند.
    const line = raw.startsWith("#HttpOnly_") ? raw.slice("#HttpOnly_".length) : raw;
    if (line.startsWith("#") || line.trim() === "") continue;
    const cols = line.split("\t");
    // domain, includeSubdomains, path, secure, expiry, name, value
    if (cols.length >= 7 && cols[5] === "br_s") {
      return { name: "br_s", value: cols[6] };
    }
  }
  throw new Error("کوکی br_s در فایل پیدا نشد — ابتدا با curl وارد شوید.");
}

async function waitForDebugger() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (res.ok) return;
    } catch {
      // هنوز بالا نمی‌آید
    }
    await sleep(200);
  }
  throw new Error("Chrome debugger بالا نیامد");
}

async function openBlankTab() {
  const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, {
    method: "PUT",
  });
  if (!res.ok) throw new Error(`json/new ناموفق: ${res.status}`);
  return res.json();
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  /** @type {Map<number, (v: unknown) => void>} */
  const pending = new Map();
  const opened = new Promise((resolve) => {
    ws.onopen = resolve;
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (typeof msg["id"] === "number" && pending.has(msg["id"])) {
      pending.get(msg["id"])?.(msg);
      pending.delete(msg["id"]);
    }
  };
  /**
   * @param {string} method
   * @param {Record<string, unknown>} [params]
   */
  const send = (method, params) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, resolve);
      ws.send(JSON.stringify({ id: mid, method, params }));
      setTimeout(() => {
        if (pending.delete(mid)) reject(new Error(`timeout: ${method}`));
      }, 20000);
    });
  return { ws, opened, send };
}

async function main() {
  const cookie = readSessionCookie();
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${DEBUG_PORT}`,
      "--no-sandbox",
      "--disable-gpu",
      "--window-size=1280,900",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  try {
    await waitForDebugger();
    const tab = await openBlankTab();
    const page = connect(/** @type {string} */ (tab["webSocketDebuggerUrl"]));
    await page.opened;
    await page.send("Page.enable");
    await page.send("Network.enable");

    const expr = `(() => ({
      lang: document.documentElement.getAttribute("lang"),
      dir: document.documentElement.getAttribute("dir"),
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body ? document.body.scrollWidth : -1,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      title: document.title,
      // محتوای واقعی صفحه (نه هدایت به ورود)
      hasBoard: !!document.querySelector("[data-board], .board"),
      hasTable: !!document.querySelector("table"),
      cards: document.querySelectorAll("[data-lead-card], .lead-card").length,
      tableRows: document.querySelectorAll("tbody tr").length,
      emptyState: !!document.querySelector("[data-empty-state], .empty-state"),
      inLogin: window.location.pathname.startsWith("/login"),
      url: window.location.pathname,
    }))()`;

    const results = [];
    for (const width of WIDTHS) {
      await page.send("Emulation.setDeviceMetricsOverride", {
        width,
        height: HEIGHT,
        deviceScaleFactor: 1,
        mobile: false,
      });
      // کوکی را پیش از هر ناوبری تازه‌سازی کن (مرورگر ممکن است پاک کند)
      await page.send("Network.setCookie", {
        name: cookie.name,
        value: cookie.value,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      });
      await page.send("Page.navigate", { url: URL_TO_CHECK });
      await sleep(3500);
      const res = await page.send("Runtime.evaluate", {
        expression: expr,
        returnByValue: true,
      });
      const result = res?.["result"]?.["result"]?.["value"];
      if (!result) {
        throw new Error(
          `Runtime.evaluate بدون نتیجه: ${JSON.stringify(res).slice(0, 300)}`,
        );
      }
      results.push({ width, ...result });
    }
    page.ws.close();
    console.log(JSON.stringify(results, null, 2));
    const bad = results.filter(
      (r) =>
        r["horizontalOverflow"] ||
        r["innerWidth"] !== r["width"] ||
        r["dir"] !== "rtl" ||
        r["lang"] !== "fa" ||
        r["inLogin"],
    );
    const ok = bad.length === 0;
    console.log(
      ok
        ? "viewport-check-auth: OK"
        : `viewport-check-auth: FAIL — ${JSON.stringify(bad)}`,
    );
    process.exit(ok ? 0 : 1);
  } finally {
    try {
      chrome.kill();
    } catch {
      // نادیده
    }
  }
}

main().catch((e) => {
  console.error("viewport-check-auth error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
