import type { Model } from '@/application/plan/derive';
import { plainLine } from '@/application/plan-viz-text';
import { voteText } from '@/application/plan-viz-vote';
import { wiState } from '@/application/plan-viz-work';

// The ownership table: one row per team, one column per kind of thing it owns or decides. Cells are counts that open
// the names; the team page and the teams page read the same function, so they cannot disagree.

/** What a team owns in the system, and what it owns or decides in the plan. */
type SystemKey = 'svc' | 'st' | 'if' | 'msg';
type PlanKey = 'chg' | 'wi' | 'tst' | 'dec' | 'vote';

export interface OwnerColumn {
  readonly key: SystemKey | PlanKey;
  readonly head: string;
  /** The title of the panel a count opens. */
  readonly title: string;
}

export const OWNER_COLUMNS: readonly OwnerColumn[] = [
  { key: 'svc', head: 'components', title: 'Components' },
  { key: 'st', head: 'stores', title: 'Stores' },
  { key: 'if', head: 'interfaces', title: 'Interfaces' },
  { key: 'msg', head: 'events published', title: 'Events published' },
  { key: 'chg', head: 'changes', title: 'Changes' },
  { key: 'wi', head: 'work items', title: 'Work items' },
  { key: 'tst', head: 'tests', title: 'Tests' },
  { key: 'dec', head: 'decides', title: 'Decides' },
  { key: 'vote', head: 'confidence', title: 'Confidence rating' },
];

export type OwnerKey = Exclude<OwnerColumn['key'], 'vote'>;
export type OwnerLists = Readonly<Record<OwnerKey, readonly string[]>>;

interface OwnerOptions {
  /** Drops things from the lists: the inspector's "today" view hides what the plan adds. */
  readonly hide?: ((id: string) => boolean) | undefined;
}

/** Everything the plan draws, as it is today and as it will be, each id once. */
function union<T extends { readonly id: string }>(now: readonly T[], next: readonly T[]): T[] {
  const seen = new Set(now.map((x) => x.id));
  return [...now, ...next.filter((x) => !seen.has(x.id))];
}

/** What one team owns and decides, as id lists: its cut of the plan plus what its services own. */
export function ownerLists(model: Model, team: string, { hide }: OwnerOptions = {}): OwnerLists {
  const cut = model.teamCut(team);
  const keep = (id: string): boolean => hide?.(id) !== true;
  const owned = new Set(cut.services);
  const stores = union(model.asIs.stores, model.toBe.stores).filter((s) => owned.has(s.owner));
  const interfaces = union(model.asIs.interfaces, model.toBe.interfaces).filter((i) =>
    owned.has(i.service),
  );
  const messages = union(model.asIs.messages, model.toBe.messages).filter((m) =>
    owned.has(m.producer),
  );
  const decisions = (model.plan.decisions ?? []).filter(
    (d) => d.decider === team && d.status === 'proposed',
  );
  const questions = (model.plan.questions ?? []).filter(
    (q) => q.decider === team && model.questionState(q) === 'open',
  );
  return {
    svc: cut.services.filter(keep),
    st: stores.map((s) => s.id).filter(keep),
    if: interfaces.map((i) => i.id).filter(keep),
    msg: messages.map((m) => m.id).filter(keep),
    chg: cut.changes,
    wi: cut.workItems,
    tst: cut.tests,
    dec: [...decisions.map((d) => d.id), ...questions.map((q) => q.id)],
  };
}

/** The name a count's hover card gives a thing. */
export const nameOf = (model: Model, id: string): string => plainLine(model.label(id));

/** "3" before delivery; "3 · 1 done" once work is in GitHub. */
export function workText(model: Model, ids: readonly string[]): string {
  const states = ids.map((id) => wiState(model, id));
  if (states.every((s) => s === null)) return String(ids.length);
  return `${String(ids.length)} · ${String(states.filter((s) => s === 'done').length)} done`;
}

/** The cells of a row as plain text, in column order: "2|1|3|0|4|3 · 1 done|5|1|4 of 5". */
export function ownerFacts(model: Model, team: string, lists: OwnerLists): string {
  const vote = voteText(model, team);
  return OWNER_COLUMNS.map((c) => {
    if (c.key === 'vote') return vote === '' ? '·' : vote;
    return c.key === 'wi' ? workText(model, lists.wi) : String(lists[c.key].length);
  }).join('|');
}

/** A team's channel, unless the plan still holds a placeholder there. */
export function channelOf(model: Model, team: string): string {
  const channel = model.plan.teams.find((t) => t.id === team)?.channel ?? '';
  return /^(?:tbd|todo|-|n\/a)?$/iu.test(channel.trim()) ? '' : channel.trim();
}
