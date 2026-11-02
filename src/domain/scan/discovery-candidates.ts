import {
  candidateOwns,
  discoveryEvidenceErrors,
  discoveryEvidenceContains,
} from './discovery-evidence';
import { dispositionComponents } from './discovery-hosts';
import type { DiscoveryCandidate, DiscoveryInput } from './discovery-types';
import type {
  CandidateDisposition,
  DiscoveredComponent,
  ScanDiscovery,
} from './discovery.generated';

function hasBoundary(candidate: DiscoveryCandidate, component: DiscoveredComponent): boolean {
  return candidate.evidence.some(
    (item) =>
      ['boundary', 'entry'].includes(item.basis) &&
      component.evidence.some((evidence) => discoveryEvidenceContains(item, evidence)),
  );
}
function componentErrors(document: ScanDiscovery, input: DiscoveryInput): string[] {
  return document.components.flatMap((component) => {
    const candidates = input.inventory.candidates.filter((item) =>
      component.candidate_ids.includes(item.id),
    );
    const errors = discoveryEvidenceErrors(component.evidence, input);
    if (candidates.length !== component.candidate_ids.length || candidates.length === 0) {
      errors.push(`${component.id}: component candidate membership is missing or duplicated.`);
    }
    const boundary = candidates.some((candidate) => hasBoundary(candidate, component));
    if (!boundary) errors.push(`${component.id}: source boundary or entry evidence is required.`);
    for (const evidence of component.evidence) {
      if (!candidates.some((candidate) => candidateOwns(candidate, evidence))) {
        errors.push(`${component.id}: component evidence is outside its candidates.`);
      }
    }
    for (const candidate of candidates) {
      const disposition = document.candidates.find((item) => item.candidate_id === candidate.id);
      if (!disposition || !dispositionComponents(disposition).includes(component.id)) {
        errors.push(`${candidate.id}: component membership disagrees with disposition.`);
      }
    }
    return errors;
  });
}
export function discoveryCandidateErrors(document: ScanDiscovery, input: DiscoveryInput): string[] {
  const errors = componentErrors(document, input);
  const ids = document.candidates.map((item) => item.candidate_id);
  const expected = input.inventory.candidates.map((item) => item.id);
  if (
    ids.length !== expected.length ||
    new Set(ids).size !== ids.length ||
    expected.some((id) => !ids.includes(id))
  ) {
    errors.push('Discovery dispositions must cover the exact frozen candidate inventory once.');
  }
  if (new Set(document.components.map((item) => item.id)).size !== document.components.length) {
    errors.push('Discovery component identities are duplicated.');
  }
  for (const disposition of document.candidates) {
    const candidate = input.inventory.candidates.find(
      (item) => item.id === disposition.candidate_id,
    );
    errors.push(...discoveryEvidenceErrors(disposition.evidence, input));
    if (
      [disposition.disposition !== 'unresolved', disposition.evidence.length === 0].every(Boolean)
    ) {
      errors.push(
        `${disposition.candidate_id}: a resolved disposition needs candidate-local evidence.`,
      );
    }
    if (!candidate || disposition.evidence.some((item) => !candidateOwns(candidate, item))) {
      errors.push(`${disposition.candidate_id}: disposition needs candidate-local evidence.`);
    }
    errors.push(...dispositionReferenceErrors(disposition, document));
  }
  return errors;
}

function dispositionReferenceErrors(
  disposition: CandidateDisposition,
  document: ScanDiscovery,
): string[] {
  const assigned = ['component', 'part_of_component', 'split'].includes(disposition.disposition);
  const ids = dispositionComponents(disposition);
  const references = ids.every((id) =>
    document.components.some(
      (item) => item.id === id && item.candidate_ids.includes(disposition.candidate_id),
    ),
  );
  const split = disposition.disposition === 'split';
  const validSplit = split
    ? [ids.length >= 2, disposition.component_id === null].every(Boolean)
    : disposition.component_ids === undefined;
  const assignment = assigned ? ids.length > 0 && references : disposition.component_id === null;
  return [validSplit, new Set(ids).size === ids.length, assignment].every(Boolean)
    ? []
    : [`${disposition.candidate_id}: disposition component reference is inconsistent.`];
}
