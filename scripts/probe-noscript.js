// One-off CDP probe: with scripting disabled, does the no-JS notice render,
// centred and on screen at both marked sizes? agent-browser cannot turn
// scripting off, so this drives CDP itself.
// Usage: node scripts/probe-noscript.js "$(agent-browser get cdp-url)" <url>
const [browserUrl, pageUrl] = process.argv.slice(2);
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
  const { targetId } = await rpc(socket, "Target.createTarget", { url: "about:blank" });
  const { sessionId } = await rpc(socket, "Target.attachToTarget", { targetId, flatten: true });
  const evaluate = async (expression) =>
    (await rpc(socket, "Runtime.evaluate", { expression, returnByValue: true }, sessionId)).result.value;

  await rpc(socket, "Emulation.setScriptExecutionDisabled", { value: true }, sessionId);

  const results = {};
  for (const [label, width, height] of [["desktop", 1920, 1080], ["phone", 390, 844]]) {
    await rpc(socket, "Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: height > width }, sessionId);
    await rpc(socket, "Page.navigate", { url: pageUrl }, sessionId);
    await new Promise((r) => setTimeout(r, 1200));
    results[label] = JSON.parse(
      await evaluate(`JSON.stringify((() => {
        const note = document.querySelector('.noscript-plate');
        if (!note) return { rendered: false };
        const n = note.getBoundingClientRect();
        return {
          rendered: true,
          text: note.textContent.trim(),
          onScreen: n.top >= 0 && n.left >= 0 && n.right <= innerWidth && n.bottom <= innerHeight,
          centred: Math.abs((n.left + n.right) / 2 - innerWidth / 2) < 1,
          scriptRan: document.documentElement.classList.contains('keyboard-nav') || !!window.__anything,
        };
      })())`),
    );
  }

  // A shot of the phone case, since "measures right" and "looks right" are
  // different claims: node scripts/probe-noscript.js <ws> <url> <out.png>
  const out = process.argv[4];
  if (out) {
    const { data } = await rpc(socket, "Page.captureScreenshot", { format: "png" }, sessionId);
    (await import("node:fs")).writeFileSync(out, Buffer.from(data, "base64"));
  }

  console.log(JSON.stringify(results, null, 2));
  await rpc(socket, "Target.closeTarget", { targetId });
  socket.close();
});
