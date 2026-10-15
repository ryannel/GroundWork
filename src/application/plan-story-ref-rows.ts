import type { Model } from '@/application/plan/derive';
import { type Show, graphOf, groupBy, poolOf } from '@/application/plan-story-ref';
import { teamIndex, teamOf } from '@/application/plan-viz-teams';
import { countOf } from '@/application/plan-viz-text';
import { workOrdered } from '@/application/plan-viz-work';
import type { FlowNode, OperationNode } from '@/domain/plan/plan-graph';
import type { Milestone, Test, WorkItem } from '@/domain/plan/plan.generated';

// The rows of the flow, test and operation catalogues.

const uniq = <T>(items: readonly T[]): T[] => [...new Set(items)];

/** The teams a flow's steps run between, in team order. */
export function flowTeams(model: Model, flow: FlowNode): string[] {
  const teams = uniq(
    flow.steps
      .flatMap((s) => [teamOf(model, s.from), teamOf(model, s.to)])
      .filter((t) => t !== null),
  );
  return teams.toSorted((a, b) => teamIndex(model, a) - teamIndex(model, b));
}

/** "3 steps · 1 whole flow". */
export function walksText(test: Pick<Test, 'walks'>): string {
  const walks = test.walks ?? [];
  const flows = walks.filter((w) => !w.includes('#')).length;
  const steps = walks.length - flows;
  return [steps > 0 ? countOf(steps, 'step') : '', flows > 0 ? countOf(flows, 'whole flow') : '']
    .filter((x) => x !== '')
    .join(' · ');
}

export const LEVELS_TOP_DOWN = ['e2e', 'integration', 'contract', 'service', 'unit'] as const;

export interface LevelTests {
  readonly level: (typeof LEVELS_TOP_DOWN)[number];
  readonly tests: readonly Test[];
}

/** The plan's tests under their level, the widest level first; a level with none is left out. */
export function testsByLevel(tests: readonly Test[]): LevelTests[] {
  return LEVELS_TOP_DOWN.map((level) => ({
    level,
    tests: tests.filter((t) => t.level === level),
  })).filter((l) => l.tests.length > 0);
}

export interface OperationRow {
  readonly op: OperationNode;
  readonly fields: number;
  readonly subgraphs: string[];
  readonly teams: string[];
  readonly cached: string;
}

const TRIGGER: Readonly<Record<string, string>> = {
  load: 'page load',
  click: 'click',
  scroll: 'scroll',
  submit: 'submit',
  interval: 'timer',
};

/** When the front end sends an operation, in words. */
export const triggerWord = (op: OperationNode): string =>
  op.trigger === undefined ? '' : (TRIGGER[op.trigger] ?? op.trigger);

/** Where an operation's answer can be kept, in a few words. */
function cacheWord(model: Model, id: string, show: Show): string {
  const sum = model.planSummary(id, graphOf(show));
  if (sum === null) return '';
  if (!sum.cacheable) return 'not cached';
  return `${sum.scope === 'private' ? 'private, ' : ''}${String(sum.maxAge)} s`;
}

/** What one operation reaches: how many fields it asks for, which subgraphs answer and whose they are. */
export function operationRow(model: Model, op: OperationNode, show: Show): OperationRow {
  const plan = model.queryPlan(op.id, graphOf(show));
  const teams = uniq([plan.gatewayTeam, ...plan.teams].filter((t) => t !== null));
  return {
    op,
    fields: plan.selected.filter((s) => s.addedByRouter === null).length,
    subgraphs: uniq(plan.fetches.map((f) => f.subgraph)),
    teams,
    cached: cacheWord(model, op.id, show),
  };
}

/** Operations of the mode, under the screen that sends them. */
export function operationsByScreen(
  model: Model,
  show: Show,
): { screen: string; rows: OperationRow[] }[] {
  const ops = poolOf(model.asIs.operations, model.toBe.operations, show);
  const by = groupBy(ops, (o) => (o.screens?.[0] ?? '').split('#')[0] ?? '');
  return [...by].map(([screen, list]) => ({
    screen,
    rows: list.map((op) => operationRow(model, op, show)),
  }));
}

export interface WorkGroup {
  readonly milestone: Milestone | null;
  readonly items: readonly WorkItem[];
}

/** Work items in build order under their milestones; items with no milestone come last. */
export function workByMilestone(model: Model): WorkGroup[] {
  const items = workOrdered(model);
  const milestones = model.plan.milestones ?? [];
  const known = new Set(milestones.map((m) => m.id));
  const groups: WorkGroup[] = [
    ...milestones.map((milestone) => ({
      milestone,
      items: items.filter((w) => w.milestone === milestone.id),
    })),
    {
      milestone: null,
      items: items.filter((w) => w.milestone === undefined || !known.has(w.milestone)),
    },
  ];
  return groups.filter((g) => g.items.length > 0);
}

/** A milestone's name before the " · ": "M1". */
export const milestoneShort = (m: Milestone): string => m.name.split(' · ')[0] ?? m.name;
