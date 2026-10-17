/** A point in drawing coordinates. */
export type Point = readonly [x: number, y: number];

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const ROUND = 8;
const ARROW = 8;
const WING = 4.5;

/** Two decimals, so a path is short and the same on every machine. */
const n2 = (n: number): number => Math.round(n * 100) / 100;

/** The text cut to `n` characters, with an ellipsis when it was longer. */
export const clipText = (text: string, n: number): string =>
  text.length > n ? `${text.slice(0, n - 1)}…` : text;

/** A topic without its `<env>.public.` prefix. */
export const shortTopic = (text: string): string => {
  const short = text.replace(/^<[^>]+>\.(?:public\.)?/u, '');
  return short === '' ? text : short;
};

/** The words wrapped to lines of at most `n` characters; more than `max` lines end in an ellipsis. */
export function wrapText(text: string, n: number, max = 2): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/u).filter(Boolean)) {
    if (line === '') line = word;
    else if (`${line} ${word}`.length <= n) line = `${line} ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== '') lines.push(line);
  if (lines.length > max) {
    lines.length = max;
    lines[max - 1] = clipText(`${lines[max - 1] ?? ''} …`, n);
  }
  return lines.map((l) => clipText(l, n + 2));
}

function corner([prev, cur, next]: readonly [Point, Point, Point], r: number): string {
  const l1 = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
  const l2 = Math.hypot(next[0] - cur[0], next[1] - cur[1]);
  const rr = Math.min(r, l1 / 2, l2 / 2);
  if (rr === 0) return ` L${String(cur[0])} ${String(cur[1])}`;
  const a = [cur[0] - ((cur[0] - prev[0]) / l1) * rr, cur[1] - ((cur[1] - prev[1]) / l1) * rr];
  const b = [cur[0] + ((next[0] - cur[0]) / l2) * rr, cur[1] + ((next[1] - cur[1]) / l2) * rr];
  return ` L${String(n2(a[0] ?? 0))} ${String(n2(a[1] ?? 0))} Q${String(cur[0])} ${String(cur[1])} ${String(n2(b[0] ?? 0))} ${String(n2(b[1] ?? 0))}`;
}

/** An SVG path through the points with rounded corners. */
export function roundPath(pts: readonly Point[], r = ROUND): string {
  const first = pts[0];
  const last = pts.at(-1);
  if (first === undefined || last === undefined) return '';
  const middle = pts
    .slice(1, -1)
    .map((cur, k) => corner([pts[k] ?? cur, cur, pts[k + 2] ?? cur], r))
    .join('');
  return `M${String(first[0])} ${String(first[1])}${middle} L${String(last[0])} ${String(last[1])}`;
}

const collinear = (a: Point, b: Point, c: Point): boolean =>
  (a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1]);

/** The route without repeated points or points in a straight line. */
export function simplify(pts: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of pts) {
    const last = out.at(-1);
    if (last?.[0] === p[0] && last[1] === p[1]) continue;
    out.push(p);
    for (;;) {
      const [a, b, c] = out.slice(-3);
      if (a === undefined || b === undefined || c === undefined || !collinear(a, b, c)) break;
      out.splice(-2, 1);
    }
  }
  return out;
}

/** Do the two rectangles meet, with `pad` to spare? */
export const overlaps = (a: Rect, b: Rect, pad = 0): boolean =>
  a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;

const at = (x: number, y: number): string => `${String(n2(x))} ${String(n2(y))}`;

/** The path of an arrow head at the end of a route. */
export function arrowHead(pts: readonly Point[]): string {
  const end = pts.at(-1);
  const before = pts.at(-2);
  if (end === undefined || before === undefined) return '';
  const len = Math.max(Math.hypot(end[0] - before[0], end[1] - before[1]), 1e-9);
  const ux = (end[0] - before[0]) / len;
  const uy = (end[1] - before[1]) / len;
  const hx = end[0] - ux * ARROW;
  const hy = end[1] - uy * ARROW;
  return `M${at(end[0], end[1])} L${at(hx - uy * WING, hy + ux * WING)} L${at(hx + uy * WING, hy - ux * WING)} Z`;
}
