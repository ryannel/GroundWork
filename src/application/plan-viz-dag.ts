import type { Model } from '@/application/plan/derive';
import { type DagEdge, edgesOf, violationsOf } from '@/application/plan-viz-dag-edges';
import {
  COL_GAP,
  NODE_W,
  PAD,
  type DagItem,
  type Frame,
  type Grid,
  frameOf,
  gridOf,
} from '@/application/plan-viz-dag-layout';
import { wrapTitle } from '@/application/plan-viz-dag-text';
import { msState } from '@/application/plan-viz-milestone';
import { shortDate } from '@/application/plan-viz-state';
import { teamIndex, teamName } from '@/application/plan-viz-teams';
import {
  SIZE_WORD,
  STATE_WORD,
  type WorkState,
  milestoneById,
  wiState,
  workList,
} from '@/application/plan-viz-work';
import type { WorkItem } from '@/domain/plan/plan.generated';

export type { DagEdge } from '@/application/plan-viz-dag-edges';

// The work items' dependency graph, worked out once: where each card sits, which edges run between them, and what
// the drawing has to say beside it (the teams, the milestones that are out of order).

export interface DagNode {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly lines: readonly string[];
  readonly teamName: string;
  readonly slot: number;
  readonly sub: string;
  readonly critical: boolean;
  readonly dim: boolean;
  readonly state: WorkState | null;
  readonly waits: readonly string[];
  readonly late: boolean;
  /** What waiting is on, one line each. */
  readonly waitsText: string;
  readonly label: string;
}

export interface DagBandView {
  readonly id: string;
  /** The milestone the band opens; null for the items with none. */
  readonly ref: string | null;
  readonly x: number;
  readonly w: number;
  readonly name: string;
  readonly shown: string;
  readonly right: string;
}

export interface Dag {
  readonly w: number;
  readonly h: number;
  readonly count: number;
  readonly nodes: readonly DagNode[];
  readonly edges: readonly DagEdge[];
  readonly bands: readonly DagBandView[];
  readonly teams: readonly string[];
  readonly violations: readonly { readonly text: string }[];
  readonly anyWaits: boolean;
  readonly hasState: boolean;
}

export interface DagOptions {
  /** Group the columns into milestone bands. */
  readonly byMilestone?: boolean | undefined;
  /** Fade every card that is not this team's. */
  readonly lens?: string | null | undefined;
}

const CHAR_W = 7.9;
const TITLE_WIDTH = 19;
const TITLE_LINES = 3;
const MIN_FIT = 4;
const LABEL_PAD = 24;

interface Ctx {
  readonly model: Model;
  readonly items: readonly WorkItem[];
  readonly grid: Grid;
  readonly frame: Frame;
  readonly critical: ReadonlySet<string>;
  readonly byMs: boolean;
}

/** What a band says at its right: the due date, and how far on it is once delivery has begun. */
function bandRight(model: Model, id: string, hasState: boolean): string {
  const state = hasState && milestoneById(model, id) !== undefined ? msState(model, id) : null;
  if (state === null) return '';
  const progress = state.started && state.total > 0 ? state.text : '';
  return [state.dueText, progress].filter((part) => part !== '').join(' · ');
}

function bandViews(ctx: Ctx, hasState: boolean): DagBandView[] {
  const { model, grid } = ctx;
  return grid.bands.map((band, i) => {
    const first = i === 0 ? COL_GAP / 2 - PAD / 2 : 0;
    const x = PAD + band.from * (NODE_W + COL_GAP) - COL_GAP / 2 + first;
    const end = i === grid.bands.length - 1 ? PAD / 2 : COL_GAP / 2;
    const w = PAD + band.to * (NODE_W + COL_GAP) + NODE_W + end - x;
    const ms = milestoneById(model, band.id);
    const name = ms === undefined ? 'No milestone' : ms.name;
    const right = bandRight(model, band.id, hasState);
    const room = w - LABEL_PAD - (right === '' ? 0 : right.length * CHAR_W + PAD);
    const fit = Math.max(MIN_FIT, Math.floor(room / CHAR_W));
    const shown = name.length > fit ? `${name.slice(0, fit - 1).trimEnd()}…` : name;
    return { id: band.id, ref: ms === undefined ? null : band.id, x, w, name, shown, right };
  });
}

function waitsText(model: Model, waits: readonly string[]): string {
  return waits
    .map((q) => {
      const by = (model.plan.questions ?? []).find((x) => x.id === q)?.decide_by;
      const when = by === undefined ? '' : ` (by ${shortDate(by)})`;
      return `${model.label(q)}${when}${model.overdue(q) ? ' · overdue' : ''}`;
    })
    .join('\n');
}

function aria(ctx: Ctx, w: WorkItem, wait: { waits: readonly string[]; late: boolean }): string {
  const { model, critical } = ctx;
  const { waits, late } = wait;
  const state = wiState(model, w.id);
  const what = waits.length === 1 ? 'an open question' : `${String(waits.length)} open questions`;
  const overdue = late ? ' (overdue)' : '';
  return [
    w.title,
    teamName(model, w.team),
    `size ${SIZE_WORD[w.size ?? ''] ?? w.size ?? ''}`,
    critical.has(w.id) ? 'on the critical path' : '',
    state === null ? '' : STATE_WORD[state],
    waits.length === 0 ? '' : `waits on ${what}${overdue}`,
  ]
    .filter((part) => part !== '')
    .join(', ');
}

function subOf(ctx: Ctx, w: WorkItem): string {
  const ms = milestoneById(ctx.model, w.milestone);
  const first = ctx.byMs ? undefined : (ms?.name ?? '').split('·')[0]?.trim();
  return [w.size === undefined ? '' : `size ${w.size}`, first ?? '']
    .filter((part) => part !== '')
    .join(' · ');
}

function nodeOf(ctx: Ctx, w: WorkItem, lens: string | null): DagNode {
  const { model, frame, critical } = ctx;
  const waits = model.blockersOf(w.id);
  const late = waits.some((q) => model.overdue(q));
  return {
    id: w.id,
    x: frame.x(w.id),
    y: frame.y(w.id),
    lines: wrapTitle(w.title, TITLE_WIDTH, TITLE_LINES),
    teamName: teamName(model, w.team),
    slot: teamIndex(model, w.team),
    sub: subOf(ctx, w),
    critical: critical.has(w.id),
    dim: lens !== null && w.team !== lens,
    state: wiState(model, w.id),
    waits,
    late,
    waitsText: waitsText(model, waits),
    label: aria(ctx, w, { waits, late }),
  };
}

/** The dependency graph of the plan's work items; null when there are none. */
export function dagOf(model: Model, opts: DagOptions = {}): Dag | null {
  const work = workList(model);
  if (work.length === 0) return null;
  const known = new Set(work.map((w) => w.id));
  const byId = new Map(work.map((w) => [w.id, w]));
  const items = model.topoOrder().flatMap((id) => (known.has(id) ? (byId.get(id) ?? []) : []));
  const milestones = (model.plan.milestones ?? []).map((m) => m.id);
  const byMs = opts.byMilestone === true && milestones.length > 0;
  const { path } = model.criticalPath();
  const critical = new Set(path);
  const dagItems: DagItem[] = items.map((w) => ({
    id: w.id,
    milestone: w.milestone,
    deps: (w.depends_on ?? []).filter((d) => known.has(d)),
  }));
  const grid = gridOf(dagItems, { milestones, byMilestone: byMs, critical });
  const frame = frameOf(grid, byMs);
  const ctx: Ctx = { model, items, grid, frame, critical, byMs };
  const nodes = items.map((w) => nodeOf(ctx, w, opts.lens ?? null));
  const hasState = nodes.some((n) => n.state !== null);
  return {
    w: frame.w,
    h: frame.h,
    count: work.length,
    nodes,
    edges: edgesOf(model, { items, grid, frame }, path),
    bands: byMs ? bandViews(ctx, hasState) : [],
    teams: [...new Set(items.map((w) => w.team))],
    violations: violationsOf(model),
    anyWaits: nodes.some((n) => n.waits.length > 0),
    hasState,
  };
}
