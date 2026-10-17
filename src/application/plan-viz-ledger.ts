import type { Model } from '@/application/plan/derive';
import {
  type LedgerRow,
  changeService,
  changeTeam,
  ledgerRow,
} from '@/application/plan-viz-ledger-row';
import { countOf } from '@/application/plan-viz-text';

// The ledger grouped by service or team, and the plan's health strip.

export type GroupBy = 'service' | 'team' | 'none';

export interface LedgerGroup {
  /** The service or team id; null for the changes that belong to neither. */
  readonly key: string | null;
  readonly rows: readonly LedgerRow[];
}

interface GroupOptions {
  readonly groupBy?: GroupBy;
  /** Keep the changes one team works on. */
  readonly lens?: string | null;
}

const NOWHERE = 1e9;

function groupKey(model: Model, id: string, groupBy: GroupBy): string | null {
  if (groupBy === 'none') return '';
  return groupBy === 'service' ? changeService(model, id) : changeTeam(model, id);
}

function groupOrder(model: Model, groupBy: GroupBy): string[] {
  if (groupBy === 'team') return model.plan.teams.map((t) => t.id);
  return [...model.plan.services.map((s) => s.id), ...model.toBe.services.map((s) => s.id)];
}

function keptBy(model: Model, lens: string | null): (id: string) => boolean {
  if (lens === null) return () => true;
  const cut = new Set(model.teamCut(lens).changes);
  return (id) => cut.has(id) || model.teamsOf(id).includes(lens);
}

/** The teams whose lens keeps a change, so the ledger can be drawn once and cut on the client. */
export function keepersOf(model: Model): (id: string) => string[] {
  const keeps = model.plan.teams.map((t) => [t.id, keptBy(model, t.id)] as const);
  return (id) => keeps.filter(([, keep]) => keep(id)).map(([team]) => team);
}

/** Every change as a row, grouped, with the groups in the plan's own order and "plan-wide" last. */
export function ledgerGroups(
  model: Model,
  { groupBy = 'service', lens = null }: GroupOptions = {},
): LedgerGroup[] {
  const all = (model.plan.changes ?? []).map((c) => c.id);
  const keep = keptBy(model, lens);
  const groups = new Map<string | null, LedgerRow[]>();
  for (const [i, id] of all.entries()) {
    const row = keep(id) ? ledgerRow(model, id, i + 1) : null;
    if (row === null) continue;
    const key = groupKey(model, id, groupBy);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const order = groupOrder(model, groupBy);
  const rank = (k: string | null): number => {
    if (k === null) return NOWHERE + 1;
    const at = order.indexOf(k);
    return at === -1 ? NOWHERE : at;
  };
  return [...groups.entries()]
    .toSorted(([a], [b]) => rank(a) - rank(b))
    .map(([key, rows]) => ({ key, rows }));
}

export type HealthKey =
  'changes' | 'tests' | 'issues' | 'untested' | 'orphans' | 'questions' | 'errors';

export interface HealthTile {
  readonly key: HealthKey;
  readonly value: number;
  readonly label: string;
  readonly sub: string;
  readonly tone: 'good' | 'warn' | 'bad' | 'plain';
  readonly ids: readonly string[];
  readonly moreIds: number;
}

const MAX_IDS = 6;
const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);
const flagged = (n: number): 'warn' | 'good' => (n > 0 ? 'warn' : 'good');

/** The plan health strip: each count with its label spelled out and a line saying what it means. */
export function healthTiles(model: Model, keys?: readonly HealthKey[]): HealthTile[] {
  const h = model.health();
  const plain = (key: HealthKey, value: number, words: readonly [string, string]): HealthTile => ({
    key,
    value,
    label: words[0],
    sub: words[1],
    tone: 'plain',
    ids: [],
    moreIds: 0,
  });
  const all: HealthTile[] = [
    plain('changes', h.changes, [
      plural(h.changes, 'change', 'changes'),
      'planned edits to the system',
    ]),
    plain('tests', h.tests, [plural(h.tests, 'test', 'tests'), 'each proves at least one change']),
    plain('issues', h.workItems, [
      plural(h.workItems, 'work item', 'work items'),
      'the work that builds them',
    ]),
    {
      ...plain('untested', h.untested, [
        'untested changes',
        h.untested > 0 ? 'changes no test proves yet' : 'every change has at least one test',
      ]),
      tone: flagged(h.untested),
    },
    {
      ...plain('orphans', h.orphans, [
        plural(h.orphans, 'unused thing', 'unused things'),
        h.orphans > 0 ? 'things no flow, change or note refers to' : 'everything is used somewhere',
      ]),
      tone: flagged(h.orphans),
      ids: h.orphanIds.slice(0, MAX_IDS),
      moreIds: Math.max(0, h.orphanIds.length - MAX_IDS),
    },
    {
      ...plain('questions', h.openQuestions, [
        plural(h.openQuestions, 'open question', 'open questions'),
        h.openQuestions > 0 ? 'waiting on a decision' : 'nothing left to decide',
      ]),
      tone: flagged(h.openQuestions),
    },
    {
      ...plain('errors', h.errors, [plural(h.errors, 'rule break', 'rule breaks'), errorsSub(h)]),
      tone: h.errors > 0 ? 'bad' : 'good',
    },
  ];
  return keys === undefined ? all : keys.flatMap((k) => all.filter((t) => t.key === k));
}

function errorsSub(h: { readonly errors: number; readonly warnings: number }): string {
  if (h.warnings > 0) return `${countOf(h.warnings, 'warning')} as well`;
  return h.errors > 0 ? 'the plan file breaks a rule' : 'the plan file follows every rule';
}
