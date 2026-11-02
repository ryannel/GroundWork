import {
  candidateOwns,
  claimTouchesCandidate,
  discoveryEvidenceErrors,
  discoveryEvidenceContains,
} from './discovery-evidence';
import type { DiscoveryCandidate, DiscoveryInput } from './discovery-types';
import type { DiscoveredComponent, DiscoveryReceipt, ScanDiscovery } from './discovery.generated';

export const discoveryAreas: readonly DiscoveryReceipt['area'][] = [
  'purpose',
  'actor',
  'action',
  'journey',
  'relationship',
];
function receiptClaimErrors(
  receipt: DiscoveryReceipt,
  candidates: readonly DiscoveryCandidate[],
  input: DiscoveryInput,
): string[] {
  const errors: string[] = [];
  for (const id of receipt.claim_ids) {
    const claim = input.interpretation.claims.find((item) => item.id === id);
    if (claim?.kind !== receipt.area || claim.run_id !== receipt.run_id) {
      errors.push(`${id}: discovery claim has a different kind or run.`);
    }
    if (
      !claim ||
      !candidates.some((candidate) => claimTouchesCandidate(claim.support, candidate))
    ) {
      errors.push(`${id}: discovery claim lacks component-local support.`);
    }
  }
  return errors;
}
function candidateInspectionErrors(
  candidate: DiscoveryCandidate,
  receipt: DiscoveryReceipt,
): string[] {
  if (!receipt.inspected.some((item) => candidateOwns(candidate, item))) {
    return [`${candidate.id}: ${receipt.area} needs candidate-local inspected evidence.`];
  }
  const bases = ['boundary', 'entry', 'implementation'];
  return bases.flatMap((basis) => {
    const expected = candidate.evidence.filter((item) => item.basis === basis);
    const inspected = expected.some((item) =>
      receipt.inspected.some((evidence) => discoveryEvidenceContains(item, evidence)),
    );
    return expected.length > 0 && !inspected
      ? [`${candidate.id}: ${receipt.area} has not inspected ${basis} evidence.`]
      : [];
  });
}
function receiptCandidate(
  candidate: DiscoveryCandidate,
  document: ScanDiscovery,
  component: DiscoveredComponent | undefined,
): DiscoveryCandidate {
  const split = document.candidates.some(
    (item) => item.candidate_id === candidate.id && item.disposition === 'split',
  );
  if (!split || !component) return candidate;
  return {
    ...candidate,
    evidence: candidate.evidence.filter((anchor) =>
      component.evidence.some((evidence) => discoveryEvidenceContains(anchor, evidence)),
    ),
  };
}
function receiptErrors(
  receipt: DiscoveryReceipt,
  document: ScanDiscovery,
  input: DiscoveryInput,
): string[] {
  const errors = discoveryEvidenceErrors(receipt.inspected, input);
  const component = document.components.find((item) => item.id === receipt.component_id);
  const candidates = input.inventory.candidates.filter(
    (item) => component?.candidate_ids.includes(item.id) === true,
  );
  if (!component) errors.push(`${receipt.component_id}: receipt component is missing.`);
  const run = input.interpretation.runs.find((item) => item.id === receipt.run_id);
  if (!run || receipt.inspected.some((item) => !run.input_context_ids.includes(item.context_id))) {
    errors.push(`${receipt.component_id}: inspected evidence was not supplied to the receipt run.`);
  }
  if (
    receipt.inspected.some(
      (item) => !candidates.some((candidate) => candidateOwns(candidate, item)),
    )
  ) {
    errors.push(`${receipt.component_id}: inspected evidence belongs to another scope.`);
  }
  errors.push(
    ...candidates.flatMap((candidate) =>
      candidateInspectionErrors(receiptCandidate(candidate, document, component), receipt),
    ),
  );
  if ((receipt.outcome === 'claims_proposed') !== receipt.claim_ids.length > 0) {
    errors.push(`${receipt.component_id}: receipt outcome disagrees with its claims.`);
  }
  if (new Set(receipt.claim_ids).size !== receipt.claim_ids.length) {
    errors.push(`${receipt.component_id}: receipt claim identities are duplicated.`);
  }
  errors.push(...receiptClaimErrors(receipt, candidates, input));
  return errors;
}
export function discoveryReceiptErrors(document: ScanDiscovery, input: DiscoveryInput): string[] {
  const errors = document.receipts.flatMap((receipt) => receiptErrors(receipt, document, input));
  for (const component of document.components) {
    for (const area of discoveryAreas) {
      if (
        document.receipts.filter((item) => item.component_id === component.id && item.area === area)
          .length !== 1
      ) {
        errors.push(`${component.id}: ${area} needs exactly one discovery receipt.`);
      }
    }
  }
  return errors;
}
