import {
  byNewest,
  type CardsByMilestone,
  eventVM,
  type EventVM,
  firstOrder,
  milestoneVM,
} from './milestones';
import type { TeamVM } from './work-card';
import { type IndexedWork, workDone, type WorkspacePlanIndex } from './workspace-plan-index';

// A partner's page: who to talk to and when we last heard, the milestones still open with what we need and what they
// promised, the evidence they gave, and everything that happened, newest first.

export interface ContactVM {
  readonly name: string;
  readonly role: string | null;
}

export interface LastHeardVM {
  readonly at: string;
  readonly by: string | null;
  readonly source: string;
  readonly about: string;
  readonly href: string;
}

export interface EvidenceVM {
  readonly at: string;
  readonly source: string;
  readonly url: string;
  readonly note: string | null;
  readonly by: string | null;
  readonly about: string;
}

export interface PartnerPageVM {
  readonly team: TeamVM;
  readonly contacts: readonly ContactVM[];
  readonly lastHeard: LastHeardVM | null;
  /** The milestones with work of theirs still to do, soonest needed first; items with no milestone last. */
  readonly milestones: CardsByMilestone;
  readonly evidence: readonly EvidenceVM[];
  readonly history: readonly EventVM[];
}

const planOrder = (index: WorkspacePlanIndex, plan: string): number =>
  index.plans.get(plan)?.order ?? Number.MAX_SAFE_INTEGER;

/** Everything said about the team's work and the milestones it is in. */
function historyOf(index: WorkspacePlanIndex, mine: readonly IndexedWork[]): EventVM[] {
  const subjects = new Set(
    mine.flatMap((w) => [w.key, ...(w.milestone === null ? [] : [w.milestone])]),
  );
  return [...index.plans.values()]
    .flatMap((plan) =>
      plan.events
        .filter((event) => subjects.has(`${plan.slug}/${event.subject}`))
        .map((event) => eventVM(index, plan.slug, event)),
    )
    .toSorted(byNewest);
}

function groupsOf(index: WorkspacePlanIndex, mine: readonly IndexedWork[]): CardsByMilestone {
  const open = mine.filter((w) => !workDone(w));
  const keys = [...new Set(open.map((w) => w.milestone))];
  const groups = keys.map((key) => {
    const items = open.filter((w) => w.milestone === key);
    const first = items[0];
    const milestone =
      key === null || first === undefined
        ? null
        : milestoneVM(index, first.plan, first.standing.item.milestone ?? '', items);
    return { milestone, items, plan: first?.plan ?? '' };
  });
  return groups
    .toSorted((a, b) => {
      if (a.milestone === null || b.milestone === null) return a.milestone === null ? 1 : -1;
      return firstOrder([
        (a.milestone.neededBy ?? '9999').localeCompare(b.milestone.neededBy ?? '9999'),
        planOrder(index, a.plan) - planOrder(index, b.plan),
      ]);
    })
    .map(({ milestone, items }) => ({ milestone, items: items.map((w) => w.card) }));
}

/** A partner's page; null when the workspace has no such team. */
export function partnerPageVM(index: WorkspacePlanIndex, teamId: string): PartnerPageVM | null {
  const team = index.teams.get(teamId);
  if (team === undefined) return null;
  const mine = [...index.work.values()].filter((w) => w.standing.team.id === teamId);
  const history = historyOf(index, mine);
  const newest = history[0];
  return {
    team: { id: team.id, name: team.name, partner: team.partner },
    contacts: team.contacts.map((c) => ({ name: c.name, role: c.role })),
    lastHeard:
      newest === undefined
        ? null
        : {
            at: newest.at,
            by: newest.by,
            source: newest.source,
            about: newest.subjectLabel,
            href: newest.href,
          },
    milestones: groupsOf(index, mine),
    evidence: history.flatMap((event) =>
      event.url === null
        ? []
        : [
            {
              at: event.at,
              source: event.source,
              url: event.url,
              note: event.note,
              by: event.by,
              about: event.subjectLabel,
            },
          ],
    ),
    history,
  };
}
