import type { Model } from '@/application/plan/derive';
import { ledgerOf, type RevisionEntry } from '@/application/plan/revision-ledger';
import { pillText } from '@/application/plan/revision-view';
import { chipInfo, chipName } from '@/application/plan-chips';
import { pageHref, type Outline } from '@/application/plan-pages';
import { versionKey } from '@/application/plan-pages-screens-versions';
import { planStage, type Stage } from '@/application/plan-story-cover-standing';
import { shortDate } from '@/application/plan-viz-state';
import { plainTitle } from '@/shared/plain-text';

// What the plan's top bar says about the plan: where it stands, which teams it can be read as, and its versions.

export type StageTone = 'neutral' | 'accent' | 'added' | 'modified';

export interface BarStage {
  readonly word: string;
  readonly tone: StageTone;
}

export interface BarTeam {
  readonly id: string;
  readonly name: string;
}

export interface BarVersion {
  readonly version: string;
  /** proposed, approved (the one in force), superseded or rejected. */
  readonly state: 'proposed' | 'approved' | 'superseded' | 'rejected';
  readonly date: string;
  readonly summary: string;
  readonly href: string;
}

export interface BarVersions {
  /** The pill: "v1.2", or "v1.3 proposed". */
  readonly label: string;
  /** Every revision in the ledger, newest first; empty without one. */
  readonly items: readonly BarVersion[];
  /** The page listing every version, when the plan has a ledger. */
  readonly historyHref: string | null;
}

export interface PlanBar {
  readonly stage: BarStage;
  readonly teams: readonly BarTeam[];
  readonly versions: BarVersions | null;
}

const STAGES: Readonly<Record<Stage, BarStage>> = {
  draft: { word: 'Draft', tone: 'neutral' },
  review: { word: 'In review', tone: 'modified' },
  approved: { word: 'Approved', tone: 'added' },
  'in-delivery': { word: 'In delivery', tone: 'accent' },
  delivered: { word: 'Delivered', tone: 'added' },
};

function stateOf(entry: RevisionEntry, inForce: string | null): BarVersion['state'] {
  if (entry.status !== 'approved') return entry.status;
  return entry.version === inForce ? 'approved' : 'superseded';
}

function versionsOf(model: Model, outline: Outline): BarVersions | null {
  const ledger = ledgerOf(model.plan);
  const own = model.plan.meta.version;
  if (ledger.length === 0)
    return own === undefined ? null : { label: `v${own}`, items: [], historyHref: null };
  const inForce = ledger.findLast((r) => r.status === 'approved')?.version ?? null;
  const label = (id: string): string => chipName(chipInfo(model, id));
  const items = ledger.toReversed().map((entry): BarVersion => ({
    version: entry.version,
    state: stateOf(entry, inForce),
    date: shortDate((entry.status === 'approved' ? entry.approved_on : undefined) ?? entry.date),
    summary: plainTitle(entry.summary, label),
    href: pageHref(outline, 'versions', versionKey(entry.version)),
  }));
  return {
    label: `v${pillText(model.plan)}`,
    items,
    historyHref: pageHref(outline, 'versions', 'history'),
  };
}

/** The plan's stage, teams and versions, as the top bar shows them. */
export function planBarOf(model: Model, outline: Outline): PlanBar {
  return {
    stage: STAGES[planStage(model)],
    teams: model.plan.teams.map((t) => ({ id: t.id, name: t.name })),
    versions: versionsOf(model, outline),
  };
}
