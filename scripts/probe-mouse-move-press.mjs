// One-off CDP probe: does moving the mouse with no button held press anything?
// Drives real mouse events and reports the lit-cap count after each, then does
// a real press and drag to check the press path still refines while held.
// Usage: node scripts/probe-mouse-move-press.mjs
import { execSync } from "node:child_process";

const open = (url) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", reject);
  });

const ws = await open(execSync("agent-browser get cdp-url").toString().trim());
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
  }
});
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
  });

const { targetInfos } = await send("Target.getTargets");
const page = targetInfos.find((t) => t.type === "page" && t.url.includes("comp4020"));
const { sessionId } = await send("Target.attachToTarget", { targetId: page.targetId, flatten: true });
const call = (m, p) => send(m, p, sessionId);
await call("Runtime.enable");

const evaluate = async (expression) => {
  const r = await call("Runtime.evaluate", { expression, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails, null, 2));
  return r.result.value;
};

const lit = () => evaluate(`document.querySelectorAll(".lit [data-pc].active").length`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const mouse = (type, x, y, buttons) =>
  call("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    button: type === "mouseMoved" ? (buttons ? "left" : "none") : "left",
    buttons,
    clickCount: type === "mousePressed" || type === "mouseReleased" ? 1 : 0,
  });

const step = async (label, run) => {
  await run();
  await wait(200); // past the 80 ms lit floor
  console.log(`${label.padEnd(38)} ${await lit()} lit`);
};

const cx = await evaluate("Math.round(innerWidth / 2)");
const cy = await evaluate("Math.round(innerHeight / 2)");

await step("move, no button (before any click)", () => mouse("mouseMoved", cx, cy, 0));
await step("move again, no button", () => mouse("mouseMoved", cx + 40, cy + 20, 0));
await step("press", () => mouse("mousePressed", cx + 40, cy + 20, 1));
await step("drag, button held", () => mouse("mouseMoved", cx + 70, cy + 35, 1));
await step("release", () => mouse("mouseReleased", cx + 70, cy + 35, 0));
await step("move after the release", () => mouse("mouseMoved", cx + 100, cy + 50, 0));
await step("move once more", () => mouse("mouseMoved", cx + 130, cy + 65, 0));

ws.close();
