import type { Model } from '@/application/plan/derive';
import { tie } from '@/application/plan/derive-values';
import {
  COL_GAP,
  NODE_H,
  NODE_W,
  type Frame,
  type Grid,
  orthogonal,
} from '@/application/plan-viz-dag-layout';
import { milestoneById, workList } from '@/application/plan-viz-work';
import type { WorkItem } from '@/domain/plan/plan.generated';

export interface DagEdge {
  readonly key: string;
  readonly path: string;
  readonly kind: 'critical' | 'violation' | 'plain';
  readonly title: string;
}

const labelOf = (model: Model, id: string): string =>
  workList(model).find((w) => w.id === id)?.title ?? model.label(id);

const LANE_SPAN = COL_GAP - 10;
const LANE_MAX = 6;
const NUDGE = 10;
const BEFORE = 5;
const Z = { critical: 2, violation: 1, plain: 0 } as const;

interface Link {
  readonly from: string;
  readonly to: string;
  readonly key: string;
}

/** Each edge gets its own vertical lane in the gap before its target column, the critical one nearest the target. */
function lanes(
  links: readonly Link[],
  at: { readonly grid: Grid; readonly frame: Frame; readonly hot: ReadonlySet<string> },
) {
  const { grid, frame, hot } = at;
  const lane = new Map<string, number>();
  const byCol = Map.groupBy(links, (e) => grid.col.get(e.to) ?? 0);
  for (const list of byCol.values()) {
    const ordered = list.toSorted((a, b) =>
      tie(
        Number(hot.has(b.key)) - Number(hot.has(a.key)),
        frame.y(a.from) - frame.y(b.from),
        frame.y(a.to) - frame.y(b.to),
      ),
    );
    const step = Math.min(LANE_MAX, LANE_SPAN / Math.max(1, ordered.length - 1));
    for (const [i, e] of ordered.entries()) lane.set(e.key, i * step);
  }
  return lane;
}

function linksOf(items: readonly WorkItem[]): Link[] {
  const known = new Set(items.map((w) => w.id));
  return items.flatMap((w) =>
    (w.depends_on ?? [])
      .filter((d) => known.has(d))
      .map((d) => ({ from: d, to: w.id, key: `${d}>${w.id}` })),
  );
}

function kindOf(key: string, hot: ReadonlySet<string>, bad: ReadonlySet<string>): DagEdge['kind'] {
  if (hot.has(key)) return 'critical';
  return bad.has(key) ? 'violation' : 'plain';
}

/** The arrows between the work items, the critical path's on top and the sequencing problems' beneath it. */
export function edgesOf(
  model: Model,
  at: { readonly items: readonly WorkItem[]; readonly grid: Grid; readonly frame: Frame },
  path: readonly string[],
): DagEdge[] {
  const { items, grid, frame } = at;
  const hot = new Set(path.slice(1).map((id, i) => `${path[i] ?? ''}>${id}`));
  const bad = new Set(model.milestoneViolations().map((v) => `${v.dependsOn}>${v.workItem}`));
  const links = linksOf(items);
  const lane = lanes(links, { grid, frame, hot });
  const leaving = new Set(path.slice(0, -1));
  const entering = new Set(path.slice(1));
  return links
    .map((link) => {
      const kind = kindOf(link.key, hot, bad);
      const plain = kind !== 'critical';
      const x2 = frame.x(link.to);
      const y1 = frame.y(link.from) + NODE_H / 2 + (plain && leaving.has(link.from) ? NUDGE : 0);
      const y2 = frame.y(link.to) + NODE_H / 2 + (plain && entering.has(link.to) ? NUDGE : 0);
      const mid = x2 - BEFORE - (lane.get(link.key) ?? 0);
      return {
        key: link.key,
        kind,
        z: Z[kind],
        path: orthogonal({ x: frame.x(link.from) + NODE_W, y: y1 }, { x: x2 - 2, y: y2 }, mid),
        title: `${labelOf(model, link.to)} depends on ${labelOf(model, link.from)}`,
      };
    })
    .toSorted((a, b) => a.z - b.z)
    .map(({ key, kind, path: d, title }) => ({ key, kind, path: d, title }));
}

export function violationsOf(model: Model): { readonly text: string }[] {
  const name = (id: string | undefined): string => milestoneById(model, id)?.name ?? id ?? '';
  return model.milestoneViolations().map((v) => ({
    text: `${labelOf(model, v.workItem)} (${name(v.milestone)}) depends on ${labelOf(model, v.dependsOn)} (${name(v.dependsOnMilestone)}).`,
  }));
}
