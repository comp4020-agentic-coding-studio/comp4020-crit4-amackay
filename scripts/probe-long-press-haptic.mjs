// One-off CDP probe for the long-press haptic (DESIGN.md "Known issues"): a
// real touch held on the surface for well past the long-press threshold,
// dispatched with Input.dispatchTouchEvent so Chromium's own gesture detector
// runs. The buzz itself is an Android platform effect no page can observe, so
// this measures the gesture behind it: a `contextmenu` from a held touch is
// GestureLongPress having been recognised and delivered. No long-press
// gesture, nothing for the haptic to hang off.
//
// Also reports user activation after the press, because the candidate fix
// (preventDefault on touchstart) is only usable if the audio unlock survives
// it. Usage: node scripts/probe-long-press-haptic.mjs [--prevent] [holdMs]
import { execSync } from "node:child_process";

const PREVENT = process.argv.includes("--prevent");
const HOLD_MS = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 1400);

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
await call("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });

const evaluate = async (expression, awaitPromise = false) => {
  const r = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails, null, 2));
  return r.result.value;
};

// Page-side: log every event the press could produce, on the surface and on
// the window, with a timestamp relative to the touch down.
const setup = `(() => {
  const surface = document.querySelector("[data-instrument]");
  window.__log = [];
  window.__t0 = 0;
  const at = () => Math.round(performance.now() - window.__t0);
  for (const type of ["touchstart", "touchend", "contextmenu", "selectstart", "click", "dblclick",
                      "pointerdown", "pointerup", "pointercancel"]) {
    window.addEventListener(type, (e) => window.__log.push({ type, at: at(), target: e.target.tagName }), true);
  }
  ${PREVENT ? 'surface.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });' : ""}
  const rect = surface.getBoundingClientRect();
  return {
    prevent: ${PREVENT},
    x: Math.round(rect.left + rect.width / 2),
    y: Math.round(rect.top + rect.height / 2),
    activationBefore: { active: navigator.userActivation.isActive, everActive: navigator.userActivation.hasBeenActive },
  };
})()`;

const target = await evaluate(setup);

const touch = (type, points) =>
  call("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map((p, i) => ({ x: p[0], y: p[1], id: i + 1 })),
    timestamp: Date.now() / 1000,
  });

await evaluate("window.__t0 = performance.now(), window.__log.length = 0, true");
await touch("touchStart", [[target.x, target.y]]);
const lit = await evaluate(`(() => document.querySelectorAll(".lit .active").length)()`);
await new Promise((r) => setTimeout(r, HOLD_MS));
const litHeld = await evaluate(`(() => document.querySelectorAll(".lit .active").length)()`);
await touch("touchEnd", []);
await new Promise((r) => setTimeout(r, 300));

const out = await evaluate(`JSON.stringify({
  log: window.__log,
  activationAfter: { active: navigator.userActivation.isActive, everActive: navigator.userActivation.hasBeenActive },
  selection: String(getSelection()),
})`);

console.log(JSON.stringify({ prevent: target.prevent, holdMs: HOLD_MS, litOnDown: lit, litWhileHeld: litHeld, ...JSON.parse(out) }, null, 2));
ws.close();
