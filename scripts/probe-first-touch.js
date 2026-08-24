// One-off CDP probe against the deployed site: does the first real touch on a
// fresh load light anything, and does the second? Drives trusted touch through
// Input.dispatchTouchEvent, which agent-browser cannot do locally.
// Usage: node scripts/probe-first-touch.js "$(agent-browser get cdp-url)"
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
  await rpc(socket, "Page.reload", { ignoreCache: true }, sessionId);
  await new Promise((r) => setTimeout(r, 2000));

  // A cap whose centre is actually on screen — the lattice runs off the edges,
  // and the first .cap in DOM order is not necessarily visible.
  const centre = JSON.parse(
    await evaluate(`JSON.stringify((() => {
      const mid = { x: innerWidth / 2, y: innerHeight / 2 };
      const cap = [...document.querySelectorAll('.cap')]
        .map((c) => ({ c, r: c.getBoundingClientRect() }))
        .filter(({ r }) => r.left > 0 && r.top > 0 && r.right < innerWidth && r.bottom < innerHeight)
        .sort((a, b) => Math.hypot(a.r.x - mid.x, a.r.y - mid.y) - Math.hypot(b.r.x - mid.x, b.r.y - mid.y))[0];
      return { x: cap.r.x + cap.r.width / 2, y: cap.r.y + cap.r.height / 2, note: cap.c.querySelector('.name').textContent.trim() };
    })())`),
  );
  const point = [{ x: centre.x, y: centre.y }];
  const lit = () => evaluate("document.querySelectorAll('.lit .active').length");

  const tap = async (label) => {
    await rpc(socket, "Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point }, sessionId);
    const held = await lit();
    await rpc(socket, "Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, sessionId);
    return [label, { capsLitWhileHeld: held, activated: await evaluate("navigator.userActivation.hasBeenActive") }];
  };

  const first = await tap("firstTouch");
  const second = await tap("secondTouch");
  console.log(JSON.stringify({ cap: centre.note, [first[0]]: first[1], [second[0]]: second[1] }, null, 2));
  socket.close();
});
