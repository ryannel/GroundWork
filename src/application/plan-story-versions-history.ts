import type { Model } from '@/application/plan/derive';
import type { RevisionEntry } from '@/application/plan/revision-ledger';
import type { Revision } from '@/application/plan/revision-types';
import {
  dayText,
  decidedText,
  type RevisionLook,
  statusLook,
  whenOf,
} from '@/application/plan-story-versions-words';
import { andList } from '@/application/plan-viz-ladder-order';

// The history screen: every version, newest first.

/** One fact about a version: a label in the margin and a sentence (markdown-lite). */
export interface Fact {
  readonly label: string | null;
  readonly text: string;
}

export interface HistoryCard {
  readonly version: string;
  readonly look: RevisionLook;
  readonly word: string;
  readonly summary: string;
  /** For a rejected version: why, or an empty reason when nobody recorded one. */
  readonly rejection: { readonly reason: string } | null;
  readonly facts: readonly Fact[];
  /** What stood before it, for the first version. */
  readonly first: string | null;
}

export interface HistoryView {
  readonly headline: string;
  readonly lede: string;
  readonly cards: readonly HistoryCard[];
}

/** Who proposed a version: a citation for each team the plan has, else the name as written. */
export function byText(model: Model, ids: readonly string[] | undefined): string {
  const names = (ids ?? []).map((id) => (model.get(id) === undefined ? id : `[[${id}]]`));
  return andList(names);
}

/** Who and when: how a decided version was decided and on which day, else who proposed it and when. */
function whoWhen(model: Model, r: RevisionEntry): Fact[] {
  const decided = decidedText(r);
  const when = whenOf(r);
  const day: Fact[] =
    when === '' ? [] : [{ label: decided === '' ? 'Date' : 'On', text: dayText(when) }];
  if (decided !== '') return [{ label: null, text: decided }, ...day];
  const by = r.by ?? [];
  return [
    ...(by.length > 0 ? [{ label: 'Proposed by', text: byText(model, by) }] : []),
    ...day,
    ...(r.pr === undefined ? [] : [{ label: 'Pull request', text: `\`#${String(r.pr)}\`` }]),
  ];
}

const firstOf = (r: RevisionEntry, base: string | null): string | null => {
  if (base !== null) return null;
  return r.status === 'approved' ? 'The first approved version.' : 'Nothing approved before it.';
};

export function historyView(model: Model, rv: Revision): HistoryView {
  const pending = rv.head.status === 'proposed' ? rv.head.version : null;
  const lede = [
    rv.approved === null
      ? 'No version is approved yet.'
      : `Teams build from ${rv.approved.version}, the approved version.`,
    pending === null ? '' : `${pending} is proposed.`,
    'Each version is the whole plan as it stood; open one to see what it changed.',
  ];
  return {
    headline: 'Versions of this plan',
    lede: lede.filter((x) => x !== '').join(' '),
    cards: rv.steps.map((st) => {
      const { look, word } = statusLook(rv, st.entry);
      const rejected = st.entry.status === 'rejected';
      return {
        version: st.version,
        look,
        word,
        summary: st.entry.summary ?? '',
        rejection: rejected ? { reason: st.entry.reason ?? '' } : null,
        facts: whoWhen(model, st.entry),
        first: firstOf(st.entry, st.base),
      };
    }),
  };
}
