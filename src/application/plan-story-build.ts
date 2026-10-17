import type { Model } from '@/application/plan/derive';
import { andList } from '@/application/plan-viz-ladder-order';
import type { BuildSummary, MilestoneState } from '@/application/plan-viz-milestone';
import { shortDate } from '@/application/plan-viz-state';
import { teamName } from '@/application/plan-viz-teams';
import { countOf, numWord, short } from '@/application/plan-viz-text';
import { criticalSet, wiState } from '@/application/plan-viz-work';
import type { WorkItem } from '@/domain/plan/plan.generated';

// What leads the build chapter: one claim per state of the work. Before delivery, what gates it; in delivery, who has
// work left; delivered, that it is. The cards themselves are the board's.

const TITLE_BREAK = /[(:;,—–]/u;
const TITLE_MAX = 48;
const PATH_TEAMS = 2;
const SIZE_ORDER = ['XL', 'L'] as const;

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const names = (model: Model, teams: readonly string[]): string =>
  andList(teams.map((t) => teamName(model, t)));
const verbFor = (n: number): string => (n === 1 ? 'has' : 'have');

interface FirstGate {
  readonly ms: MilestoneState;
  readonly item: WorkItem;
  readonly onPath: boolean;
}

/** The milestone that finishes first and the work item that gates it: the last critical-path item inside it, else the last item. */
function firstGate(model: Model, sum: BuildSummary): FirstGate | null {
  const critical = criticalSet(model);
  for (const ms of sum.milestones) {
    const items = sum.items.filter((w) => w.milestone === ms.id);
    const onPath = items.filter((w) => critical.has(w.id));
    const item = (onPath.length > 0 ? onPath : items).at(-1);
    if (item !== undefined) return { ms, item, onPath: onPath.length > 0 };
  }
  return null;
}

function deliveredHeadline(model: Model, sum: BuildSummary): string {
  const done = sum.total === 1 ? 'the work item is' : `all ${String(sum.total)} work items`;
  const closed =
    sum.closed === null ? '' : `; the last milestone closed ${shortDate(sum.closed, model.today)}`;
  return `Delivered: ${done} done${closed}.`;
}

function startedHeadline(model: Model, sum: BuildSummary): string {
  const { current } = sum;
  const who = [...new Set((current === null ? sum.todo : sum.left).map((w) => w.team))];
  const due =
    current?.dueText === undefined || current.dueText === '' ? '' : ` (${current.dueText})`;
  const where = current === null ? '' : ` for ${current.short}${due}`;
  const path =
    sum.pathTeams.length > 0
      ? ` The critical path runs through ${names(model, sum.pathTeams.slice(0, PATH_TEAMS))}.`
      : '';
  const counts = `${String(sum.done)} of ${String(sum.total)} done`;
  return `${names(model, who)} ${verbFor(who.length)} work left${where}; ${counts}.${path}`;
}

function waitsHeadline(model: Model, sum: BuildSummary): string {
  const gate = firstGate(model, sum);
  const rest = sum.pathTeams.filter((t) => t !== gate?.item.team).slice(0, PATH_TEAMS);
  if (gate?.onPath === true) {
    const what = short(gate.item.title.split(TITLE_BREAK)[0]?.trim(), TITLE_MAX);
    const then =
      rest.length > 0 ? `; the critical path then runs through ${names(model, rest)}` : '';
    return `${gate.ms.short} waits on ${teamName(model, gate.item.team)}’s ${what}${then}.`;
  }
  const path =
    sum.pathTeams.length > 0
      ? `The critical path runs through ${names(model, sum.pathTeams.slice(0, PATH_TEAMS))}; `
      : '';
  return capital(`${path}the rest can be built in parallel.`);
}

const NO_WORK = 'No work items yet.';

/** 7.1's headline, one claim per state. */
export function orderHeadline(
  model: Model,
  sum: BuildSummary,
  waves: readonly (readonly string[])[],
): string {
  if (sum.total === 0) return NO_WORK;
  if (sum.delivered) return deliveredHeadline(model, sum);
  if (sum.started) return startedHeadline(model, sum);
  if (!waves.some((w) => w.length > 1)) {
    return 'Every step needs the one before it, so nothing can be built in parallel.';
  }
  return waitsHeadline(model, sum);
}

function deliveredWork(model: Model, sum: BuildSummary): string {
  const by = new Map<string, number>();
  for (const w of sum.items) by.set(w.team, (by.get(w.team) ?? 0) + 1);
  const [top] = [...by].toSorted((a, b) => b[1] - a[1]);
  if (top === undefined) return NO_WORK;
  const [team, n] = top;
  const who = teamName(model, team);
  if (by.size === 1) return `${who} built all ${String(sum.total)} work items.`;
  const share = n * 2 > sum.total ? 'most of it' : 'the largest share';
  return `${who} built ${share}: ${String(n)} of ${String(sum.total)} work items.`;
}

function leftWork(model: Model, sum: BuildSummary): string {
  const left = new Map<string, number>();
  for (const w of sum.todo) left.set(w.team, (left.get(w.team) ?? 0) + 1);
  const teams = [...left.keys()].toSorted((a, b) => (left.get(b) ?? 0) - (left.get(a) ?? 0));
  const [only] = teams;
  if (teams.length === 1 && only !== undefined && sum.todo.length === 1) {
    return `${teamName(model, only)} has the one work item still to do.`;
  }
  const count = String(sum.todo.length);
  return `${names(model, teams)} ${verbFor(teams.length)} the ${count} work items still to do.`;
}

function pathWork(model: Model, sum: BuildSummary): string {
  const [top] = sum.pathTeams;
  if (top === undefined) {
    const teams = new Set(sum.items.map((w) => w.team)).size;
    return `${countOf(sum.total, 'work item')} for ${numWord(teams)} teams, in build order.`;
  }
  const mine = sum.items.filter((w) => w.team === top);
  const big = SIZE_ORDER.find((z) => mine.some((w) => w.size === z));
  const n = mine.filter((w) => w.size === big).length;
  const size = big === undefined ? '' : `, ${numWord(n)} ${big}`;
  return `${teamName(model, top)} carries the critical path: ${String(mine.length)} of ${String(sum.total)} work items${size}.`;
}

/** 7.3's headline: who carries the critical path before delivery, who has what is left in delivery. */
export function workHeadline(model: Model, sum: BuildSummary): string {
  if (sum.total === 0) return NO_WORK;
  if (sum.delivered) return deliveredWork(model, sum);
  return sum.started ? leftWork(model, sum) : pathWork(model, sum);
}

export interface WaveView {
  readonly n: number;
  readonly ids: readonly string[];
  /** Every item in it is done. */
  readonly finished: boolean;
  readonly label: string;
  readonly hint: string;
  /** The milestones whose last item is in this wave: their cards follow it. */
  readonly checkpoints: readonly string[];
}

/** Each milestone's card goes after the wave holding its last item; one without items goes last. */
function checkpointsOf(
  sum: BuildSummary,
  waves: readonly (readonly string[])[],
): ReadonlyMap<number, string[]> {
  const waveOf = new Map(waves.flatMap((ids, i) => ids.map((id) => [id, i] as const)));
  const out = new Map<number, string[]>();
  for (const ms of sum.milestones) {
    const at = ms.items.flatMap((id) => waveOf.get(id) ?? []);
    const wave = at.length > 0 ? Math.max(...at) : waves.length - 1;
    out.set(wave, [...(out.get(wave) ?? []), ms.id]);
  }
  return out;
}

function hintOf(i: number, approved: boolean): string {
  if (i > 0) return `Starts when wave ${String(i)} is done`;
  return approved ? 'Can start now' : 'First, once approved';
}

/** The build waves, in order, each with what it says about itself and the milestones it completes. */
export function waveViews(model: Model, sum: BuildSummary, approved: boolean): WaveView[] {
  const waves = model.waves();
  const checkpoints = checkpointsOf(sum, waves);
  return waves.map((ids, i) => {
    const finished = sum.started && ids.every((id) => wiState(model, id) === 'done');
    const size = ids.length > 1 ? `${numWord(ids.length)} items at once` : 'one item';
    return {
      n: i + 1,
      ids,
      finished,
      label: `Wave ${String(i + 1)} · ${finished ? 'done' : size}`,
      hint: hintOf(i, approved),
      checkpoints: sum.delivered ? [] : (checkpoints.get(i) ?? []),
    };
  });
}

/** The strip of milestone names shows when there is more than one and the work is not delivered. */
export const showsStrip = (sum: BuildSummary): boolean =>
  sum.milestones.length >= 2 && !sum.delivered;
