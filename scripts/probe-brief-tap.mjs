// One-off CDP probe: does a very brief tap ever get painted? Drives one real
// touch at a range of hold durations and reports, for each, whether any
// animation frame ran while the cap was lit — a class added and removed inside
// one frame is correct in the DOM and invisible on screen.
// Usage: node scripts/probe-brief-tap.mjs [holdMs...]
//
// Its globals are namespaced because they have to be: another probe's
// MutationObserver, still attached from an earlier run on the same page, will
// keep writing into a shared log with timestamps from its own epoch, and the
// readings come out negative. Reload between probes.
import { execSync } from "node:child_process";

const HOLDS = process.argv.slice(2).map(Number);
const holds = HOLDS.length ? HOLDS : [2, 8, 16, 33, 60, 120];

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

const evaluate = async (expression, awaitPromise = false) => {
  const r = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails, null, 2));
  return r.result.value;
};

// Count animation frames continuously, and log the frame count at each class
// change on the lit layer. Same count in and out = never painted lit.
await evaluate(`(() => {
  const surface = document.querySelector("[data-instrument]");
  window.__tapFrames = 0;
  const tick = () => { window.__tapFrames++; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  window.__tapLog = [];
  new MutationObserver((rs) => {
    for (const r of rs) window.__tapLog.push({
      frame: window.__tapFrames,
      t: +performance.now().toFixed(1),
      on: r.target.classList.contains("active"),
      pc: r.target.dataset.pc,
    });
  }).observe(surface.querySelector(".lit"), { subtree: true, attributes: true, attributeFilter: ["class"] });
  return true;
})()`);

const point = await evaluate(`(() => {
  const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2).closest("[data-pc]");
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
})()`);

const touch = (type, points) =>
  call("Input.dispatchTouchEvent", { type, touchPoints: points, timestamp: Date.now() / 1000 });

for (const hold of holds) {
  await evaluate("window.__tapLog.length = 0, true");
  await touch("touchStart", [{ x: point.x, y: point.y, id: 1 }]);
  await new Promise((r) => setTimeout(r, hold));
  await touch("touchEnd", []);
  await new Promise((r) => setTimeout(r, 400));
  const log = await evaluate("JSON.stringify(window.__tapLog)");
  const events = JSON.parse(log);
  const on = events.find((e) => e.on);
  const off = events.find((e) => !e.on);
  const framesLit = on && off ? off.frame - on.frame : null;
  console.log(
    `hold ${String(hold).padStart(4)} ms  ->  lit for ${off && on ? (off.t - on.t).toFixed(1) : "?"} ms,` +
      ` ${framesLit} animation frame(s)  ${framesLit === 0 ? "  <-- never painted lit" : ""}`,
  );
}
ws.close();
