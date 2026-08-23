// One-off CDP probe: does a real (trusted) touch grant the user activation an
// AudioContext needs, at touch-down or only at the lift? agent-browser cannot
// dispatch touch locally, so this drives Input.dispatchTouchEvent itself.
// Usage: node scripts/probe-touch-activation.js "$(agent-browser get cdp-url)"
const browserUrl = process.argv[2];
let nextId = 1;

const rpc = (socket, method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    const onMessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.id !== id) return;
      socket.removeEventListener("message", onMessage);
      message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
    };
    socket.addEventListener("message", onMessage);
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

const socket = new WebSocket(browserUrl);
socket.addEventListener("open", async () => {
  const { targetInfos } = await rpc(socket, "Target.getTargets");
  const page = targetInfos.find((t) => t.type === "page" && t.url.includes("crit4"));
  const { sessionId } = await rpc(socket, "Target.attachToTarget", { targetId: page.targetId, flatten: true });

  const evaluate = async (expression) =>
    (await rpc(socket, "Runtime.evaluate", { expression, returnByValue: true }, sessionId)).result.value;

  await rpc(socket, "Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, sessionId);
  await rpc(socket, "Page.reload", {}, sessionId);
  await new Promise((r) => setTimeout(r, 1500));

  const activation = () =>
    evaluate("JSON.stringify({active: navigator.userActivation.isActive, sticky: navigator.userActivation.hasBeenActive})");

  const box = await evaluate("JSON.stringify(document.querySelector('.cap').getBoundingClientRect())");
  const { x, y, width, height } = JSON.parse(box);
  const point = [{ x: x + width / 2, y: y + height / 2 }];

  await evaluate(
    "window.__seen = []; for (const t of ['pointerdown','pointerup','touchstart','touchend'])" +
      " document.addEventListener(t, (e) => window.__seen.push(t + ':' + (e.pointerType || 'touch') + ':' + e.isTrusted));",
  );

  const atLoad = await activation();
  await rpc(socket, "Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point }, sessionId);
  const afterDown = await activation();
  const stateHeld = await evaluate("document.querySelector('.cap.active') ? 'caps lit' : 'nothing lit'");
  await rpc(socket, "Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, sessionId);
  const afterUp = await activation();

  const seen = await evaluate("JSON.stringify(window.__seen)");
  console.log(JSON.stringify({ atLoad, afterDown, stateHeld, afterUp, seen }, null, 2));
  socket.close();
});
