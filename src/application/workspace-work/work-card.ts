import { qualifiedOf } from '@/application/plan/ids';
import type {
  BlockReason,
  StandingDates,
  SourceKind,
  WorkStanding,
} from '@/application/plan/work-standing';
import { thingHref } from '@/application/plan-pages-things';
import { programmeHref } from '@/application/workspace-paths';

// One card for every piece of work, ours or a partner's: the same rows, worded for whoever owns it. A projection is
// plain data, already worded, so a server page can hand it to the browser as it is.

export interface TeamVM {
  readonly id: string;
  readonly name: string;
  readonly partner: boolean;
}

export interface WorkCardVM {
  /** The work item's id in its plan (`wi:x`). */
  readonly id: string;
  /** Its id across the workspace (`<plan>/wi:x`). */
  readonly key: string;
  readonly plan: string;
  /** Its page in its plan. */
  readonly href: string;
  readonly title: string;
  readonly team: TeamVM;
  /** "we depend on this" for a partner's item, "<Team> owns" for ours. */
  readonly ownership: string;
  readonly milestone: { readonly id: string; readonly label: string } | null;
  /** Our item's GitHub issue; a partner's item never has one. */
  readonly issue: {
    readonly number: number;
    readonly url: string | null;
    readonly state: 'open' | 'closed' | null;
  } | null;
  readonly commitment: {
    readonly state: string;
    readonly promisedFor: string | null;
    readonly confidence: string | null;
    readonly saidBy: string | null;
  } | null;
  readonly progress: { readonly state: string; readonly at: string } | null;
  readonly dates: StandingDates & {
    /** "14 days after we need" when the promise is later than the need; null otherwise. */
    readonly gapText: string | null;
  };
  readonly lastHeard: {
    readonly at: string;
    readonly by: string | null;
    readonly source: string;
  } | null;
  readonly blockers: readonly {
    readonly id: string;
    readonly label: string;
    readonly href: string;
  }[];
  /** Done: its latest work event says so. */
  readonly done: boolean;
}

/** What a card reads beyond the item's standing: where it lives, and what the plan says of its issue and milestone. */
export interface WorkCardContext {
  readonly workspace: string;
  readonly plan: string;
  /** The programmes a qualified id may name, so it links to the programme rather than to a plan. */
  readonly programmes?: readonly string[];
  readonly milestoneLabel?: string | null;
  readonly issue?: {
    readonly url: string | null;
    readonly state: 'open' | 'closed' | null;
  } | null;
}

const SOURCE_WORDS: Readonly<Record<SourceKind, string>> = {
  meeting: 'meeting',
  'partner-update': 'partner update',
  github: 'GitHub',
  test: 'test',
  scan: 'scan',
  document: 'document',
  note: 'note',
};

/** A source kind in words: "partner update", "GitHub". */
export const sourceWord = (kind: SourceKind | null): string =>
  kind === null ? 'not said' : SOURCE_WORDS[kind];

/** A state in words: `in_progress` is "in progress". */
export const stateWord = (state: string): string => state.replaceAll('_', ' ');

/** How late the promise is against our need, in words; null when it is not later. */
export function gapText(gapDays: number | null): string | null {
  if (gapDays === null || gapDays <= 0) return null;
  return gapDays === 1 ? '1 day after we need' : `${String(gapDays)} days after we need`;
}

/** Who owns the work, in words: a partner's is work we depend on. */
export const ownershipOf = (team: TeamVM): string =>
  team.partner ? 'we depend on this' : `${team.name} owns`;

/** Where a blocker is read: a thing in this plan, a thing in another plan, or the programme that holds it. */
export function blockerHref(id: string, context: WorkCardContext): string {
  const qualified = qualifiedOf(id);
  if (qualified === null) {
    return thingHref({ workspace: context.workspace, slug: context.plan }, id);
  }
  if ((context.programmes ?? []).includes(qualified.scope)) {
    return programmeHref(context.workspace, qualified.scope);
  }
  return thingHref({ workspace: context.workspace, slug: qualified.scope }, qualified.id);
}

function blockerLabel(reason: BlockReason): string {
  switch (reason.kind) {
    case 'question': {
      return `Open question: ${reason.label}`;
    }
    case 'decision': {
      return `Decision not made: ${reason.label}`;
    }
    case 'depends-on':
    case 'after': {
      return `${reason.label} (${reason.state ?? 'stopped'})`;
    }
  }
}

function issueOf(standing: WorkStanding, context: WorkCardContext): WorkCardVM['issue'] {
  const { issue } = standing.item;
  if (standing.team.partner || issue === null) return null;
  return { number: issue, url: context.issue?.url ?? null, state: context.issue?.state ?? null };
}

function commitmentOf({ commitment }: WorkStanding): WorkCardVM['commitment'] {
  if (commitment === null) return null;
  return {
    state: stateWord(commitment.state),
    promisedFor: commitment.promisedFor,
    confidence: commitment.confidence,
    saidBy: commitment.saidBy,
  };
}

/** One work item as a card, from where it stands. */
export function workCardVM(standing: WorkStanding, context: WorkCardContext): WorkCardVM {
  const { item, team, progress, lastHeard, dates } = standing;
  const at = { workspace: context.workspace, slug: context.plan };
  return {
    id: item.id,
    key: `${context.plan}/${item.id}`,
    plan: context.plan,
    href: thingHref(at, item.id),
    title: item.title,
    team: { id: team.id, name: team.name, partner: team.partner },
    ownership: ownershipOf(team),
    milestone:
      item.milestone === null
        ? null
        : { id: item.milestone, label: context.milestoneLabel ?? item.milestone },
    issue: issueOf(standing, context),
    commitment: commitmentOf(standing),
    progress: progress === null ? null : { state: stateWord(progress.state), at: progress.at },
    dates: { ...dates, gapText: gapText(dates.gapDays) },
    lastHeard:
      lastHeard === null
        ? null
        : { at: lastHeard.at, by: lastHeard.by, source: sourceWord(lastHeard.sourceKind) },
    blockers: standing.blockers.map((reason) => ({
      id: reason.id,
      label: blockerLabel(reason),
      href: blockerHref(reason.id, context),
    })),
    done: progress?.state === 'done',
  };
}
