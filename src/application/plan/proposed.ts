// What a proposed revision puts in the story that the approved version does not have. While a revision is
// proposed and the head is showing, the story reads the head plan; a step, field, screen, region, flow or change
// that differs from the approved version carries a small "new in 1.2" / "works differently in 1.2" mark, so nobody
// reads the proposal as what teams build from. The impact itself is injected (`MarkImpactOf`).

import type { DeliveryState } from '@/application/plan/delivery';
import type { ImpactInput } from '@/application/plan/delivery-work';
import type { Revision } from '@/application/plan/revision-types';

export interface StepImpact {
  readonly id: string;
  readonly mark?: string;
}

export interface JourneyImpact {
  readonly id: string;
  readonly status?: string;
  readonly steps?: readonly StepImpact[];
}

export interface FieldImpact {
  readonly schema: string;
  readonly name: string;
  readonly kind: string;
  readonly cosmetic?: boolean;
}

export interface RegionImpact {
  readonly id: string;
  readonly mark?: string;
}

export interface ScreenImpact {
  readonly id: string;
  readonly mark?: string;
  readonly regions?: readonly RegionImpact[];
}

/** What a revision does to the story: its flows and their steps, its fields, its screens and their regions. */
export interface MarkImpact {
  readonly journeys?: readonly JourneyImpact[];
  readonly fields?: readonly FieldImpact[];
  readonly screens?: readonly ScreenImpact[];
}

export type MarkImpactOf = (input: ImpactInput) => MarkImpact | null;

export interface ProposedMarks {
  readonly version: string;
  readonly base: string;
  /** id → the words for its mark: "new in 1.2", "works differently in 1.2", "removed in 1.2", "changes in 1.2". */
  readonly marks: ReadonlyMap<string, string>;
}

const STEP: Record<string, string> = {
  added: 'new',
  removed: 'removed',
  behaviour: 'works differently',
};
const FIELD: Record<string, string> = { added: 'new', removed: 'removed', edited: 'changes' };
const SHAPE: Record<string, string> = { added: 'new', removed: 'removed' };

/** "new", "removed" or "changes" for an added, removed or otherwise-touched thing. */
const shape = (status: string | undefined): string => SHAPE[status ?? ''] ?? 'changes';

function journeyMarks(
  journeys: readonly JourneyImpact[],
  put: (id: string | undefined, word: string) => void,
): void {
  for (const f of journeys) {
    const moved = (f.steps ?? []).filter((s) => STEP[s.mark ?? ''] !== undefined);
    for (const s of moved) put(s.id, STEP[s.mark ?? ''] ?? 'changes');
    if (f.status !== undefined && (moved.length > 0 || f.status !== 'changed')) {
      put(f.id, shape(f.status));
    }
  }
}

function fieldMarks(
  fields: readonly FieldImpact[],
  put: (id: string | undefined, word: string) => void,
): void {
  for (const d of fields) {
    if (d.cosmetic === true) continue;
    put(`${d.schema}#${d.name}`, FIELD[d.kind] ?? 'changes');
    put(d.schema, 'changes');
  }
}

const shows = (mark: string | undefined): mark is string =>
  mark !== undefined && mark !== '' && mark !== 'data';

function screenMarks(
  screens: readonly ScreenImpact[],
  put: (id: string | undefined, word: string) => void,
): void {
  for (const sc of screens) {
    if (!shows(sc.mark)) continue;
    put(sc.id, shape(sc.mark));
    for (const r of sc.regions ?? []) if (shows(r.mark)) put(r.id, shape(r.mark));
  }
}

const impactFor = (
  revision: Revision,
  delivery: DeliveryState | null,
  impactOf: MarkImpactOf,
): MarkImpact | null => {
  const from = revision.approved?.plan;
  if (!from || !revision.diff) return null;
  const to = revision.head.plan;
  const entry =
    revision.steps.find((st) => st.version === revision.head.version)?.entry ?? revision.head.entry;
  try {
    return impactOf({ from, to, diff: revision.diff, delivery, entry });
  } catch {
    return null;
  }
};

const MEMO = new WeakMap<Revision, Map<string, ProposedMarks>>();

interface MarkOptions {
  readonly impactOf: MarkImpactOf;
  readonly delivery?: DeliveryState | null;
}

/** Every mark a revision puts on the story, first reason winning. */
function marksOf(
  revision: Revision,
  version: string,
  impact: MarkImpact | null,
): Map<string, string> {
  const marks = new Map<string, string>();
  const put = (id: string | undefined, word: string): void => {
    if (id !== undefined && id !== '' && !marks.has(id)) marks.set(id, `${word} in ${version}`);
  };
  journeyMarks(impact?.journeys ?? [], put);
  fieldMarks(impact?.fields ?? [], put);
  screenMarks(impact?.screens ?? [], put);
  for (const o of revision.diff?.ops ?? []) put(o.change, shape(o.status));
  return marks;
}

/**
 * The marks a live proposal puts on the story; null when no revision is proposed, an earlier version is showing,
 * or the approved version was not kept.
 */
export function proposedMarks(revision: Revision, opts: MarkOptions): ProposedMarks | null {
  const approved = revision.approved;
  if (revision.viewing !== 'head' || revision.head.status !== 'proposed' || !approved?.plan) {
    return null;
  }
  const delivery = opts.delivery ?? null;
  const version = String(revision.head.version);
  const key = [version, delivery?.filed, delivery?.done].map(String).join('|');
  const memo = MEMO.get(revision) ?? new Map<string, ProposedMarks>();
  MEMO.set(revision, memo);
  const known = memo.get(key);
  if (known) return known;
  const impact = impactFor(revision, delivery, opts.impactOf);
  const out = { version, base: approved.version, marks: marksOf(revision, version, impact) };
  memo.set(key, out);
  return out;
}

/** The mark's words for one id ("works differently in 1.2"), or null. */
export const proposedMark = (revision: Revision, id: string, opts: MarkOptions): string | null =>
  proposedMarks(revision, opts)?.marks.get(id) ?? null;
