import { sequenceRows } from '@/application/plan/flow-sequence';
import {
  type FlowMode,
  type FlowModel,
  type FlowStep,
  flowSteps,
  isNewLink,
} from '@/application/plan/flow-steps';

export type FlowView = 'diagram' | 'sequence';

/** One line of a key; the same shape as a legend item. */
export interface KeyItem {
  readonly label: string;
  readonly glyph?: string;
  readonly line?: 'solid' | 'dashed' | 'dotted';
  readonly swatch?: 'add' | 'mod' | 'dep' | 'rem' | 'dim' | 'cur' | 'plain';
}

export interface KeyOptions {
  readonly mode: FlowMode;
  readonly view: FlowView;
  /** Whether the drawing carries ◇ marks. */
  readonly marked: boolean;
  /** Whether the reader can walk the stops (so the drawing shows where they are). */
  readonly walkable: boolean;
}

const callKind = (via: string): 'api' | 'msg' | 'other' => {
  if (/^(?:api|gql):/u.test(via)) return 'api';
  return via.startsWith('msg:') ? 'msg' : 'other';
};

const statusOf = (model: FlowModel, id: string): string =>
  id !== '' && id !== 'internal' ? (model.status(id) ?? 'existing') : 'existing';

function changeItems(model: FlowModel, steps: readonly FlowStep[]): KeyItem[] {
  const items: KeyItem[] = [];
  const has = (f: (s: FlowStep) => boolean) => steps.some((s) => s.$removed !== true && f(s));
  const some = (status: string, ids: readonly string[]) =>
    ids.some((x) => statusOf(model, x) === status);
  if (has((s) => isNewLink(model, s) || some('added', [s.from, s.to, s.via, s.id]))) {
    items.push({ swatch: 'add', label: 'new' });
  }
  if (has((s) => some('modified', [s.from, s.to, s.id]))) {
    items.push({ swatch: 'mod', label: 'works differently' });
  }
  if (steps.some((s) => s.$removed === true)) items.push({ swatch: 'rem', label: 'removed' });
  return items;
}

function sequenceItems(model: FlowModel, flowId: string, mode: FlowMode): KeyItem[] {
  const rows = sequenceRows(model, flowId, mode);
  const items: KeyItem[] = [];
  if (rows.some((r) => r.kind === 'reply')) {
    items.push({ line: 'dotted', label: 'what the call answers' });
  }
  const framed = (frame: string) => rows.some((r) => r.kind === 'open' && r.frame === frame);
  if (framed('fails')) items.push({ glyph: '▭', label: 'if it fails' });
  if (framed('group')) items.push({ glyph: '▭', label: 'grouped steps' });
  return items;
}

function drawingItems(steps: readonly FlowStep[], o: KeyOptions): KeyItem[] {
  const items: KeyItem[] = [];
  if (o.view === 'diagram' && o.walkable) {
    items.push({ swatch: 'cur', label: 'you are here' }, { swatch: 'dim', label: 'walked' });
  }
  if (steps.some((s) => s.from === s.to || s.via === '' || s.via === 'internal')) {
    items.push({ glyph: '□', label: 'internal step' });
  }
  const data = steps.some((s) => (s.reads ?? []).length > 0 || (s.writes ?? []).length > 0);
  if (data && o.view === 'diagram') items.push({ glyph: '⛁', label: 'store it reads or writes' });
  if (o.marked) items.push({ glyph: '◇', label: 'planned changes' });
  if (steps.some((s) => s.screen !== undefined)) {
    items.push({ glyph: '◫', label: 'screen the person sees' });
  }
  return items;
}

const pointers = (calls: boolean): KeyItem[] =>
  calls ? [{ glyph: '●', label: 'endpoint it calls' }] : [];

/** The key for exactly what this drawing shows. */
export function flowKey(model: FlowModel, flowId: string, o: KeyOptions): KeyItem[] {
  const steps = flowSteps(model, flowId, o.mode);
  const kinds = new Set(steps.map((s) => callKind(s.via)));
  const lines: KeyItem[] = [];
  if (kinds.has('api')) lines.push({ line: 'solid', label: 'sync call' });
  if (kinds.has('msg')) lines.push({ line: 'dashed', label: 'event' });
  const view =
    o.view === 'sequence' ? sequenceItems(model, flowId, o.mode) : pointers(kinds.has('api'));
  const changes = o.mode === 'asIs' ? [] : changeItems(model, steps);
  return [...lines, ...view, ...changes, ...drawingItems(steps, o)];
}
