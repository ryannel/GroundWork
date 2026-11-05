import type { Model } from '@/application/plan/derive';
import type { WorkStanding } from '@/application/plan/work-standing';
import type { PlanAddress } from '@/application/plan-pages';
import { issueUrl } from '@/application/plan-viz-work';
import { workCardVM, type WorkCardVM } from '@/application/workspace-work/work-card';
import type { WorkItem } from '@/domain/plan/plan.generated';

// A plan's own work as cards, from its model: where each item stands (the store sends it with plan.json), its
// GitHub issue and its milestone. A model read without a progress record still gets a card, with nothing heard.

function bareStanding(model: Model, w: WorkItem): WorkStanding {
  return {
    item: {
      id: w.id,
      title: w.title,
      milestone: w.milestone ?? null,
      issue: w.github_issue ?? null,
    },
    team: { id: w.team, name: model.label(w.team), partner: false },
    commitment: null,
    progress: null,
    lastHeard: null,
    dates: { neededBy: w.needed_by ?? null, promisedFor: null, gapDays: null },
    blockers: [],
  };
}

const issueState = (state: string | undefined): 'open' | 'closed' | null => {
  if (state === undefined) return null;
  return state === 'closed' ? 'closed' : 'open';
};

/** One work item of the plan as a card; null when the plan has no such item. */
export function workCardOf(model: Model, at: PlanAddress, id: string): WorkCardVM | null {
  const w = (model.plan.work_items ?? []).find((each) => each.id === id);
  if (w === undefined) return null;
  const standing =
    model.standing.work.find((each) => each.item.id === id) ?? bareStanding(model, w);
  const status = model.statusOf(id);
  const { programme } = model.plan.meta;
  return workCardVM(standing, {
    workspace: at.workspace,
    plan: at.slug,
    programmes: programme === undefined ? [] : [programme],
    milestoneLabel: w.milestone === undefined ? null : model.label(w.milestone),
    issue: { url: issueUrl(model, w), state: issueState(status?.state) },
  });
}

/** The teams of the plan that are partners: their work is recorded, not filed as our GitHub issues. */
export function partnerTeamsOf(model: Model): ReadonlySet<string> {
  return new Set(
    [...model.standing.work.map((w) => w.team), ...model.standing.teams.map((t) => t.team)]
      .filter((team) => team.partner)
      .map((team) => team.id),
  );
}
