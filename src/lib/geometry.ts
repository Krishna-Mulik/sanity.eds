export type Side = 'left' | 'right';

export const BALL = 56;

/** Gaps are sized for the count badge, which overhangs each bubble's corner. */
function clusterParams(viewportW: number) {
  if (viewportW < 620) return { bubble: 42, gap: 13, perColumn: 4 };
  return { bubble: 46, gap: 14, perColumn: 4 };
}

export const bubbleSize = (viewportW: number) => clusterParams(viewportW).bubble;

const EDGE_INSET = 20;
/** Hex packing: neighbouring columns sit sin(60 deg) apart, staggered half a step. */
const HEX_RATIO = Math.sin(Math.PI / 3);

/**
 * Splits `count` items across as few columns as possible, each holding at
 * most `maxPerColumn`, distributed as evenly as possible with any remainder
 * going to the inner (first) column — e.g. 6 -> [3,3], 7 -> [4,3], never a
 * lonely single-bubble column stranded far from the ball. The inner column
 * being the larger one matters for `clusterLayout`'s nesting: with one more
 * bubble than the column outside it, every outer bubble sits exactly in a
 * gap between two inner ones, not just offset alongside them.
 */
export function columnSizes(count: number, maxPerColumn: number): number[] {
  if (count <= 0) return [];
  if (count <= maxPerColumn) return [count];
  const columns = Math.ceil(count / maxPerColumn);
  const base = Math.floor(count / columns);
  const extra = count % columns;
  return Array.from({ length: columns }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Positions for the pop-out menu, in px offsets from the ball's own box.
 *
 * The bubbles pack into a honeycomb cluster beside the ball rather than
 * spreading along an arc: a six-item arc has to reach far across the host
 * page to keep its bubbles from touching, while hex packing keeps them
 * adjacent and close to the thing that opened them.
 */
export function clusterLayout(count: number, side: Side, ballTop: number, viewportH: number, viewportW: number) {
  const { bubble, gap, perColumn } = clusterParams(viewportW);
  const step = bubble + gap;
  const columnStep = step * HEX_RATIO;
  const firstColumn = BALL / 2 + bubble / 2 + gap + 2;
  // Bubbles are smaller than the ball; keep their centres aligned.
  const inset = (BALL - bubble) / 2;

  const sizes = columnSizes(count, perColumn);
  const raw: { out: number; dy: number }[] = [];
  // Each column's own centre is only correct for the first (innermost)
  // column. Every later column must instead sit half a step below the
  // *previous* column's own base, not be re-centred independently — that's
  // what actually lands each outer bubble in the gap between two inner
  // ones (a 4-then-3 split: inner base -1.5 -0.5 0.5 1.5, outer base needs
  // to land on -1 0 1, i.e. innerBase + half a step, not outer's own
  // stand-alone centre of -1 0 1... which only coincides by accident when
  // both columns are the same size).
  let base = 0;
  sizes.forEach((inColumn, column) => {
    base = column === 0 ? -((inColumn - 1) / 2) * step : base + step / 2;
    for (let row = 0; row < inColumn; row++) {
      raw.push({ out: firstColumn + column * columnStep, dy: base + row * step });
    }
  });

  // Slide the whole cluster so it clears the top and bottom of the viewport.
  const ballCentre = ballTop + BALL / 2;
  const highest = Math.min(...raw.map((p) => p.dy));
  const lowest = Math.max(...raw.map((p) => p.dy));
  const margin = 12 + bubble / 2;
  let shift = 0;
  if (ballCentre + highest < margin) shift = margin - (ballCentre + highest);
  else if (ballCentre + lowest > viewportH - margin) shift = viewportH - margin - (ballCentre + lowest);

  return raw.map(({ out, dy }) => ({
    dx: (side === 'right' ? -out : out) + inset,
    dy: dy + shift + inset,
  }));
}

export interface PanelBox {
  width: number;
  height: number;
  top: number;
  /** Distance from the docked edge. */
  offset: number;
  /** transform-origin, so the panel grows out of the ball it came from. */
  originX: string;
  originY: string;
  sheet: boolean;
}

/**
 * The panel is a parallel, non-blocking surface: it never covers the whole
 * page on desktop, and it always grows from the ball's position so the
 * spatial link between trigger and content survives.
 */
export function panelPlacement(side: Side, ballTop: number, viewportW: number, viewportH: number): PanelBox {
  const sheet = viewportW < 620;

  if (sheet) {
    const width = viewportW - 24;
    const height = Math.min(620, Math.round(viewportH * 0.82));
    return {
      width,
      height,
      top: viewportH - height - 12,
      offset: 12,
      originX: side === 'right' ? '85%' : '15%',
      originY: '100%',
      sheet: true,
    };
  }

  const width = 336;
  const height = Math.min(648, viewportH - 32);
  const ballCenterY = ballTop + BALL / 2;
  const top = Math.min(Math.max(ballCenterY - height / 2, 16), viewportH - height - 16);

  // Where the ball sits relative to the panel box, as a percentage.
  const originYPct = Math.round(((ballCenterY - top) / height) * 100);

  return {
    width,
    height,
    top,
    offset: EDGE_INSET,
    originX: side === 'right' ? '100%' : '0%',
    originY: `${Math.min(Math.max(originYPct, 0), 100)}%`,
    sheet: false,
  };
}

export function clampBallTop(top: number, viewportH: number) {
  return Math.min(Math.max(top, 12), viewportH - BALL - 12);
}
