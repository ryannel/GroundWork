import { prop } from '@/application/plan/ids';
import type { WorkImpact } from '@/application/plan/impact-work';
import { findEntity } from '@/application/plan/revision-view';
import { nameIn, type Pair, type View } from '@/application/plan-story-versions-pair';
import { dayText, tellWhy } from '@/application/plan-story-versions-words';
import { workRowOf, type WorkRow } from '@/application/plan-story-versions-work';
import { andList } from '@/application/plan-viz-ladder-order';
import { STATE_WORD } from '@/application/plan-viz-work';

// The work a revision moves, and which teams own it.

export interface TeamView {
  readonly id: string;
  readonly name: string;
  readonly role: { readonly text: string; readonly tell: boolean } | null;
  readonly work: readonly WorkRow[];
}

export interface TeamsView {
  /** What the proposal costs, in one line: the bold lead, then where it lands. Only while it is proposed. */
  readonly cost: { readonly lead: string; readonly when: string } | null;
  readonly teams: readonly TeamView[];
  readonly none: string | null;
}

const MOVING = new Set(['rework', 'changes', 'drop', 'new']);

function facts(w: WorkImpact): string {
  const state = w.effect !== 'new' && w.state !== null ? STATE_WORD[w.state] : null;
  const parts = [w.size === null ? null : `size ${w.size}`, state].filter((x) => x !== null);
  return parts.length === 0 ? '' : ` (${parts.join(', ')})`;
}

const PARTS = [
  ['rework', 'Reopens'],
  ['changes', 'changes'],
  ['drop', 'drops'],
  ['new', 'adds'],
] as const;

function costPart(pair: Pair, ws: readonly WorkImpact[], verb: string): string {
  if (ws.length === 0) return '';
  if (ws.every((w) => w.effect === 'new')) {
    const count = ws.length === 1 ? 'one new work item' : `${String(ws.length)} new work items`;
    const whose = andList(ws.map((w) => `for ${nameIn(pair, w.team)}${facts(w)}`));
    return `${verb} ${count} ${whose}`;
  }
  const whose = andList(ws.map((w) => `${nameIn(pair, w.team)}'s work item${facts(w)}`));
  return `${verb} ${whose}`;
}

function landing(pair: Pair, moving: readonly WorkImpact[]): string {
  const ids = [...new Set(moving.flatMap((w) => (w.milestone === null ? [] : [w.milestone])))];
  const named = ids.flatMap((id) => {
    const m = findEntity(pair.to, id) ?? findEntity(pair.from, id);
    if (m === null) return [];
    const due = prop(m, 'due');
    const name = nameIn(pair, id);
    return [typeof due === 'string' && due !== '' ? `${name}, due ${dayText(due)}` : name];
  });
  return named.length === 0 ? '' : ` It lands in ${andList(named)}.`;
}

function costOf(pair: Pair): TeamsView['cost'] {
  const moving = pair.im.work.filter((w) => MOVING.has(w.effect));
  if (moving.length === 0) return { lead: 'No work under way changes.', when: '' };
  const parts = PARTS.map(([effect, verb]) =>
    costPart(
      pair,
      moving.filter((w) => w.effect === effect),
      verb,
    ),
  ).filter((p) => p !== '');
  const sentence = andList(parts);
  const onlyNew = moving.every((w) => w.effect === 'new');
  const lead = onlyNew
    ? `No work under way changes; it ${sentence}.`
    : `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
  return { lead, when: landing(pair, moving) };
}

function roleOf(view: View, team: string): TeamView['role'] {
  const { pair, tense } = view;
  if ((pair.entry.by ?? []).includes(team)) return { text: 'Proposed it', tell: false };
  const tell = pair.im.tell.find((x) => x.team === team);
  if (!tense.live || tell === undefined) return null;
  return { text: `Tell them: ${tellWhy(tell.whys)}`, tell: true };
}

function noChange(quiet: readonly string[], passing: readonly string[]): string | null {
  const verb = passing.length === 1 ? 'passes' : 'pass';
  const said = [
    quiet.length > 0 ? `No change for ${andList(quiet)}.` : '',
    passing.length > 0 ? `${andList(passing)} ${verb} the new data on as it is.` : '',
  ].filter((x) => x !== '');
  return said.length === 0 ? null : said.join(' ');
}

/** The work a revision moves, team by team; teams it leaves alone are one line. */
export function teamsView(view: View): TeamsView {
  const { pair, tense } = view;
  const teams: TeamView[] = [];
  const [quiet, passing]: [string[], string[]] = [[], []];
  for (const t of pair.im.teams) {
    const list = t.work.filter((w) => tense.live || w.effect !== 'keep');
    if (list.length > 0) {
      teams.push({
        id: t.id,
        name: nameIn(pair, t.id),
        role: roleOf(view, t.id),
        work: list.map((w) => workRowOf(pair, tense, w)),
      });
    } else {
      const passes = t.steps.length > 0 && t.steps.every((s) => s.mark === 'data');
      (passes ? passing : quiet).push(nameIn(pair, t.id));
    }
  }
  return {
    cost: tense.live ? costOf(pair) : null,
    teams,
    none: noChange(quiet, passing),
  };
}
