// One-off repro: does holding a keyboard key stop the cursor moving? Drives
// real CDP input (a key held down with autoRepeat, the way an OS key repeat
// arrives) while dispatching mouse moves, then reads back whether the page saw
// the moves. Synthetic KeyboardEvents can't reproduce this — they never repeat.
//
// Usage: node scripts/repro-held-key-cursor.js "<browser ws url>"
const wsUrl = process.argv[2];

const send = (ws, id, method, params, sessionId) =>
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));

const main = async () => {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 1;
  const call = (method, params = {}, sessionId) =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      send(ws, id, method, params, sessionId);
    });

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg.result ?? msg.error);
  });
  await new Promise((resolve) => ws.addEventListener("open", resolve));

  const { targetInfos } = await call("Target.getTargets");
  const page = targetInfos.find((t) => t.type === "page" && t.url.includes("comp4020"));
  const { sessionId } = await call("Target.attachToTarget", { targetId: page.targetId, flatten: true });
  const evaluate = async (expression) =>
    (await call("Runtime.evaluate", { expression, returnByValue: true }, sessionId)).result?.value;

  const mouse = (x, y) =>
    call("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0 }, sessionId);

  await evaluate(`window.__moves = 0;
    document.querySelector('[data-instrument]')
      .addEventListener('pointermove', () => window.__moves++);`);

  await mouse(700, 400);
  const before = await evaluate(`document.querySelector('[data-cursor]').style.left`);

  // Hold KeyA the way a real keyboard does: one keyDown, then repeats.
  const keyA = { windowsVirtualKeyCode: 65, code: "KeyA", key: "a", text: "a" };
  await call("Input.dispatchKeyEvent", { type: "keyDown", ...keyA }, sessionId);
  await evaluate(`window.__moves = 0`);

  // A real hold: ~30 repeats/sec for two seconds, mouse moving throughout.
  const positions = [];
  const hovers = [];
  for (let i = 0; i < 60; i++) {
    await call("Input.dispatchKeyEvent", { type: "keyDown", ...keyA, autoRepeat: true }, sessionId);
    if (i % 8 === 0) {
      await mouse(400 + i * 12, 300 + i * 6);
      positions.push(await evaluate(`document.querySelector('[data-cursor]').style.left`));
      hovers.push(await evaluate(`document.querySelectorAll('.cap.hover').length`));
    }
    await new Promise((r) => setTimeout(r, 33));
  }

  const moves = await evaluate(`window.__moves`);
  const activeCaps = await evaluate(`document.querySelectorAll('.cap.active').length`);
  const repeatSeen = await evaluate(`window.__sawRepeat ?? null`);
  await call("Input.dispatchKeyEvent", { type: "keyUp", ...keyA }, sessionId);
  const litAfterRelease = await evaluate(`document.querySelectorAll('.cap.active').length`);

  console.log("dot left before holding the key:", before);
  console.log("dot left during the hold:", positions.join(" "));
  console.log("caps hovered during the hold:", hovers.join(" "));
  console.log("pointermove events the page saw while held:", moves);
  console.log("caps lit while held:", activeCaps, "-> after keyUp:", litAfterRelease);
  console.log("event.repeat observed:", repeatSeen);
  ws.close();
};

main();
