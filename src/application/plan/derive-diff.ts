import type { Core } from '@/application/plan/derive-core';
import { memo, present, str } from '@/application/plan/derive-values';
import { propWord, type Words } from '@/application/plan/derive-words';
import { formatPath, isRecord, labelOf, parentOf, prop, typeOf } from '@/application/plan/ids';
import type { OpRecord, PropChange } from '@/domain/plan/plan-graph';
import { TYPE_WORDS } from '@/domain/plan/plan-vocab';

export interface DiffEntry {
  changeId: string | undefined;
  opIndex: number;
  path: string;
  target: string | null;
  kind: OpRecord['kind'];
  prop: string | null;
  before: unknown;
  after: unknown;
  change: PropChange['change'] | 'add' | 'deprecate' | 'remove';
  summary: string;
}

const SET_WORDS: Record<string, [string, string]> = {
  image: ['new screenshot', 'screenshot added'],
  figma: ['design link changed', 'design linked (Figma)'],
  mockup: ['mockup changed', 'walking mockup linked'],
};

const isLong = (v: unknown): boolean =>
  typeof v === 'string' && typeOf(v) === null && v.replaceAll(/\s+/g, ' ').trim().length > 60;

interface Ctx {
  core: Core;
  words: Words;
}

const text = (x: unknown): string => str(x) ?? '';

const wordOf = (r: OpRecord): string => {
  if (r.type === null) return '';
  // the reader's word is "event"; "message" is the schema's name for it
  return r.type === 'message' ? 'event' : TYPE_WORDS[r.type];
};

const nameOf = ({ core }: Ctx, r: OpRecord): string =>
  str(prop(core.sys(r.target), 'name')) ?? (r.target ?? '').split('#')[1] ?? '';

function summariseField(ctx: Ctx, r: OpRecord, p: PropChange): string {
  const name = nameOf(ctx, r);
  const { words } = ctx;
  if (Array.isArray(p.before) && Array.isArray(p.after))
    return `${name} ${words.listDelta(p.prop, p.before, p.after)}`;
  if (isRecord(p.before) && isRecord(p.after))
    return `${name} ${words.objDelta(p.prop, p.before, p.after)}`;
  const change = `${words.valText(p.before)} → ${words.valText(p.after)}`;
  return p.prop === 'type' ? `${name}: ${change}` : `${name} ${propWord(p.prop)}: ${change}`;
}

/** A text prop: a rewrite, an addition at the end, or just before and after. */
function summariseText(words: Words, p: PropChange): string {
  const [before, after] = [str(p.before), str(p.after)];
  if (p.prop === 'document' && before !== undefined && after !== undefined)
    return 'document rewritten';
  if (before !== undefined && before !== '' && after?.startsWith(before) === true)
    return `${propWord(p.prop)}: adds ${words.valText(after.slice(before.length))}`;
  if (isLong(p.before) || isLong(p.after)) {
    const verb = p.before === null || p.before === undefined ? 'added' : 'changes';
    return `${propWord(p.prop)} ${verb}`;
  }
  return `${propWord(p.prop)}: ${words.valText(p.before)} → ${words.valText(p.after)}`;
}

function summariseValue({ words }: Ctx, p: PropChange): string {
  if (words.isIdValued(p.before) || words.isIdValued(p.after)) {
    const [a, b] = words.pairText(str(p.before) ?? null, str(p.after) ?? null);
    return `${p.prop} ${a} → ${b}`;
  }
  if (Array.isArray(p.before) && Array.isArray(p.after))
    return words.listDelta(p.prop, p.before, p.after);
  if (isRecord(p.before) && isRecord(p.after)) return words.objDelta(p.prop, p.before, p.after);
  return summariseText(words, p);
}

function summariseSet(ctx: Ctx, r: OpRecord, p: PropChange): string {
  if (p.prop === 'at') return `${nameOf(ctx, r)} moves on the screen`;
  const fixed = SET_WORDS[p.prop];
  if (fixed !== undefined) return present(p.before) ? fixed[0] : fixed[1];
  return r.type === 'field' ? summariseField(ctx, r, p) : summariseValue(ctx, p);
}

function summariseAdd({ core }: Ctx, r: OpRecord): string {
  const v = r.value;
  const [name, type, action, id] = [
    prop(v, 'name'),
    prop(v, 'type'),
    prop(v, 'action'),
    prop(v, 'id'),
  ];
  if (r.type === 'field') return `+ ${text(name)} ${text(type)}`.trim();
  if (r.type === 'step') {
    const after = r.afterId;
    const tail = typeof after === 'string' && after !== '' ? ` after "${core.label(after)}"` : '';
    return `+ step "${text(action ?? id)}"${tail}`;
  }
  if (r.type === 'region') return `+ region "${text(name ?? id)}"`;
  return `+ ${wordOf(r)} "${core.label(r.target ?? '')}"`;
}

function summariseModify(ctx: Ctx, r: OpRecord, p: PropChange | undefined): string {
  if (p === undefined) return '';
  if (p.change === 'set') return summariseSet(ctx, r, p);
  return `${p.change === 'append' ? '+' : '−'} ${p.prop}: ${ctx.words.valText(p.values)}`;
}

function summariseDeprecate({ core, words }: Ctx, r: OpRecord): string {
  const to = r.replacedBy;
  if (typeof to !== 'string' || to === '')
    return `− deprecated ${wordOf(r)} "${core.label(r.target ?? '')}"`;
  const [a, b] = words.pairText(r.target, to);
  return `− deprecated ${a} → ${b}`;
}

/** Human one-liner for one prop entry of a record. */
function summarise(ctx: Ctx, r: OpRecord, p?: PropChange): string {
  switch (r.kind) {
    case 'add': {
      return summariseAdd(ctx, r);
    }
    case 'modify': {
      return summariseModify(ctx, r, p);
    }
    case 'deprecate': {
      return summariseDeprecate(ctx, r);
    }
    case 'remove': {
      return `× ${wordOf(r)} "${labelOf(r.removed, r.target ?? '')}"`;
    }
    default: {
      return '';
    }
  }
}

function entriesOf(ctx: Ctx, r: OpRecord): DiffEntry[] {
  const base = {
    changeId: r.changeId,
    opIndex: r.opIndex,
    path: formatPath(r.path),
    target: r.target,
    kind: r.kind,
  };
  if (r.kind === 'modify')
    return r.props.map((p) => ({
      ...base,
      prop: p.prop,
      before: p.before,
      after: p.after,
      change: p.change,
      summary: summarise(ctx, r, p),
    }));
  const one = (change: DiffEntry['change'], before: unknown, after?: unknown): DiffEntry[] => [
    { ...base, prop: null, before, after, change, summary: summarise(ctx, r) },
  ];
  if (r.kind === 'add') return one('add', undefined, r.value);
  if (r.kind === 'deprecate') return one('deprecate', null, r.replacedBy ?? null);
  return one('remove', r.removed);
}

const replacedWith = (r: OpRecord, id: string): boolean =>
  r.kind === 'deprecate' && r.replacedBy === id;

/** How a plan changes things, said in words: one entry per prop of every op, and the versions of an entity. */
export function createDiff(core: Core, words: Words) {
  const { sys, records, unionIds } = core;
  const ctx: Ctx = { core, words };
  const entries = (r: OpRecord): DiffEntry[] => entriesOf(ctx, r);

  /** One-line summary of an op (props joined with "; "). */
  const opSummary = (changeId: string | undefined, opIndex: number): string => {
    const r = records.find((x) => x.changeId === changeId && x.opIndex === opIndex);
    return r === undefined
      ? ''
      : entries(r)
          .map((e) => e.summary)
          .join('; ');
  };

  /**
   * Every prop change of a change's ops, or of a container's own ops and its children's.
   */
  const diff = memo((id: string): DiffEntry[] => {
    if (typeOf(id) === 'change') return records.filter((r) => r.changeId === id).flatMap(entries);
    const related = records.filter(
      (r) => r.target === id || r.ids.includes(id) || r.parent === id || parentOf(r.target) === id,
    );
    return related.flatMap(entries);
  });

  /** The version before and after an entity: `supersedes` on the new one, or `replaced_by` on the deprecate op. */
  const versions = memo((id: string): { supersedes: string | null; replacedBy: string | null } => {
    const dep = records.find(
      (r) => r.kind === 'deprecate' && r.target === id && present(r.replacedBy),
    );
    const successor =
      dep?.replacedBy ?? unionIds.find((x) => prop(sys(x), 'supersedes') === id) ?? null;
    const predecessor =
      str(prop(sys(id), 'supersedes')) ?? records.find((r) => replacedWith(r, id))?.target ?? null;
    return { supersedes: predecessor, replacedBy: successor };
  });

  return { diff, opSummary, versions };
}
