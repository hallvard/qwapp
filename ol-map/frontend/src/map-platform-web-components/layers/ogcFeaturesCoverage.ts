/**
 * Which ground a source has already fetched, and what is left of a viewport
 * once that is taken out. A vector source keeps everything it has loaded, so
 * the only part of a new viewport worth asking for is the part no earlier one
 * covered.
 */

export type Box = [number, number, number, number];

/** Beyond this the subtraction has fragmented more than it is worth; one box covering them all replaces them. */
const MAX_FRAGMENTS = 32;

const intersects = (a: Box, b: Box): boolean =>
  a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

const contains = (outer: Box, inner: Box): boolean =>
  outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];

function boundingBox(boxes: readonly Box[]): Box {
  return [
    Math.min(...boxes.map((b) => b[0])),
    Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])),
    Math.max(...boxes.map((b) => b[3])),
  ];
}

/** `target` with `blocker` cut out of it, as up to four boxes: two full-width bands, then the sides of what is left. */
export function subtractBox(target: Box, blocker: Box): Box[] {
  if (!intersects(target, blocker)) return [target];
  const [tx0, ty0, tx1, ty1] = target;
  const [bx0, by0, bx1, by1] = blocker;

  const pieces: Box[] = [];
  if (by1 < ty1) pieces.push([tx0, by1, tx1, ty1]);
  if (by0 > ty0) pieces.push([tx0, ty0, tx1, by0]);

  const y0 = Math.max(ty0, by0);
  const y1 = Math.min(ty1, by1);
  if (bx0 > tx0) pieces.push([tx0, y0, bx0, y1]);
  if (bx1 < tx1) pieces.push([bx1, y0, tx1, y1]);
  return pieces;
}

export type Coverage = {
  /** The parts of `target` not yet covered. Empty when there is nothing left to ask for. */
  remaining: (target: Box, minSize: number) => Box[];
  cover: (box: Box) => void;
};

export function createCoverage(): Coverage {
  const covered: Box[] = [];

  return {
    cover(box) {
      if (covered.some((c) => contains(c, box))) return;
      for (let i = covered.length - 1; i >= 0; i--) {
        if (contains(box, covered[i])) covered.splice(i, 1);
      }
      covered.push(box);
    },

    remaining(target, minSize) {
      let pieces: Box[] = [target];
      for (const blocker of covered) {
        if (!intersects(blocker, target)) continue;
        pieces = pieces
          .flatMap((piece) => subtractBox(piece, blocker))
          // Seams thinner than a pixel hold nothing anyone can see, and
          // floating point produces them endlessly.
          .filter((p) => p[2] - p[0] > minSize && p[3] - p[1] > minSize);
        if (pieces.length === 0) return [];
      }
      return pieces.length <= MAX_FRAGMENTS ? pieces : [boundingBox(pieces)];
    },
  };
}
