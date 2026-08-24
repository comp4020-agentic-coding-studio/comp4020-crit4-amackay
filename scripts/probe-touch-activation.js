// One-off CDP probe: when does a real (trusted) gesture grant the user
// activation an AudioContext needs — and, for each input, is it already
// granted inside the handler for the press itself? agent-browser cannot
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

  const box = await evaluate("JSON.stringify(document.querySelector('.lit [data-pc]').getBoundingClientRect())");
  const { x, y, width, height } = JSON.parse(box);
  const point = [{ x: x + width / 2, y: y + height / 2 }];

  await evaluate(
    "window.__seen = []; for (const t of ['pointerdown','pointerup','touchstart','touchend'])" +
      " document.addEventListener(t, (e) => window.__seen.push(t + ':' + (e.pointerType || 'touch') + ':' + e.isTrusted));",
  );

  // What the page can see from inside its own press handler — the moment a
  // decision about whether this gesture can sound would have to be made.
  await evaluate(
    "window.__inHandler = {};" +
      "for (const t of ['pointerdown','keydown'])" +
      "  document.addEventListener(t, (e) => { window.__inHandler[t + ':' + (e.pointerType || 'key')] =" +
      "    navigator.userActivation.hasBeenActive; }, { capture: true });",
  );

  const atLoad = await activation();
  await rpc(socket, "Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point }, sessionId);
  const afterTouchDown = await activation();
  await rpc(socket, "Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, sessionId);
  const afterTouchUp = await activation();

  // A fresh page for each input, so each one is measured as the very first
  // gesture: activation is sticky and would otherwise carry over.
  const restart = async () => {
    await rpc(socket, "Page.reload", {}, sessionId);
    await new Promise((r) => setTimeout(r, 1200));
    await evaluate(
      "window.__inHandler = {};" +
        "for (const t of ['pointerdown','keydown'])" +
        "  document.addEventListener(t, (e) => { window.__inHandler[t + ':' + (e.pointerType || 'key')] =" +
        "    navigator.userActivation.hasBeenActive; }, { capture: true });",
    );
  };

  await restart();
  const [{ x: mx, y: my }] = point;
  await rpc(socket, "Input.dispatchMouseEvent", { type: "mousePressed", x: mx, y: my, button: "left", clickCount: 1 }, sessionId);
  const inMouseDown = await evaluate("JSON.stringify(window.__inHandler)");
  await rpc(socket, "Input.dispatchMouseEvent", { type: "mouseReleased", x: mx, y: my, button: "left", clickCount: 1 }, sessionId);

  await restart();
  await rpc(socket, "Input.dispatchKeyEvent", { type: "keyDown", code: "KeyG", key: "g", windowsVirtualKeyCode: 71 }, sessionId);
  const inKeyDown = await evaluate("JSON.stringify(window.__inHandler)");

  const seen = await evaluate("JSON.stringify(window.__seen)");
  console.log(
    JSON.stringify({ atLoad, afterTouchDown, afterTouchUp, inMouseDown, inKeyDown, touchEventsSeen: seen }, null, 2),
  );
  socket.close();
});
