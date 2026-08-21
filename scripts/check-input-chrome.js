// One-off browser probe (agent-browser eval) for the input-chrome fixes:
// context-menu suppression, the Tab-gated focus ring, and pointer drag
// across the playing surface.
(() => {
  const root = document.documentElement;
  const surface = document.querySelector("[data-instrument]");
  const caps = [...surface.querySelectorAll("[data-note]")];
  const [first, second] = caps;
  const out = {};

  // pointerenter/pointerleave don't bubble in a real browser; dispatching them
  // as if they did would fire the container's handlers too and mislead.
  const pointer = (target, type, init = {}) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: !/^pointer(enter|leave)$/.test(type),
        cancelable: true,
        pointerId: 1,
        isPrimary: true,
        buttons: 1,
        ...init,
      }),
    );
  const keydown = (key) => window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key }));

  // Context menu, as a long press raises it.
  out.contextMenuPrevented = !first.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
  );

  // Focus ring: Tab shows it, anything else hides it, focus stays put.
  keydown("Tab");
  out.ringAfterTab = root.classList.contains("keyboard-nav");
  keydown("q");
  out.ringAfterKey = root.classList.contains("keyboard-nav");
  keydown("Tab");
  first.focus();
  pointer(first, "pointerdown");
  out.ringAfterPointer = root.classList.contains("keyboard-nav");
  out.focusKept = document.activeElement === first;
  pointer(first, "pointerup");

  // Drag: press one, enter the next, and see which are lit at each step.
  pointer(first, "pointerdown");
  out.litOnPress = caps.filter((c) => c.classList.contains("active")).length;
  pointer(first, "pointerleave");
  out.litInGap = caps.filter((c) => c.classList.contains("active")).length;
  pointer(second, "pointerenter");
  out.litOnNext = caps.filter((c) => c.classList.contains("active")).length;
  out.nextIsLit = second.classList.contains("active");
  pointer(second, "pointerup");
  out.litAfterLift = caps.filter((c) => c.classList.contains("active")).length;

  out.scrolls = document.documentElement.scrollHeight > window.innerHeight;
  return JSON.stringify(out);
})();
