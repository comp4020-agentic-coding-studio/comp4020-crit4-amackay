// The 9x4 grid of nodes, generated from DESIGN.md's tuning table rather than
// hand-listed, so the keyboard mapping and the lattice math can't drift apart.

import { equalTemperamentNameFor, hueFor, ratioFor } from "./tuning.ts";

export interface Node {
  /** KeyboardEvent.code — the keyboard mapping and the DOM handle alike. */
  code: string;
  /** The visible key label. */
  label: string;
  a: number;
  b: number;
  ratio: number;
  hue: number;
  /** Nearest 12-TET name — debug mode only. See tuning.ts. */
  etName: string;
}

interface Row {
  b: number;
  codes: string[];
  labels: string[];
}

// Rows top to bottom, per DESIGN.md's tuning table.
const ROWS: Row[] = [
  {
    b: 2,
    codes: ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9"],
    labels: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
  },
  {
    b: 1,
    codes: ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO"],
    labels: ["Q", "W", "E", "R", "T", "Y", "U", "I", "O"],
  },
  {
    b: 0,
    codes: ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL"],
    labels: ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  },
  {
    b: -1,
    codes: ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period"],
    labels: ["Z", "X", "C", "V", "B", "N", "M", ",", "."],
  },
];

/** All 36 nodes, in row-major order matching DESIGN.md's table (top row first,
 *  column 0 first). Column index `i` gives `a = i − 3`. */
export const NODES: Node[] = ROWS.flatMap(({ b, codes, labels }) =>
  codes.map((code, i) => {
    const a = i - 3;
    const ratio = ratioFor(a, b);
    return { code, label: labels[i]!, a, b, ratio, hue: hueFor(ratio), etName: equalTemperamentNameFor(ratio) };
  }),
);

const BY_CODE = new Map(NODES.map((node) => [node.code, node]));

export function nodeFor(code: string): Node | undefined {
  return BY_CODE.get(code);
}
