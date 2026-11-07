export type PlanStage = 'draft' | 'review' | 'approved' | 'delivery' | 'done';

export const STAGE_WORDS: Readonly<Record<PlanStage, string>> = {
  draft: 'Draft',
  review: 'In review',
  approved: 'Approved',
  delivery: 'In delivery',
  done: 'Delivered',
};

export interface PlanRow {
  readonly id: string;
  readonly title: string;
  readonly href: string;
  /** The problem in a line or two, as plain words. */
  readonly summary: string;
  readonly stage: PlanStage;
  /** When it was written (YYYY-MM-DD), or null. */
  readonly date: string | null;
  /** The domains it lands in, by id as in the workspace (no `domain:` prefix). */
  readonly domains: readonly string[];
  readonly workItems: number;
  readonly done: number;
  /** Native reads expose work whose GitHub state has not been recorded. */
  readonly progressUnknown?: number;
  /** The programme it joins, by id; null for a plan on its own. */
  readonly programme: string | null;
  /** Whether its check still speaks for it: never checked against today, edited since, or null when it does. */
  readonly check: PlanCheckState;
  readonly previousCheckedOn?: string;
}

export type PlanCheckState = 'never' | 'edited' | 'recheck' | null;

export interface PlanListBase {
  readonly mode: 'live' | 'landed' | 'none';
  readonly checkedOn: string | null;
  readonly previousCheckedOn?: string;
  readonly edited: boolean;
}

/** A plan pages trust is flagged when its check no longer speaks for what it says; a landed plan reads no live today. */
export function checkStateOf(base: PlanListBase | undefined): PlanCheckState {
  if (base?.mode !== 'live') return null;
  if (base.previousCheckedOn !== undefined) return 'recheck';
  if (base.checkedOn === null) return 'never';
  return base.edited ? 'edited' : null;
}
