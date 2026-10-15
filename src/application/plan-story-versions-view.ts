import type { Model } from '@/application/plan/derive';
import type { PlanDiff } from '@/application/plan/plan-diff-core';
import type { Revision, RevisionStep } from '@/application/plan/revision-types';
import { type CheckView, checkViews } from '@/application/plan-story-versions-checks';
import type { VersionsData } from '@/application/plan-story-versions-data';
import type { EditItem } from '@/application/plan-story-versions-edit-item';
import { editItems } from '@/application/plan-story-versions-edits';
import { type JourneyView, journeyView } from '@/application/plan-story-versions-journey';
import {
  firstVersion,
  headOf,
  type Prose,
  reasonOf,
  type VersionHead,
} from '@/application/plan-story-versions-page';
import { nameIn, type Pair, pairOf, type View } from '@/application/plan-story-versions-pair';
import { type TallyItem, tallyItems } from '@/application/plan-story-versions-tally';
import { type TeamsView, teamsView } from '@/application/plan-story-versions-teams';
import { dayText, tellWhy, tenseOf } from '@/application/plan-story-versions-words';
import { andList } from '@/application/plan-viz-ladder-order';

// A version's page: the head, then the sections in the order the reader needs them.

export type Section =
  | Prose
  | { readonly key: 'tally'; readonly title: string; readonly items: readonly TallyItem[] }
  | { readonly key: 'checks'; readonly title: string; readonly checks: readonly CheckView[] }
  | { readonly key: 'journey'; readonly title: string; readonly journey: JourneyView }
  | { readonly key: 'teams'; readonly title: string; readonly teams: TeamsView }
  | { readonly key: 'said'; readonly title: string; readonly lines: readonly string[] }
  | { readonly key: 'edits'; readonly title: string; readonly items: readonly EditItem[] };

export interface VersionView {
  readonly head: VersionHead;
  readonly sections: readonly Section[];
}

/** Ids a diff touches, to find earlier versions about the same things. */
function touched(d: PlanDiff | null): Set<string> {
  if (d === null) return new Set();
  return new Set([
    ...d.ops.map((o) => o.change),
    ...Object.values(d.entities).flatMap((e) => [
      ...e.added,
      ...e.removed,
      ...e.changed.map((c) => c.id),
    ]),
    ...d.workItems.added,
    ...d.workItems.removed,
  ]);
}

/** Rejected versions on the same base about the same things, so a reviewer sees what was already said. */
function saidBefore(rv: Revision, st: RevisionStep, pair: Pair): Section[] {
  const mine = touched(pair.diff);
  const lines = rv.steps
    .filter((x) => x.version !== st.version && x.entry.status === 'rejected' && x.base === st.base)
    .filter((x) => [...touched(rv.diffOf(x.version))].some((id) => mine.has(id)))
    .map((x) => {
      const on = x.entry.rejected_on === undefined ? '' : ` on ${dayText(x.entry.rejected_on)}`;
      const reason = (x.entry.reason ?? '') === '' ? 'nobody recorded why' : (x.entry.reason ?? '');
      return `**${x.version} was rejected**${on}: ${reason}`;
    });
  return lines.length === 0 ? [] : [{ key: 'said', title: 'Said before', lines }];
}

function decideText({ pair }: View, st: RevisionStep): string {
  const pr = pair.entry.pr;
  const merge =
    pr === undefined ? 'the pull request that proposes it' : `pull request \`#${String(pr)}\``;
  const told = pair.im.tell.map((x) => `${nameIn(pair, x.team)} (${tellWhy(x.whys)})`);
  const tell = told.length > 0 ? ` Tell ${andList(told)} first.` : " No other team's work changes.";
  return `Merging ${merge} approves ${st.version}, and whoever merges answers for it.${tell} To reject it, close the pull request and say why there. ${pair.fromVersion} stays as it is.`;
}

function whyProse(view: View): Prose[] {
  const { tense, pair } = view;
  const why = pair.entry.why ?? '';
  const title = tense.t('Why', 'Why it was proposed', 'Why it was proposed');
  if (why !== '') return [{ key: 'text', title, text: why, faint: false }];
  if (!tense.live) return [];
  const text = "The proposal doesn't say why. Ask for the reasoning in the pull request.";
  return [{ key: 'text', title: 'Why', text, faint: true }];
}

/** The sections that read the same for every status: what changes, the flows, the work. */
function changeSections(view: View): {
  tally: Section;
  journey: Section;
  work: Section;
  edits: Section;
} {
  const { pair, tense } = view;
  const { t } = tense;
  const items = editItems(view);
  return {
    tally: {
      key: 'tally',
      title: t('What it changes', 'What it changed', 'What it would have changed'),
      items: tallyItems(pair.im, tense),
    },
    journey: {
      key: 'journey',
      title: t('Flows that change', 'Flows that changed', 'Flows that would have changed'),
      journey: journeyView(view),
    },
    work: {
      key: 'teams',
      title: t('Work and teams', 'Work it touched', 'Work it would have touched'),
      teams: teamsView(view),
    },
    edits: { key: 'edits', title: `All edits (${String(items.length)})`, items },
  };
}

function checksSection(view: View): Section[] {
  if (!view.tense.live) return [];
  const checks = checkViews(view.pair, view.tense);
  const count = checks.length > 0 ? ` (${String(checks.length)})` : '';
  return [{ key: 'checks', title: `Check before deciding${count}`, checks }];
}

function pairSections(view: View, data: VersionsData, st: RevisionStep): Section[] {
  const s = changeSections(view);
  const reason = reasonOf(st);
  const rejection = reason !== null && st.entry.status === 'rejected' ? [reason] : [];
  if (view.tense.gone)
    return [...rejection, ...whyProse(view), s.tally, s.journey, s.work, s.edits];
  const notes = reason === null ? [] : [reason];
  const decide: Section[] = view.tense.live
    ? [{ key: 'text', title: 'Decide', text: decideText(view, st), faint: false }]
    : [];
  return [
    ...whyProse(view),
    ...notes,
    s.tally,
    s.journey,
    ...checksSection(view),
    s.work,
    ...saidBefore(data.revision, st, view.pair),
    ...decide,
    s.edits,
  ];
}

/** A version's page. */
export function versionView(model: Model, data: VersionsData, st: RevisionStep): VersionView {
  const rv = data.revision;
  const head = headOf(model, rv, st);
  const reason = reasonOf(st);
  const lead = reason === null ? [] : [reason];
  if (st.base === null) return { head, sections: [...lead, ...firstVersion(data, st)] };
  const pair = pairOf(rv, st, data.delivery);
  if (pair === null) {
    const copy = st.available ? st.base : st.version;
    const text = `There is no saved copy of ${copy}, so the changes can't be shown.`;
    return { head, sections: [...lead, { key: 'missing', text }] };
  }
  return {
    head,
    sections: pairSections({ model, pair, tense: tenseOf(st.entry.status) }, data, st),
  };
}
