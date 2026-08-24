// One-off browser probe (agent-browser eval) for the About panel: the info
// button opens it, every way out closes it, and the keyboard goes quiet
// while it is open. No more plate-to-card growth to sample — the panel is a
// fixed-size card that only fades — so this only checks state, not geometry.
(async () => {
  // Async because opacity/visibility are behind a 200ms transition:
  // measuring synchronously after the click reads mid-fade.
  const settled = () => new Promise((resolve) => setTimeout(resolve, 300));
  const panel = document.querySelector("[data-about]");
  const toggle = document.querySelector("[data-about-toggle]");
  const closeButton = document.querySelector("[data-about-close]");
  const scrim = document.querySelector("[data-about-scrim]");
  const out = {};

  const click = (target) => target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  const pointerdown = (target) =>
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true }));
  const keydown = (init) => window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
  const lit = () => document.querySelectorAll(".lit .active").length;
  const open = () => panel.hasAttribute("data-open");

  out.closedExpanded = toggle.getAttribute("aria-expanded");
  // Closed, nothing inside the card may be reachable by Tab — inherited from
  // the panel's own visibility:hidden, not set per-element any more.
  out.closedPanelHidden = getComputedStyle(panel).visibility === "hidden";
  out.closedBodyHidden = getComputedStyle(panel.querySelector(".about-body")).visibility === "hidden";
  out.closedCloseHidden = getComputedStyle(closeButton).visibility === "hidden";
  // The info button itself must stay visible and clickable throughout —
  // per instruction, it is not part of what hides.
  out.closedToggleVisible = getComputedStyle(toggle).visibility === "visible";

  click(toggle);
  await settled();
  out.openedByToggle = open();
  out.openedExpanded = toggle.getAttribute("aria-expanded");
  out.scrimShown = scrim.hasAttribute("data-open");
  out.openToggleVisible = getComputedStyle(toggle).visibility === "visible";

  // Clicking the info button again while already open must not close it —
  // only the × (or the scrim, or Escape) does.
  click(toggle);
  out.stillOpenAfterTogglePress = open();

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
