import type { WorkImpact } from '@/application/plan/impact-work';
import { nameIn, type Pair } from '@/application/plan-story-versions-pair';
import { type Tense, unmark } from '@/application/plan-story-versions-words';
import { revisionTag } from '@/application/plan-viz-work';

// A work item as a revision touches it. These rows come from the revision's own impact, not the plan on show:
// a rejected revision's items may not be in it.

export interface WhyLine {
  /** Who says so, or "inferred" when nobody did. */
  readonly lead: string;
  readonly text: string;
  readonly inferred: boolean;
}

export interface WorkRow {
  readonly id: string;
  readonly title: string;
  readonly teamId: string;
  readonly team: string;
  readonly size: string | null;
  readonly state: WorkImpact['state'];
  readonly effect: WorkImpact['effect'];
  readonly tag: { readonly text: string; readonly why: string; readonly pending: boolean };
  readonly why: WhyLine | null;
}

const capital = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** The proposer's reason for touching the item, else what the plan implies. */
function whyOf(pair: Pair, tense: Tense, w: WorkImpact): WhyLine | null {
  if (w.authored) {
    const who = (pair.entry.by ?? []).map((x) => nameIn(pair, x)).join(', ');
    const says = tense.t('says', 'said', 'said');
    return {
      lead: `${who === '' ? 'The proposal' : who} ${says}:`,
      text: unmark(w.note),
      inferred: false,
    };
  }
  if (w.why.length === 0) return null;
  return { lead: 'inferred', text: `${capital(w.why.join('; '))}.`, inferred: true };
}

function tagWhen(tense: Tense): 0 | 1 | 2 {
  if (tense.live) return 0;
  return tense.gone ? 2 : 1;
}

export function workRowOf(pair: Pair, tense: Tense, w: WorkImpact): WorkRow {
  const tag = revisionTag({
    version: pair.toVersion,
    effect: w.effect,
    authored: w.authored,
    note: w.note,
    when: tagWhen(tense),
  });
  return {
    id: w.id,
    title: unmark(w.title),
    teamId: w.team,
    team: nameIn(pair, w.team),
    size: w.size,
    state: w.state,
    effect: w.effect,
    tag,
    why: whyOf(pair, tense, w),
  };
}

/** The work items that build a step or screen, with what the revision means for each. */
export function builtBy(pair: Pair, tense: Tense, place: string): WorkRow[] {
  const ids = pair.im.byPlace.get(place) ?? [];
  return pair.im.work.filter((w) => ids.includes(w.id)).map((w) => workRowOf(pair, tense, w));
}
