import { indexOf } from '@/application/model-index';
import { modelCounts } from '@/application/model-map';
import type { WorkspaceCard, WorkspaceLink } from '@/application/workspace-library';
import type { ModelPlan, WorkspaceModel } from '@/domain/workspace-model';
import { plural } from '@/shared/text';

import { entryFlowHref } from './entry-flow-paths';

/** A canonical workspace enters through its recorded entries while the remaining views migrate. */
export function modelWorkspaceCardOf(
  model: WorkspaceModel,
  plans: readonly ModelPlan[],
  link?: WorkspaceLink,
): WorkspaceCard {
  const counts = modelCounts(indexOf(model));
  return {
    id: model.id,
    name: model.name,
    href: entryFlowHref(model.id),
    description: model.description ?? null,
    isPrivate: model.private ?? false,
    isExample: link?.isExample ?? false,
    location: null,
    facts: [
      plural(counts.domains, 'domain'),
      plural(counts.systems, 'system'),
      plural(counts.components, 'component'),
      plural(plans.length, 'plan'),
    ],
    domains: model.domains.map((domain) => ({
      id: domain.id,
      name: domain.name,
      href: entryFlowHref(model.id, { domain: domain.id }),
      systems: plural(domain.systems.length, 'system'),
    })),
    plans: [],
    morePlans: plans.length,
  };
}
