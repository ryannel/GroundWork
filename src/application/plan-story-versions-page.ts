import type { Model } from '@/application/plan/derive';
import { prop, strings } from '@/application/plan/ids';
import type { Revision, RevisionStep } from '@/application/plan/revision-types';
import type { VersionsData } from '@/application/plan-story-versions-data';
import { byText } from '@/application/plan-story-versions-history';
import {
  dayText,
  decidedText,
  plural,
  type RevisionLook,
  standText,
  statusLook,
  whenOf,
} from '@/application/plan-story-versions-words';

// One version's page: its head, and the prose a reader goes through.

export interface SinceLine {
  readonly version: string;
  readonly text: string;
}

export type Prose =
  | { readonly key: 'text'; readonly title: string; readonly text: string; readonly faint: boolean }
  | {
      readonly key: 'goals';
      readonly title: string;
      readonly summary: string;
      readonly goals: readonly string[];
      readonly counts: string;
    }
  | { readonly key: 'since'; readonly title: string; readonly lines: readonly SinceLine[] }
  | { readonly key: 'missing'; readonly text: string };

export interface VersionHead {
  readonly look: RevisionLook;
  readonly word: string;
  /** Who, when and where (markdown-lite). */
  readonly meta: string;
  readonly headline: string;
  readonly lede: string;
}

const capital = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
const lower = (text: string): string => `${text.charAt(0).toLowerCase()}${text.slice(1)}`;

function headlineOf(st: RevisionStep): string {
  const summary = (st.entry.summary ?? '').replaceAll(/\s+/gu, ' ').trim();
  return summary === '' ? `Version ${st.version}` : summary;
}

export function headOf(model: Model, rv: Revision, st: RevisionStep): VersionHead {
  const r = st.entry;
  const decided = decidedText(r);
  const when = whenOf(r);
  const on = when === '' ? '' : ` on ${dayText(when)}`;
  const by = r.by ?? [];
  const pr = r.pr === undefined ? '' : ` in pull request \`#${String(r.pr)}\``;
  const proposer = by.length > 0 ? ` by ${byText(model, by)}` : '';
  const how = decided === '' ? `proposed${proposer}${on}${pr}` : `${lower(decided)}${on}`;
  return {
    look: statusLook(rv, r).look,
    word: capital(r.status),
    meta: `Version ${st.version}, ${how}`,
    headline: headlineOf(st),
    lede: standText(rv, st),
  };
}

/** Why a version was rejected, or the notes from its approval. */
export function reasonOf(st: RevisionStep): Prose | null {
  const r = st.entry;
  const reason = r.reason ?? '';
  if (r.status === 'rejected') {
    const none = reason === '';
    return {
      key: 'text',
      title: 'Why it was rejected',
      text: none ? 'Nobody recorded why.' : reason,
      faint: none,
    };
  }
  if (r.status === 'approved' && reason !== '') {
    return { key: 'text', title: 'Notes from the approval', text: reason, faint: false };
  }
  return null;
}

const COUNTED = [
  ['changes', 'change'],
  ['work_items', 'work item'],
  ['milestones', 'milestone'],
] as const;

function countsOf(plan: unknown): string {
  return COUNTED.flatMap(([key, one]) => {
    const list = prop(plan, key);
    return Array.isArray(list) && list.length > 0 ? [plural(list.length, one)] : [];
  }).join(' · ');
}

/** The first version's page: what the plan set out to do, and what came after. */
export function firstVersion(data: VersionsData, st: RevisionStep): Prose[] {
  const rv = data.revision;
  const plan = rv.plans.get(st.version);
  if (plan === undefined) return [{ key: 'missing', text: 'There is no saved copy of it.' }];
  const summary = prop(plan.problem, 'summary');
  const goals: Prose = {
    key: 'goals',
    title: 'What it set out to do',
    summary: typeof summary === 'string' ? summary : '',
    goals: strings(prop(plan.problem, 'goals')),
    counts: countsOf(plan),
  };
  if (rv.steps.length < 2) return [goals];
  const lines = rv.steps
    .filter((x) => x.base === st.version)
    .map((x) => ({ version: x.version, text: `was ${x.entry.status}: ${x.entry.summary ?? ''}` }));
  return [goals, { key: 'since', title: 'Since then', lines }];
}
