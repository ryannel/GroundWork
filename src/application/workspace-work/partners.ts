import { gapDays } from '@/application/plan/work-standing';
import { partnerHref } from '@/application/workspace-paths';

import { partnerPageVM } from './partner-page';
import { isHeldUp, workDone, type WorkspacePlanIndex } from './workspace-plan-index';

// Every partner of a workspace as one row: the systems they own, how much of our plans' work is theirs, and when we
// last heard from them. A partner is a team marked `partner: true`; its code we cannot read.

/** A system a team owns, as the workspace names it. */
export interface OwnedSystem {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  /** Its owning team, by id; null when no one is named. */
  readonly team: string | null;
}

export interface PartnerRowVM {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly systems: readonly Omit<OwnedSystem, 'team'>[];
  readonly work: {
    readonly total: number;
    readonly open: number;
    readonly blocked: number;
    /** The plans their work is in. */
    readonly plans: number;
  };
  readonly lastHeard: { readonly at: string; readonly age: string } | null;
}

// Each unit starts at two of it: 1 day is "yesterday", and 7 to 13 days read better as days.
const counted = (n: number, units: string): string => `${String(n)} ${units} ago`;

/** How long ago a day was, in words: "today", "yesterday", "5 days ago", "3 weeks ago", "4 months ago". */
export function ageText(at: string, today: string): string {
  const days = gapDays(today.slice(0, 10), at.slice(0, 10));
  if (days === null) return '';
  if (days < 0) return 'ahead of today';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return counted(days, 'days');
  if (days < 60) return counted(Math.floor(days / 7), 'weeks');
  return counted(Math.floor(days / 30), 'months');
}

/** The workspace's partners, by name, each with its systems, its work across plans and when we last heard. */
export function partnersVM(
  index: WorkspacePlanIndex,
  systems: readonly OwnedSystem[],
  today: string,
): PartnerRowVM[] {
  return [...index.teams.values()]
    .filter((team) => team.partner)
    .map((team) => {
      const work = [...index.work.values()].filter((w) => w.standing.team.id === team.id);
      const open = work.filter((w) => !workDone(w));
      const heard = partnerPageVM(index, team.id)?.lastHeard ?? null;
      return {
        id: team.id,
        name: team.name,
        href: partnerHref(index.workspace, team.id),
        systems: systems
          .filter((s) => s.team === team.id)
          .map((s) => ({ id: s.id, name: s.name, href: s.href })),
        work: {
          total: work.length,
          open: open.length,
          blocked: open.filter((w) => isHeldUp(w)).length,
          plans: new Set(work.map((w) => w.plan)).size,
        },
        lastHeard: heard === null ? null : { at: heard.at, age: ageText(heard.at, today) },
      };
    })
    .toSorted((a, b) => a.name.localeCompare(b.name));
}
