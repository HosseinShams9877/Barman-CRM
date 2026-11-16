import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const root = resolve(import.meta.dirname, "..");
export const artifacts = resolve(root, ".cache/ui-parity");
export const pause = (ms) => new Promise((done) => setTimeout(done, ms));
export async function browser() {
  mkdirSync(artifacts, { recursive: true });
  const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
    "--headless=new", "--remote-debugging-port=9345", "--disable-gpu", "--no-first-run", "--no-sandbox",
    "--no-default-browser-check", "--disable-background-networking", "--disable-component-update", "--disable-extensions",
    `--user-data-dir=${resolve(artifacts, "chrome")}`, `--disk-cache-dir=${resolve(artifacts, "chrome-cache")}`,
    "about:blank",
  ], { stdio: "ignore", windowsHide: true, env: { ...process.env, TEMP: resolve(artifacts, "tmp"), TMP: resolve(artifacts, "tmp") } });
  let tab;
  for (let i = 0; i < 60; i++) {
    try { tab = await (await fetch("http://127.0.0.1:9345/json/new?about:blank", { method: "PUT" })).json(); break; }
    catch { await pause(200); }
  }
  if (!tab) throw new Error("Chrome debugger did not start");
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  const pending = new Map();
  const events = [];
  let id = 0;
  await new Promise((done, reject) => { ws.onopen = done; ws.onerror = reject; });
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(String(data));
    if (message.id) {
      const p = pending.get(message.id);
      if (p) { clearTimeout(p.timeout); pending.delete(message.id); message.error ? p.reject(new Error(JSON.stringify(message.error))) : p.done(message.result); }
    } else events.push(message);
  };
  const send = (method, params = {}) => new Promise((done, reject) => {
    const callId = ++id;
    const timeout = setTimeout(() => { pending.delete(callId); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
    pending.set(callId, { done, reject, timeout });
    ws.send(JSON.stringify({ id: callId, method, params }));
  });
  await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable"); await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ": " + (r.exceptionDetails.exception?.description ?? ""));
    return r.result.value;
  };
  const waitFor = async (expression, timeout = 25000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) { if (await evaluate(expression)) return; await pause(200); }
    throw new Error(`Browser condition timed out: ${expression}`);
  };
  const navigate = async (url) => {
    events.length = 0;
    await send("Page.navigate", { url });
    await waitFor("document.readyState === 'complete'");
    await pause(1200);
  };
  const screenshot = async (name) => {
    // Capturing beyond the viewport can offset RTL fixed layers in headless
    // Chrome. Capture the actual viewport used by the browser verification.
    const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(resolve(artifacts, `${name}.png`), Buffer.from(data, "base64"));
  };
  const errors = () => events.flatMap((e) => {
    if (e.method === "Runtime.exceptionThrown") return [{ type: "exception", message: e.params.exceptionDetails.exception?.description ?? e.params.exceptionDetails.text }];
    if (e.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(e.params.type)) return [{ type: e.params.type, message: e.params.args.map((a) => a.value ?? a.description).join(" ") }];
    if (e.method === "Log.entryAdded" && ["error", "warning"].includes(e.params.entry.level)) return [{ type: e.params.entry.level, message: e.params.entry.text }];
    if (e.method === "Network.responseReceived" && e.params.response.status >= 400) return [{ type: "http", status: e.params.response.status, url: e.params.response.url }];
    if (e.method === "Network.loadingFailed" && !e.params.canceled) return [{ type: "network", message: e.params.errorText }];
    return [];
  });
  return { send, evaluate, waitFor, navigate, screenshot, errors, events, close: () => { ws.close(); chrome.kill(); } };
}
