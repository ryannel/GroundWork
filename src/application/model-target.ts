import { modelChipOf } from '@/application/model-chip';
import { modelDomainOf } from '@/application/model-domain';
import type { ModelIndex } from '@/application/model-index';
import type { TargetView } from '@/application/workspace-target';
import { targetFlowOf } from '@/application/workspace-target-flow';
import { isAuthoredReference } from '@/domain/ids';
import { parseInline, type Inline } from '@/shared/markdown';

function inlineRefs(parts: readonly Inline[]): readonly string[] {
  return parts.flatMap((part) => {
    if (part.kind === 'ref') return [part.id];
    return 'children' in part ? inlineRefs(part.children) : [];
  });
}
/** Target ownership is authored intent. It never changes current component placement or factual ownership. */
export function modelTargetOf(index: ModelIndex, slug: string): TargetView | null {
  const domain = modelDomainOf(index, slug);
  const target = domain?.target;
  if (domain === null || target === undefined || target === null) return null;
  const stages = target.stages ?? [];
  const shifts = target.shifts ?? [];
  const names = new Map(stages.map((stage) => [stage.id, stage.name]));
  const terms = new Map((index.model.language?.terms ?? []).map((term) => [term.id, term.name]));
  const chip = (id: string) => modelChipOf(index, id);
  const texts = [
    target.summary,
    ...stages.map((stage) => stage.summary),
    ...shifts.flatMap((shift) => [shift.today, shift.target]),
  ];
  const references = texts.flatMap((text) =>
    inlineRefs(parseInline(text ?? '', isAuthoredReference)),
  );
  const place = (id: string): string | null => {
    const node = index.get(id);
    if (node?.kind === 'external') return 'Outside the company';
    const home = node?.place.domain;
    return home === undefined || home === null || home === domain.id
      ? null
      : `Lives in ${index.label(home)}`;
  };
  return {
    summary: target.summary ?? null,
    stages: stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      term: stage.term === undefined ? null : (terms.get(stage.term) ?? stage.term),
      summary: stage.summary ?? null,
      owners: (stage.owners ?? []).map(chip),
      from: (stage.from ?? []).map((id) => names.get(id) ?? id),
    })),
    shifts: shifts.map((shift) => ({
      id: shift.id,
      name: shift.name,
      today: shift.today ?? '',
      target: shift.target ?? '',
      cites: (shift.cites ?? []).map(chip),
    })),
    refs: Object.fromEntries(references.map((id) => [id, chip(id)])),
    flow: targetFlowOf(
      stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        from: stage.from ?? [],
        owners: (stage.owners ?? []).map((id) => ({ ...chip(id), place: place(id) })),
      })),
    ),
  };
}
