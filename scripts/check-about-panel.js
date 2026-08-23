// One-off browser probe (agent-browser eval) for the About panel: the plate
// opens, the title and the card grow with it, every way out closes it, and the
// keyboard goes quiet while it is open.
(async () => {
  // Async because every size here is behind a 320ms transition: measuring
  // synchronously after the click reads the middle of the animation.
  const settled = () => new Promise((resolve) => setTimeout(resolve, 450));
  const panel = document.querySelector("[data-about]");
  const toggle = document.querySelector("[data-about-toggle]");
  const closeButton = document.querySelector("[data-about-close]");
  const scrim = document.querySelector("[data-about-scrim]");
  const heading = panel.querySelector("h1");
  const out = {};

  const body = panel.querySelector(".about-body");
  const size = () => {
    const box = panel.getBoundingClientRect();
    return {
      w: Math.round(box.width),
      h: Math.round(box.height),
      title: Math.round(parseFloat(getComputedStyle(heading).fontSize)),
      // How tall the copy actually wants to be, against the card it is in:
      // slack here is dead space, overflow is a scrollbar.
      copy: body.scrollHeight,
    };
  };
  const click = (target) => target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  const pointerdown = (target) =>
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true }));
  const keydown = (init) => window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
  const lit = () => document.querySelectorAll(".cap.active").length;
  const open = () => panel.hasAttribute("data-open");

  out.closed = size();
  out.closedExpanded = toggle.getAttribute("aria-expanded");
  // Closed, nothing inside the card may be reachable by Tab.
  out.closedBodyHidden = getComputedStyle(panel.querySelector(".about-body")).visibility === "hidden";
  out.closedCloseHidden = getComputedStyle(closeButton).visibility === "hidden";

  click(toggle);
  await settled();
  out.openedByTitle = open();
  out.openedExpanded = toggle.getAttribute("aria-expanded");
  out.scrimShown = scrim.hasAttribute("data-open");
  out.open = size();
  out.grew = out.open.w > out.closed.w && out.open.h > out.closed.h && out.open.title > out.closed.title;

  // Silent while open: a mapped key lights no cap.
  keydown({ code: "KeyF", key: "f" });
  out.capsLitWhileOpen = lit();

  click(closeButton);
  await settled();
  out.closedByX = !open();
  out.focusReturned = document.activeElement === toggle;

  click(toggle);
  await settled();
  pointerdown(scrim);
  out.closedByScrim = !open();

  click(toggle);
  await settled();
  keydown({ key: "Escape", code: "Escape" });
  out.closedByEscape = !open();

  // Back to playing once it is shut.
  keydown({ code: "KeyF", key: "f" });
  out.capsLitAfterClose = lit();
  window.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, code: "KeyF", key: "f" }));

  out.viewport = [window.innerWidth, window.innerHeight];
  out.links = [...panel.querySelectorAll("a")].map((a) => a.href);
  return out;
})();
