import type { Model } from '@/application/plan/derive';
import { chipInfo } from '@/application/plan-chips';
import { LEVEL_WORD } from '@/application/plan-risk-words';
import { teamName } from '@/application/plan-viz-teams';
import { plainLine } from '@/application/plan-viz-text';
import type { Level3, Risk } from '@/domain/plan/plan.generated';

// Risks, read once: how likely and how bad, how it is being handled, and which cell of the grid it sits in.

const LEVELS: readonly Level3[] = ['low', 'med', 'high'];

const levelAt = (level: Level3 | undefined): number => Math.max(0, LEVELS.indexOf(level ?? 'low'));
const word = (level: Level3 | undefined): string => (level === undefined ? '' : LEVEL_WORD[level]);

export const isResolved = (r: Risk): boolean => r.roam === 'resolved';
export const statementOf = (r: Risk): string => plainLine(r.statement);
export const numberOfRisk = (model: Model, r: Risk): string => chipInfo(model, r.id).number;

/** 1 (low × low) to 9 (high × high). A level the plan leaves out counts as low. */
export const sev = (r: Risk): number => (levelAt(r.likelihood) + 1) * (levelAt(r.impact) + 1);

/** "medium × high". */
export const levelsText = (r: Risk): string => `${word(r.likelihood)} × ${word(r.impact)}`;

/** The shade of a cell, 1 to 4 by severity. */
export function shade(severity: number): number {
  if (severity >= 9) return 4;
  if (severity >= 6) return 3;
  return severity >= 3 ? 2 : 1;
}

/**
 * Handling, as the plan's ROAM word. A risk with none named is owned: someone has to be on it. A risk accepted with a
 * decision that is not accepted yet is only accepted once that decision is: "accepted if D6 is approved".
 */
export function handlingOf(model: Model, r: Risk): string {
  const handling = r.roam ?? 'owned';
  if (handling !== 'accepted' || r.accepted_by === undefined) return handling;
  const decision = model.plan.decisions?.find((d) => d.id === r.accepted_by);
  if (decision?.status !== 'proposed') return handling;
  const number = chipInfo(model, decision.id).number;
  return `accepted if ${number === '' ? 'its decision' : number} is approved`;
}

/** The fact line, plain text: "R2|medium x high|owned|Fulfilment". Tests prove a dot and its row agree by it. */
export function riskFacts(model: Model, r: Risk): string {
  const owner = r.owner === undefined ? '' : teamName(model, r.owner);
  return [
    numberOfRisk(model, r),
    `${word(r.likelihood)} x ${word(r.impact)}`,
    handlingOf(model, r),
    owner,
  ].join('|');
}

/** Biggest first; a tie keeps the plan's order. */
export const bySeverity = (risks: readonly Risk[]): Risk[] =>
  risks.toSorted((a, b) => sev(b) - sev(a));

/** The risks behind a list of ids, in the order given; an id that is not a risk is left out. */
export function risksOf(model: Model, ids: readonly string[]): Risk[] {
  return ids.flatMap((id) => model.plan.risks?.filter((r) => r.id === id) ?? []);
}

export interface GridCell {
  readonly likelihood: Level3;
  readonly impact: Level3;
  readonly shade: number;
  readonly risks: readonly Risk[];
}

/** The 3 × 3 grid, top row the likeliest, left column the mildest. */
export function riskGrid(risks: readonly Risk[]): GridCell[][] {
  return [2, 1, 0].map((li) =>
    [0, 1, 2].map((im) => ({
      likelihood: LEVELS[li] ?? 'low',
      impact: LEVELS[im] ?? 'low',
      shade: shade((li + 1) * (im + 1)),
      risks: risks.filter((r) => levelAt(r.likelihood) === li && levelAt(r.impact) === im),
    })),
  );
}
