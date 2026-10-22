// A domain's target architecture lives in domains/<domain>/target.yaml: where the domain is heading, as a flow of
// the things the business makes, each with the systems that should own it, and the shifts from today towards it.
// People write it; the scan never does. Its ids point into today's model, so it is checked against it.

import type { Model } from '@/application/plan/derive';
import { chipRefOf, type ChipRef } from '@/application/today-scope';
import type { SystemModel } from '@/application/workspace-model';
import type { KeyTerms, TargetArchitecture } from '@/domain/workspace-model';

const CITED = /\[\[([\w:#.-]+)\]\]/gu;

const citedIn = (text: string | null): string[] =>
  text === null ? [] : [...text.matchAll(CITED)].flatMap((match) => match[1] ?? []);

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    const again = seen.has(id);
    seen.add(id);
    return again;
  });
}

function warningsOf(
  target: TargetArchitecture,
  model: Model,
  terms: ReadonlySet<string>,
): string[] {
  const at = `domains/${target.domain}/target.yaml`;
  const stages = new Set(target.stages.map((stage) => stage.id));
  const missing = (id: string) => model.get(id) === undefined;
  const stageWarnings = target.stages.flatMap((stage) => [
    ...(stage.term !== null && !terms.has(stage.term)
      ? [`${at}: stage ${stage.id} is ${stage.term}, which is not a key term in language.yaml`]
      : []),
    ...stage.from
      .filter((id) => !stages.has(id))
      .map((id) => `${at}: stage ${stage.id} is made from ${id}, which is not a stage`),
    ...[...stage.owners, ...citedIn(stage.summary)]
      .filter(missing)
      .map((id) => `${at}: stage ${stage.id} names ${id}, which today's model does not have`),
  ]);
  const shiftWarnings = target.shifts.flatMap((shift) =>
    [...shift.cites, ...citedIn(shift.today), ...citedIn(shift.target)]
      .filter(missing)
      .map((id) => `${at}: shift ${shift.id} cites ${id}, which today's model does not have`),
  );
  const twice = [
    ...duplicates(target.stages.map((stage) => stage.id)).map((id) => `stage ${id}`),
    ...duplicates(target.shifts.map((shift) => shift.id)).map((id) => `shift ${id}`),
  ].map((what) => `${at}: ${what} is written twice`);
  const summary = citedIn(target.summary)
    .filter(missing)
    .map((id) => `${at}: the summary cites ${id}, which today's model does not have`);
  return [...twice, ...summary, ...stageWarnings, ...shiftWarnings];
}

/** Stages and shifts that name things today's model does not have, or stages that do not exist. */
export function targetWarnings(
  today: Pick<SystemModel, 'model' | 'targets' | 'keyTerms'>,
): string[] {
  const terms = new Set(today.keyTerms.terms.map((term) => term.id));
  return today.targets.flatMap((target) => warningsOf(target, today.model, terms));
}

export interface TargetStageView {
  readonly id: string;
  readonly name: string;
  /** The agreed word's name, when the stage is a key term. */
  readonly term: string | null;
  readonly summary: string | null;
  readonly owners: readonly ChipRef[];
  /** The names of the stages it is made from. */
  readonly from: readonly string[];
}

export interface TargetShiftView {
  readonly id: string;
  readonly name: string;
  readonly today: string;
  readonly target: string;
  readonly cites: readonly ChipRef[];
}

/** One domain's target, ready to draw: every id named as a chip. */
export interface TargetView {
  readonly summary: string | null;
  readonly stages: readonly TargetStageView[];
  readonly shifts: readonly TargetShiftView[];
  /** A chip for every [[id]] cited in the text. */
  readonly refs: Readonly<Record<string, ChipRef>>;
}

function termNames(keyTerms: KeyTerms): Map<string, string> {
  return new Map(keyTerms.terms.map((term) => [term.id, term.name]));
}

/** A domain's target architecture; null when it has not written one. */
export function targetViewOf(
  today: Pick<SystemModel, 'model' | 'targets' | 'keyTerms'>,
  domain: string,
): TargetView | null {
  const target = today.targets.find((each) => each.domain === domain);
  if (target === undefined) return null;
  const { model } = today;
  const chip = (id: string) => chipRefOf(model, id);
  const names = new Map(target.stages.map((stage) => [stage.id, stage.name]));
  const terms = termNames(today.keyTerms);
  const texts = [
    target.summary,
    ...target.stages.map((stage) => stage.summary),
    ...target.shifts.flatMap((shift) => [shift.today, shift.target]),
  ];
  return {
    summary: target.summary,
    stages: target.stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      term: stage.term === null ? null : (terms.get(stage.term) ?? stage.term),
      summary: stage.summary,
      owners: stage.owners.map(chip),
      from: stage.from.map((id) => names.get(id) ?? id),
    })),
    shifts: target.shifts.map((shift) => ({ ...shift, cites: shift.cites.map(chip) })),
    refs: Object.fromEntries(texts.flatMap(citedIn).map((id) => [id, chip(id)])),
  };
}
