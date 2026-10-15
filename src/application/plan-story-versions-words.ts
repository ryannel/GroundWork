import type { RevisionEntry } from '@/application/plan/revision-ledger';
import type { Revision, RevisionStep } from '@/application/plan/revision-types';
import { andList } from '@/application/plan-viz-ladder-order';

// The words of the Versions chapter: the ledger's three (proposed, approved, rejected), dates, and who decided.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/** "2026-10-02" → "2 Oct 2026"; without the year "2 Oct". Anything else is left as it is. */
export function dayText(date: string | null | undefined, withYear = true): string {
  const found = DAY.exec(date ?? '');
  const month = MONTHS[Number(found?.[2]) - 1];
  if (found === null || month === undefined) return date ?? '';
  const day = `${String(Number(found[3]))} ${month}`;
  return withYear ? `${day} ${found[1] ?? ''}` : day;
}

/** The GitHub handle of whoever merged or closed the pull request, with its @. */
function handleOf(value: string | undefined): string {
  if (value === undefined || value === '') return '';
  return value.startsWith('@') || value.startsWith('team:') ? value : `@${value}`;
}

const prText = (n: number | undefined): string =>
  n === undefined ? 'the pull request' : `pull request #${String(n)}`;

/**
 * How a revision was decided, in one clause (approval is the owner's merge, never a sign-off across teams):
 * "Approved when @dana merged pull request #54"; empty while it is proposed.
 */
export function decidedText(r: RevisionEntry): string {
  if (r.status === 'approved') {
    const who = handleOf(r.approved_by);
    return who === '' ? 'Approved' : `Approved when ${who} merged ${prText(r.approval_pr ?? r.pr)}`;
  }
  if (r.status === 'rejected') {
    const who = handleOf(r.rejected_by);
    return who === '' ? 'Rejected' : `Rejected when ${who} closed ${prText(r.pr ?? r.approval_pr)}`;
  }
  return '';
}

/** The day a revision was decided, else the day it was proposed. */
export function whenOf(r: RevisionEntry): string {
  if (r.status === 'approved') return r.approved_on ?? r.date;
  if (r.status === 'rejected') return r.rejected_on ?? r.date;
  return r.date;
}

export type RevisionLook = 'proposed' | 'rejected' | 'in-force' | 'superseded';

/** The look of a revision's status badge: the approved one in force is green, an older one is quiet. */
export function statusLook(
  rv: Pick<Revision, 'approved'>,
  r: RevisionEntry,
): { look: RevisionLook; word: string } {
  if (r.status === 'proposed' || r.status === 'rejected') return { look: r.status, word: r.status };
  const inForce = r.version === rv.approved?.version;
  return { look: inForce ? 'in-force' : 'superseded', word: 'approved' };
}

/** Tense: a live proposal speaks in the present, an approved one in the past, a rejected one in the conditional. */
export interface Tense {
  readonly live: boolean;
  readonly gone: boolean;
  readonly t: (now: string, past: string, would: string) => string;
}

export function tenseOf(status: string | undefined): Tense {
  const live = status === 'proposed';
  const gone = status === 'rejected';
  const pick = (now: string, past: string, would: string): string => {
    if (live) return now;
    return gone ? would : past;
  };
  return { live, gone, t: pick };
}

export const plural = (n: number, one: string, many = `${one}s`): string =>
  `${String(n)} ${n === 1 ? one : many}`;

/** Markdown the plan writes into a sentence, as plain text. */
export function unmark(text: string | null | undefined): string {
  return (text ?? '').replaceAll(/\*{1,2}([^*]+)\*{1,2}/g, '$1').replaceAll(/`([^`]+)`/g, '$1');
}

/** The newest approved revision that was proposed on this one. */
const replacedIn = (rv: Revision, version: string): RevisionStep | undefined =>
  rv.steps.find((x) => x.base === version && x.entry.status === 'approved');

const laterText = (later: RevisionStep | undefined): string =>
  later === undefined ? '' : ` ${later.version} replaced it.`;

function approvedStand(rv: Revision, st: RevisionStep): string {
  const later = replacedIn(rv, st.version);
  if (st.base === null) return `The first approved version.${laterText(later)}`;
  if (later !== undefined) return `It replaced ${st.base}. ${later.version} later replaced it.`;
  const now = rv.approved?.version === st.version ? ' It is the version teams build from.' : '';
  return `It replaced ${st.base}.${now}`;
}

/** One plain line on where a revision stands. */
export function standText(rv: Revision, st: RevisionStep): string {
  const status = st.entry.status;
  if (status === 'proposed') {
    const base = st.base ?? rv.approved?.version ?? 'the approved plan';
    return `Not approved yet. Until it is, teams build from ${base}.`;
  }
  if (status === 'rejected') return `The plan stayed at ${st.base ?? 'the approved version'}.`;
  return approvedStand(rv, st);
}

const TELL: Readonly<Record<string, string>> = {
  rework: 'its done work is reopened',
  changes: 'its open work changes',
  drop: 'its work is dropped',
  new: 'it gets new work',
  edge: 'it would depend on another team',
};

/** Why a team is told first, every reason: "its done work is reopened and it gets new work". */
export const tellWhy = (whys: readonly string[]): string =>
  andList(whys.flatMap((w) => TELL[w] ?? []));
