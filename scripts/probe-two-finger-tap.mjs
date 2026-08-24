// One-off CDP probe: a real two-finger tap on overlapping notes, driven with
// Input.dispatchTouchEvent so the browser makes genuine multi-touch pointer
// events (dispatchEvent cannot). Logs when each cap's .active class actually
// changes, relative to the touch, and how long the frames take meanwhile.
// Usage: node scripts/probe-two-finger-tap.mjs [cpuThrottle] [holdMs]
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const THROTTLE = Number(process.argv[2] ?? 1);
const HOLD_MS = Number(process.argv[3] ?? 60);

const browserWs = execSync("agent-browser get cdp-url").toString().trim();

const rpc = (ws) => {
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  });
  return (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
    });
};

const open = (url) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", reject);
  });

const ws = await open(browserWs);
const send = rpc(ws);

const { targetInfos } = await send("Target.getTargets");
const page = targetInfos.find((t) => t.type === "page" && t.url.includes("comp4020"));
if (!page) throw new Error("page target not found");
const { sessionId } = await send("Target.attachToTarget", { targetId: page.targetId, flatten: true });
const call = (method, params) => send(method, params, sessionId);

await call("Runtime.enable");
await call("Emulation.setCPUThrottlingRate", { rate: THROTTLE });

const evaluate = async (expression, awaitPromise = false) => {
  const r = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails, null, 2));
  return r.result.value;
};

// Page-side setup: find a triad corner in client coordinates, and start
// logging every .active class change with a timestamp.
const setup = readFileSync("scripts/probe-two-finger-setup.js", "utf8");
const target = await evaluate(setup);
console.log("target", target);

const touch = (type, points) =>
  call("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map((p, i) => ({ x: p[0], y: p[1], id: i + 1 })),
    timestamp: Date.now() / 1000,
  });

const A = [target.ax, target.ay];
const B = [target.bx, target.by];

await evaluate("window.__t0 = performance.now(), window.__log.length = 0, true");
await touch("touchStart", [A]);
await touch("touchStart", [A, B]); // second finger lands ~immediately after the first
await new Promise((r) => setTimeout(r, HOLD_MS));
await touch("touchEnd", [A]);
await touch("touchEnd", []);
await new Promise((r) => setTimeout(r, 900));

const log = await evaluate("JSON.stringify(window.__report())");
console.log(log);
ws.close();
