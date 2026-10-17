import type { Model } from '@/application/plan/derive';
import { prop } from '@/application/plan/ids';
import {
  type Ladder,
  isConsumer,
  lastMigrateMs,
  msBefore,
  msShort,
  retireMilestone,
  rungMilestone,
  versionNames,
} from '@/application/plan-viz-ladder-order';
import { countOf, plainLine, short } from '@/application/plan-viz-text';

// The rungs of a migration ladder as the page draws them: what happens, when, the edits and who does the work.

export type RungKind = 'expand' | 'migrate' | 'deprecate' | 'retire';
type Rung = Ladder['rungs'][number];
type Op = Rung['ops'][number];

export const RUNG_WORD: Readonly<Record<RungKind, string>> = {
  expand: 'Expand',
  migrate: 'Migrate',
  deprecate: 'Deprecate',
  retire: 'Remove',
};

export const RUNG_HINT: Readonly<Record<RungKind, string>> = {
  expand: 'add the new version next to the old one',
  migrate: 'move one consumer to the new version',
  deprecate: 'mark the old version deprecated; it is still served',
  retire: 'remove the old version once nobody reads it',
};

/** A piece of a rung's sentence: plain, a version in bold, a consumer to open, or the "still served" aside. */
export interface Seg {
  readonly text: string;
  readonly tone?: 'strong' | 'who' | 'still';
  readonly id?: string;
}

export interface OpLineView {
  readonly key: string;
  readonly change: 'added' | 'modified' | 'deprecated' | 'removed';
  readonly text: string;
  readonly more: boolean;
}

export interface RungView {
  readonly key: string;
  readonly kind: RungKind;
  readonly what: readonly Seg[];
  readonly when: { readonly text: string; readonly late: boolean; readonly title: string } | null;
  readonly ops: readonly OpLineView[];
  /** One quiet line instead of the edits, for a consumer that only switches over. */
  readonly note: string | null;
  readonly teams: readonly string[];
  readonly items: readonly { readonly id: string; readonly label: string }[];
  readonly noItems: boolean;
}

interface Ends {
  readonly from: string;
  readonly to: string;
  readonly isApi: boolean;
}

const textOf = (x: unknown): string | undefined =>
  typeof x === 'string' && x !== '' ? x : undefined;

function providerName(model: Model, { from, to, isApi }: Ends): string {
  const key = isApi ? '$service' : 'producer';
  const provider = textOf(prop(model.get(to), key)) ?? textOf(prop(model.get(from), key));
  return provider === undefined ? 'The provider' : model.label(provider);
}

function whatOf(model: Model, r: Rung, ends: Ends): Seg[] {
  const { from, to, isApi } = ends;
  if (from === to && r.label !== '' && from.includes('#')) return [{ text: r.label }];
  const n = versionNames(model, from, to);
  const p = providerName(model, ends);
  const serve = isApi ? 'serving' : 'publishing';
  if (r.rung === 'expand') {
    return [
      { text: `${p} starts ${serve} ` },
      { text: n.next, tone: 'strong' },
      { text: ` next to ${n.old}` },
    ];
  }
  if (r.kind === 'deprecate') {
    return [
      { text: n.old, tone: 'strong' },
      { text: ' marked deprecated ' },
      { text: `(still ${isApi ? 'served' : 'published'})`, tone: 'still' },
    ];
  }
  if (r.rung === 'contract') {
    return [{ text: `${p} stops ${serve} ` }, { text: n.old, tone: 'strong' }];
  }
  if (isConsumer(r.consumer)) {
    return [
      { text: model.label(r.consumer), tone: 'who', id: r.consumer },
      { text: ` ${isApi ? 'calls' : 'reads'} ${n.next} instead of ${n.old}` },
    ];
  }
  return [{ text: `${p} switches ${serve} to ` }, { text: n.next, tone: 'strong' }];
}

const keepPart = (p: string): boolean =>
  p.startsWith('via ') ||
  p.includes('consumers') ||
  p.includes('deprecated') ||
  ['+ ', '× ', '− '].some((s) => p.startsWith(s));

const SIGNS = '+~×−-';
const unsigned = (p: string): string =>
  SIGNS.includes(p.charAt(0)) && p.charAt(1) === ' ' ? p.slice(2) : p;

function changeOf(p: string): OpLineView['change'] {
  if (p.startsWith('+')) return 'added';
  if (p.startsWith('×')) return 'removed';
  return p.startsWith('−') ? 'deprecated' : 'modified';
}

/** The step an edit touches: the field it changes, when that field is named. */
function stepOf(model: Model, o: Op): string {
  const op = (model.plan.changes ?? []).find((c) => c.id === o.changeId)?.ops[o.opIndex];
  const target = textOf(prop(op, 'modify'));
  return target?.includes('#') === true ? short(model.label(target), 36) : '';
}

function opLines(model: Model, r: Rung): OpLineView[] {
  return r.ops.flatMap((o, oi) => {
    const parts = o.summary.split('; ');
    const kept = parts.filter(keepPart);
    const shown = kept.length > 0 ? kept : parts.slice(0, 1);
    const lines = shown.map((p, i): OpLineView => {
      const step =
        o.summary.startsWith('via') || p.trimStart().startsWith('via') ? stepOf(model, o) : '';
      const text = plainLine(unsigned(p));
      return {
        key: `${String(oi)}-${String(i)}`,
        change: changeOf(p),
        text: step === '' ? text : `${step}: ${text}`,
        more: false,
      };
    });
    if (parts.length === shown.length) return lines;
    const extra = countOf(parts.length - shown.length, 'other edit');
    return [
      ...lines,
      {
        key: `${String(oi)}-more`,
        change: 'modified' as const,
        text: `+ ${extra} to the same step`,
        more: true,
      },
    ];
  });
}

const switchOnly = (p: string): boolean =>
  p.startsWith('via ') || p.startsWith('− consumers') || p.startsWith('- consumers');

function migrateNote(model: Model, r: Rung): string | null {
  if (r.rung !== 'migrate' || !isConsumer(r.consumer)) return null;
  if (!r.ops.flatMap((o) => o.summary.split('; ')).every(switchOnly)) return null;
  const steps = [...new Set(r.ops.map((o) => stepOf(model, o)).filter((s) => s !== ''))];
  const quoted = steps.map((s) => `“${s}”`).join(', ');
  const what = steps.length > 0 ? `Moves ${quoted} to the new version` : 'Moves to the new version';
  return `${what}, and stops reading the old one.`;
}

interface Timing {
  readonly expandMs: string | null;
  readonly lastMigrate: string | null;
  readonly retireMs: string | null;
  readonly retireKind: RungKind | null;
}

function whenOf(model: Model, r: Rung, t: Timing): RungView['when'] {
  const own = rungMilestone(model, r.workItems);
  const ms =
    r.rung === 'contract' && r.kind === t.retireKind && t.retireMs !== null ? t.retireMs : own;
  if (ms === null) return null;
  const late =
    (r.rung === 'migrate' && msBefore(model, ms, t.expandMs)) ||
    (r.kind === 'retire' && msBefore(model, ms, t.lastMigrate));
  const before =
    r.kind === 'retire' ? 'the last consumer has moved' : 'the new version is published';
  return {
    text: late
      ? `planned ${msShort(model, ms)}, before ${before}`
      : `planned ${msShort(model, ms)}`,
    late,
    title: late ? 'Scheduled before the rung it depends on' : `Planned in ${model.label(ms)}`,
  };
}

function workItemLabel(model: Model, w: string): string {
  const item = model.plan.work_items?.find((x) => x.id === w);
  const title = short(item?.title ?? w, 72);
  return item?.github_issue === undefined ? title : `#${String(item.github_issue)} ${title}`;
}

export interface LadderView {
  readonly chain: readonly string[];
  readonly rungs: readonly RungView[];
  /** The kinds the legend explains, and whether it says the old version is not removed here. */
  readonly legend: readonly string[];
  readonly keepsOld: boolean;
}

function legendOf(l: Ladder): string[] {
  const kinds = new Set(l.rungs.map((r) => r.kind));
  const shown: RungKind[] = [
    'expand',
    'migrate',
    ...(['deprecate', 'retire'] as const).filter((k) => kinds.has(k)),
  ];
  if (!kinds.has('deprecate') && !kinds.has('retire')) shown.push('retire');
  return shown.map((k) => `${RUNG_WORD[k]}: ${RUNG_HINT[k]}`);
}

/** The ladder of a versioned message or endpoint, rung by rung; null when it has none. */
export function ladderView(model: Model, id: string): LadderView | null {
  const l = model.ladder(id);
  const from = l.chain[0];
  const to = l.chain.at(-1);
  if (from === undefined || to === undefined || l.rungs.length === 0) return null;
  const ends: Ends = { from, to, isApi: id.startsWith('api:') };
  const retirement = retireMilestone(model, id);
  const expand = l.rungs.find((r) => r.rung === 'expand');
  const timing: Timing = {
    expandMs: rungMilestone(model, expand?.workItems ?? []),
    lastMigrate: lastMigrateMs(model, l),
    retireMs: retirement.ms,
    retireKind: retirement.kind,
  };
  // A work item is drawn once, on the first rung it builds.
  const shown = new Set<string>();
  const rungs = l.rungs.map((r, i): RungView => {
    const fresh = r.workItems.filter((w) => !shown.has(w));
    for (const w of fresh) shown.add(w);
    const note = migrateNote(model, r);
    return {
      key: `${String(i)}-${r.kind}`,
      kind: r.kind,
      what: whatOf(model, r, ends),
      when: whenOf(model, r, timing),
      ops: note === null ? opLines(model, r) : [],
      note,
      teams: r.teams,
      items: fresh.map((w) => ({ id: w, label: workItemLabel(model, w) })),
      noItems: r.workItems.length === 0,
    };
  });
  const kinds = new Set(l.rungs.map((r) => r.kind));
  return {
    chain: l.chain,
    rungs,
    legend: legendOf(l),
    keepsOld: !l.retired && kinds.has('deprecate'),
  };
}
