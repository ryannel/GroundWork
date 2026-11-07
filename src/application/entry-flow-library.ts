import type { ModelIndex } from '@/application/model-index';
import { modelCounts } from '@/application/model-map';
import type { PlanRow, PlanStage } from '@/application/plan-list';
import {
  workspaceLocationOf,
  type WorkspaceCard,
  type WorkspaceLink,
} from '@/application/workspace-card';
import type { PlanBrief, PlanGroup } from '@/application/workspace-library-plans';
import { plansHref, workspaceHref } from '@/application/workspace-paths';
import { plural } from '@/shared/text';

const PREVIEW = 6;
const GROUPS: Readonly<Record<PlanStage, readonly [PlanGroup, string]>> = {
  review: ['decide', 'In review'],
  delivery: ['delivery', 'In delivery'],
  approved: ['approved', 'Approved'],
  draft: ['draft', 'Draft'],
  done: ['delivered', 'Delivered'],
};
function brief(row: PlanRow): PlanBrief {
  const [group, groupLabel] = GROUPS[row.stage];
  const unknown = row.progressUnknown ?? 0;
  const progress =
    unknown === 0 ? '' : `; ${plural(unknown, 'item')} without a recorded issue state`;
  const note =
    row.workItems === 0
      ? row.summary
      : `${String(row.done)} of ${plural(row.workItems, 'work item')} recorded closed${progress}`;
  return {
    id: row.id,
    title: row.title,
    href: row.href,
    group,
    groupLabel,
    note,
    late: false,
    done: row.done,
    total: row.workItems,
  };
}
/** The library links to the native workspace and preserves actual domain and plan addresses. */
export function modelWorkspaceCardOf(
  index: ModelIndex,
  plans: readonly PlanRow[],
  link?: WorkspaceLink,
  local = false,
): WorkspaceCard {
  const model = index.model;
  const counts = modelCounts(index);
  const order: readonly PlanStage[] = ['review', 'delivery', 'approved', 'draft', 'done'];
  const shown = plans
    .toSorted((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage))
    .slice(0, PREVIEW);
  return {
    id: model.id,
    name: model.name,
    href: workspaceHref(model.id),
    plansHref: plansHref(model.id),
    description: model.description ?? null,
    isPrivate: model.private ?? false,
    isExample: link?.isExample ?? false,
    location: workspaceLocationOf(link, local),
    facts: [
      plural(counts.domains, 'domain'),
      plural(counts.systems, 'system'),
      plural(counts.components, 'component'),
      plural(plans.length, 'plan'),
    ],
    domains: model.domains.map((domain) => ({
      id: domain.id,
      name: domain.name,
      href: index.href(domain.id),
      systems: plural(domain.systems.length, 'system'),
    })),
    plans: shown.map(brief),
    morePlans: Math.max(0, plans.length - shown.length),
  };
}
