/**
 * بررسی واکنش‌گرایی در عرض‌های واقعی (CD-U / A-1.4 / CD-12).
 *
 * Chrome نصب‌شده را headless بالا می‌آورد، صفحه را در ۵ عرض
 * ۵۰۰ / ۷۶۸ / ۱۰۲۴ / ۱۲۸۰ / ۱۴۴۰ رندر می‌کند و گزارش می‌دهد:
 *   - lang/dir عنصر html
 *   - innerWidth واقعی
 *   - scrollWidth صفحه و آیا سرریز افقی هست یا نه
 *
 * اجرا: node scripts/viewport-check.mjs [url]
 * پیش‌فرض: http://localhost:3159/
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const URL_TO_CHECK = process.argv[2] ?? "http://localhost:3159/";
const WIDTHS = [500, 768, 1024, 1280, 1440];
const HEIGHT = 900;
const DEBUG_PORT = 9333;

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
  const opened = new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error("websocket خطا"));
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

    const expr = `(() => ({
      lang: document.documentElement.getAttribute("lang"),
      dir: document.documentElement.getAttribute("dir"),
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body ? document.body.scrollWidth : -1,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      title: document.title,
    }))()`;

    const results = [];
    for (const width of WIDTHS) {
      const emu = await page.send("Emulation.setDeviceMetricsOverride", {
        width,
        height: HEIGHT,
        deviceScaleFactor: 1,
        mobile: false,
      });
      if (emu && "error" in /** @type {object} */ (emu) && emu["error"]) {
        throw new Error(`Emulation خطا: ${JSON.stringify(emu["error"]).slice(0, 200)}`);
      }
      await page.send("Page.navigate", { url: URL_TO_CHECK });
      await sleep(2500);
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
        r["lang"] !== "fa",
    );
    const ok = bad.length === 0;
    console.log(ok ? "viewport-check: OK" : `viewport-check: FAIL — ${bad.length} مشکل`);
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
  console.error("viewport-check error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
