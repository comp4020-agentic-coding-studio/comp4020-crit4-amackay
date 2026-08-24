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

  // Drag: press one, enter the next, and see what is lit at each step. The
  // counts are pitch classes, not caps — the played state lives on the lit
  // layer's twelve paths (DESIGN.md "The lit layer"), so one held note is 1.
  const lit = () => surface.querySelectorAll(".lit .active").length;
  const isLit = (cap) => !!surface.querySelector(`.lit [data-pc="${cap.dataset.pc}"].active`);
  pointer(first, "pointerdown");
  out.litOnPress = lit();
  pointer(first, "pointerleave");
  out.litInGap = lit();
  pointer(second, "pointerenter");
  out.litOnNext = lit();
  out.nextIsLit = isLit(second);
  pointer(second, "pointerup");
  out.litAfterLift = lit();

  out.scrolls = document.documentElement.scrollHeight > window.innerHeight;
  return JSON.stringify(out);
})();
