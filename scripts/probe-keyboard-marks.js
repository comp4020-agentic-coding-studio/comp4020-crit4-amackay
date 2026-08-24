// One-off browser probe (agent-browser eval): playing a key puts out both
// marks the mouse leaves behind, and the next pointer move brings them back.
(() => {
  // Synthetic events grant no user activation, so the page would decline to
  // sound or light anything. See CLAUDE.md.
  Object.defineProperty(navigator, "userActivation", {
    value: { hasBeenActive: true, isActive: true },
    configurable: true,
  });

  const surface = document.querySelector("[data-instrument]");
  const mid = { x: innerWidth / 2, y: innerHeight / 2 };
  const cap = [...document.querySelectorAll(".lit [data-notes]")]
    .map((c) => ({ c, r: c.getBoundingClientRect() }))
    .filter(({ r }) => r.left > 0 && r.top > 0 && r.right < innerWidth && r.bottom < innerHeight)
    .sort((a, b) => Math.hypot(a.r.x - mid.x, a.r.y - mid.y) - Math.hypot(b.r.x - mid.x, b.r.y - mid.y))[0];
  const at = { x: cap.r.x + cap.r.width / 2, y: cap.r.y + cap.r.height / 2 };

  const pointer = (target, type) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: !/^pointer(enter|leave)$/.test(type),
        cancelable: true,
        pointerId: 1,
        pointerType: "mouse",
        clientX: at.x,
        clientY: at.y,
      }),
    );

  const marks = () => ({
    hover: document.querySelectorAll(".lit .hover").length,
    disk: document.querySelector("[data-cursor]").classList.contains("visible"),
  });

  pointer(cap.c, "pointerenter");
  pointer(surface, "pointermove");
  const beforeKey = marks();

  const key = (type) =>
    window.dispatchEvent(new KeyboardEvent(type, { bubbles: true, code: cap.c.dataset.note }));
  key("keydown");
  const whilePlaying = marks();
  key("keyup");

  // A click that never nudges the mouse: no pointermove anywhere in it.
  pointer(cap.c, "pointerdown");
  const whileClicking = marks();
  pointer(cap.c, "pointerup");
  const afterClick = marks();

  key("keydown");
  key("keyup");
  const dimmedAgain = marks();
  pointer(surface, "pointermove");
  const afterMove = marks();

  return {
    cap: cap.c.querySelector(".name").textContent.trim(),
    beforeKey,
    whilePlaying,
    whileClicking,
    afterClick,
    dimmedAgain,
    afterMove,
  };
})();
