// Confirms spec/support/instrument-page.ts really runs the built page's scripts,
// so a red spec test means "no instrument yet" rather than "loader broken".
import { loadInstrument } from "../spec/support/instrument-page.ts";

const page = loadInstrument();
const scripts = [...page.document.querySelectorAll("script")].length;
const ready = page.document.querySelector('[data-ready="true"]');

console.log(`scripts found:      ${scripts}`);
console.log(`script side-effect: ${ready ? "observed" : "NOT observed"}`);
console.log(`surface:            ${page.surface ? "present" : "absent"}`);
console.log(`errors:             ${page.errors.length ? page.errors.join("; ") : "none"}`);
console.log(`audio contexts:     ${page.audio.contexts}`);
page.close();
