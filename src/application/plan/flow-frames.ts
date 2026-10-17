import { tie } from '@/application/plan/derive-values';
import { type FlowModel, type FlowStep, isTopic } from '@/application/plan/flow-steps';

/** Rows of a sequence that carry no frame; `i` indexes the flow's steps. */
export type FlatRow =
  | { readonly kind: 'step'; readonly i: number; readonly step: FlowStep }
  | { readonly kind: 'note'; readonly on: 'person'; readonly at: number; readonly screen: string }
  | {
      readonly kind: 'reply';
      readonly of: number;
      readonly from: string;
      readonly to: string;
      readonly label: string;
      readonly ref: string;
    };

/** A frame opens or closes around the rows between its two ends. */
export type FrameRow =
  | {
      readonly kind: 'open' | 'close';
      readonly frame: 'fails';
      readonly at: number;
      readonly text: string;
    }
  | {
      readonly kind: 'open' | 'close';
      readonly frame: 'group';
      readonly beat: string | null;
      readonly sharedSource: string | null;
    };

type Range =
  | {
      readonly frame: 'fails';
      readonly a: number;
      readonly b: number;
      readonly i: number;
      readonly text: string;
    }
  | {
      readonly frame: 'group';
      readonly a: number;
      readonly b: number;
      readonly beat: string | null;
      readonly sharedSource: string | null;
    };

/** The frame row that opens or closes a range. */
function frameRow(r: Range, kind: 'open' | 'close'): FrameRow {
  return r.frame === 'fails'
    ? { kind, frame: 'fails', at: r.i, text: r.text }
    : { kind, frame: 'group', beat: r.beat, sharedSource: r.sharedSource };
}

const stepRows = (flat: readonly FlatRow[]): Map<number, number> => {
  const at = new Map<number, number>();
  for (const [k, r] of flat.entries()) if (r.kind === 'step') at.set(r.i, k);
  return at;
};

function failRanges(steps: readonly FlowStep[], flat: readonly FlatRow[]): Range[] {
  const at = stepRows(flat);
  const ranges: Range[] = [];
  for (const [i, s] of steps.entries()) {
    const a = at.get(i);
    if (s.fails === undefined || s.fails === '' || s.$removed === true || a === undefined) continue;
    const answered = flat.findIndex((r, k) => k > a && r.kind === 'reply' && r.of === i);
    ranges.push({ a, b: answered === -1 ? a : answered, frame: 'fails', i, text: s.fails });
  }
  return ranges;
}

/** The group of steps `from..to` as a range over the flat rows, or null when the rows are missing. */
function groupRange(
  model: FlowModel,
  group: { readonly steps: readonly FlowStep[]; readonly from: number; readonly to: number },
  flat: readonly FlatRow[],
): Range | null {
  const { steps, from, to } = group;
  const at = stepRows(flat);
  const first = steps[from];
  const a = at.get(from);
  let b = at.get(to - 1);
  if (first === undefined || a === undefined || b === undefined) return null;
  const members = Array.from({ length: to - from }, (_, d) => from + d);
  // a trailing reply row of a member belongs to the group
  for (let next = flat[b + 1]; next?.kind === 'reply' && members.includes(next.of);) {
    b += 1;
    next = flat[b + 1];
  }
  const sameTopic = members.every((x) => {
    const s = steps[x];
    return s !== undefined && isTopic(model, s.from) && s.from === first.from;
  });
  return {
    a,
    b,
    frame: 'group',
    beat: first.beat ?? null,
    sharedSource: sameTopic ? first.from : null,
  };
}

/** Consecutive steps sharing a beat, or leaving one topic (an unauthored fan-out), run together. */
function groupRanges(
  model: FlowModel,
  steps: readonly FlowStep[],
  flat: readonly FlatRow[],
): Range[] {
  const keys = steps.map((s): string | null => {
    if (s.beat !== undefined && s.beat !== '') return `beat:${s.beat}`;
    return isTopic(model, s.from) ? `fan:${s.from}` : null;
  });
  const ranges: Range[] = [];
  for (let i = 0; i < steps.length;) {
    const key = keys[i] ?? null;
    let j = i + 1;
    if (key !== null) while (j < steps.length && keys[j] === key) j += 1;
    const range =
      key !== null && j - i > 1 ? groupRange(model, { steps, from: i, to: j }, flat) : null;
    if (range !== null) ranges.push(range);
    i = j;
  }
  return ranges;
}

/** Frames must nest: a range that would end past the one it starts in is cut to it. */
function nest(ranges: readonly Range[]): Range[] {
  const sorted = ranges.toSorted((p, q) => tie(p.a - q.a, q.b - p.b));
  const open: Range[] = [];
  const out: Range[] = [];
  for (const r of sorted) {
    while ((open.at(-1)?.b ?? Infinity) < r.a) open.pop();
    const outer = open.at(-1);
    const cut = outer !== undefined && r.b > outer.b ? { ...r, b: outer.b } : r;
    open.push(cut);
    out.push(cut);
  }
  return out;
}

function indexBy(ranges: readonly Range[], end: 'a' | 'b'): Map<number, Range[]> {
  const out = new Map<number, Range[]>();
  for (const r of ranges) out.set(r[end], [...(out.get(r[end]) ?? []), r]);
  return out;
}

/** The flat rows with the failure and grouping frames around the steps they cover. */
export function withFrames(
  model: FlowModel,
  steps: readonly FlowStep[],
  flat: readonly FlatRow[],
): (FlatRow | FrameRow)[] {
  const ranges = nest([...failRanges(steps, flat), ...groupRanges(model, steps, flat)]);
  const opens = indexBy(ranges, 'a');
  const closes = indexBy(ranges, 'b');
  const rows: (FlatRow | FrameRow)[] = [];
  for (const [k, row] of flat.entries()) {
    for (const r of opens.get(k) ?? []) rows.push(frameRow(r, 'open'));
    rows.push(row);
    // inner frames close first
    const inner = (closes.get(k) ?? []).toSorted((p, q) =>
      tie(q.a - p.a, p.frame === 'fails' ? -1 : 1),
    );
    for (const r of inner) rows.push(frameRow(r, 'close'));
  }
  return rows;
}
