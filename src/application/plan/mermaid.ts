// A flow as a Mermaid sequence diagram, built from the same rows the sequence drawing reads (flow-sequence.ts).
//
// Participant ids are generated (P the person, S1… services, T1… topics, D1… other stores); names go in `as`.
// Sync call ->>, reply -->>, event -), a step inside one service a Note, store access ->> "writes X",
// `alt … else if it fails … end` for a step that can fail, `rect` for a recorded beat or shared event source.
// Grouping does not establish simultaneous execution. Removed steps (mode 'diff') become notes.

import type { FrameRow } from '@/application/plan/flow-frames';
import { sequenceModel, type Sequence, type SequenceRow } from '@/application/plan/flow-sequence';
import {
  stepKind,
  type FlowMode,
  type FlowModel,
  type FlowStep,
} from '@/application/plan/flow-steps';
import { prop } from '@/application/plan/ids';

const ENTITY: Record<string, string> = { '#': '#35;', ';': '#59;', '<': '#lt;', '>': '#gt;' };

/** Text for a Mermaid label: markdown and line breaks gone, `;` `#` `<` `>` as entity codes. */
export function mmText(text?: string): string {
  return (text ?? '')
    .replaceAll(/\[\[([^\]]{1,200})\]\]/gu, (_, id: string) => id.split(/[:#]/u).pop() ?? id)
    .replaceAll(/\[([^\]]{1,200})\]\([^)]{0,200}\)/gu, '$1')
    .replaceAll(/`([^`]*)`/gu, '$1')
    .replaceAll(/(\*{1,3}|__)(?=\S)([^*_\n]*?\S)\1/gu, '$2')
    .replaceAll(/\s+/gu, ' ')
    .trim()
    .replaceAll(/[#;<>]/gu, (c) => ENTITY[c] ?? c);
}

const strProp = (e: unknown, key: string): string | undefined => {
  const v = prop(e, key);
  return typeof v === 'string' && v !== '' ? v : undefined;
};

const nameOf = (model: FlowModel, id: string): string =>
  strProp(model.get(id), 'name') ?? strProp(model.get(id), 'title') ?? id;

function viaText(model: FlowModel, via: string): string {
  const e = model.get(via);
  if (e === undefined) return '';
  if (via.startsWith('msg:')) {
    return [strProp(e, 'name'), strProp(e, 'version')].filter((x) => x !== undefined).join(' ');
  }
  return strProp(e, 'sig') ?? strProp(e, 'name') ?? via;
}

const recNames = (model: FlowModel, refs: readonly string[]): string =>
  [...new Set(refs.map((r) => nameOf(model, r.split('#')[0] ?? r)))].join(', ');

const storeLetter = (kind: unknown): 'T' | 'D' =>
  kind === 'topic' || kind === 'queue' ? 'T' : 'D';

/** Short generated participant ids: S services, T topics and queues, D other stores. */
function participantIds(model: FlowModel, parts: readonly string[]): Map<string, string> {
  const counts = { S: 0, T: 0, D: 0 };
  return new Map(
    parts.map((p) => {
      const e = model.get(p);
      const store = prop(e, '$type') === 'store' || p.startsWith('st:');
      const kind = prop(e, 'kind');
      const k = store ? storeLetter(kind) : 'S';
      counts[k] += 1;
      return [p, `${k}${String(counts[k])}`];
    }),
  );
}

interface Pen {
  readonly line: (text: string) => void;
  readonly note: (over: string, text: string) => void;
  readonly indent: () => void;
  readonly dedent: () => void;
  readonly text: () => string;
}

function createPen(): Pen {
  const out = ['sequenceDiagram', '  autonumber'];
  let depth = 1;
  const line = (text: string): void => {
    out.push(`${'  '.repeat(depth)}${text}`);
  };
  return {
    line,
    note: (over, text) => {
      line(`Note over ${over}: ${text}`);
    },
    indent: () => {
      depth += 1;
    },
    dedent: () => {
      depth -= 1;
    },
    text: () => out.join('\n'),
  };
}

interface Ctx {
  readonly model: FlowModel;
  readonly seq: Sequence;
  readonly id: (part: string) => string;
  readonly pen: Pen;
}

const stepRows = (
  rows: readonly SequenceRow[],
): { readonly i: number; readonly step: FlowStep }[] =>
  rows.flatMap((x) => (x.kind === 'step' ? [x] : []));

const stepAt = (seq: Sequence, i: number): FlowStep | undefined =>
  stepRows(seq.rows).find((x) => x.i === i)?.step;

const over = (ctx: Ctx, s: Pick<FlowStep, 'from' | 'to'>): string =>
  s.to === s.from ? ctx.id(s.from) : `${ctx.id(s.from)},${ctx.id(s.to)}`;

function drawNote(ctx: Ctx, row: Extract<SequenceRow, { readonly kind: 'note' }>): void {
  if (row.on === 'first') {
    const first = ctx.seq.parts[0];
    if (first !== undefined) ctx.pen.note(ctx.id(first), mmText(row.text));
    return;
  }
  if (ctx.seq.actor !== null) {
    ctx.pen.note('P', mmText(`sees ${nameOf(ctx.model, row.screen.split('#')[0] ?? row.screen)}`));
  }
}

function drawOpen(ctx: Ctx, row: FrameRow): void {
  const { pen, seq } = ctx;
  if (row.frame === 'fails') {
    pen.line(`alt ${mmText(stepAt(seq, row.at)?.action ?? 'step')}`);
    pen.indent();
    return;
  }
  pen.line('rect rgba(128, 128, 128, 0.12)');
  pen.indent();
  const next = stepRows(seq.rows.slice(seq.rows.indexOf(row) + 1))[0];
  const label = [row.beat, row.sharedSource === null ? '' : 'from the same event source']
    .filter((x) => x !== null && x !== '')
    .join(' · ');
  if (label !== '' && next !== undefined) pen.note(over(ctx, next.step), mmText(label));
}

function drawClose(ctx: Ctx, row: FrameRow): void {
  const { pen } = ctx;
  if (row.frame === 'fails') {
    pen.dedent();
    pen.line('else if it fails');
    pen.indent();
    const s = stepAt(ctx.seq, row.at);
    if (s !== undefined) pen.note(over(ctx, s), mmText(row.text));
  }
  pen.dedent();
  pen.line('end');
}

const touchText = (model: FlowModel, s: FlowStep): string[] => {
  const writes = s.writes ?? [];
  const reads = s.reads ?? [];
  if (writes.length > 0) return [`writes ${recNames(model, writes)}`];
  return reads.length > 0 ? [`reads ${recNames(model, reads)}`] : [];
};

/** What follows the action: the API or message used, or the records a store step touches. */
function detailOf(model: FlowModel, s: FlowStep): string[] {
  const kind = stepKind(model, s);
  if (kind !== 'api' && kind !== 'msg') return touchText(model, s).map(mmText);
  const via = s.via === 'internal' || s.via === '' ? '' : mmText(viaText(model, s.via));
  return via === '' ? [] : [via];
}

/** A step: authored conditions are notes, never inferred alt/opt branches. */
function drawStep(ctx: Ctx, s: FlowStep): void {
  const { pen, model } = ctx;
  const action = mmText(s.action === '' ? s.id : s.action);
  if (s.logic !== undefined && s.logic !== '') pen.note(over(ctx, s), mmText(s.logic));
  if (s.$removed === true) {
    pen.note(over(ctx, s), `removed · ${action}`);
    return;
  }
  if (s.from === s.to) {
    pen.note(ctx.id(s.from), action);
    return;
  }
  const arrow = stepKind(model, s) === 'msg' ? '-)' : '->>';
  pen.line(
    `${ctx.id(s.from)}${arrow}${ctx.id(s.to)}: ${[action, ...detailOf(model, s)].join(' · ')}`,
  );
}

function drawRow(ctx: Ctx, row: SequenceRow): void {
  const { pen } = ctx;
  switch (row.kind) {
    case 'enter': {
      pen.line(`P->>${ctx.id(row.to)}: ${mmText(row.label === '' ? 'Starts' : row.label)}`);
      break;
    }
    case 'note': {
      drawNote(ctx, row);
      break;
    }
    case 'open': {
      drawOpen(ctx, row);
      break;
    }
    case 'close': {
      drawClose(ctx, row);
      break;
    }
    case 'reply': {
      pen.line(`${ctx.id(row.from)}-->>${ctx.id(row.to)}: ${mmText(row.label)}`);
      break;
    }
    case 'step': {
      drawStep(ctx, row.step);
      break;
    }
  }
}

/** The flow as a Mermaid sequence diagram. */
export function flowToMermaid(
  model: FlowModel,
  flowId: string,
  opts: { readonly mode?: FlowMode } = {},
): string {
  const seq = sequenceModel(model, flowId, opts.mode ?? 'toBe');
  const ids = participantIds(model, seq.parts);
  const pen = createPen();
  if (seq.actor !== null) pen.line(`actor P as ${mmText(seq.actor)}`);
  for (const p of seq.parts) {
    pen.line(`participant ${ids.get(p) ?? p} as ${mmText(nameOf(model, p))}`);
  }
  const ctx: Ctx = { model, seq, id: (p) => ids.get(p) ?? p, pen };
  for (const row of seq.rows) drawRow(ctx, row);
  return pen.text();
}
