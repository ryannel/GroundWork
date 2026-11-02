import {
  candidateOwns,
  claimTouchesCandidate,
  discoveryEvidenceErrors,
} from './discovery-evidence';
import type { DiscoveryCandidate, DiscoveryInput } from './discovery-types';
import type { BehaviourReceipt, ScanDiscovery } from './discovery.generated';

function behaviourClaimErrors(
  receipt: BehaviourReceipt,
  candidate: DiscoveryCandidate | undefined,
  input: DiscoveryInput,
): string[] {
  return receipt.claim_ids.flatMap((id) => {
    const claim = input.interpretation.claims.find((item) => item.id === id);
    if (claim?.kind !== 'action' || candidate === undefined) {
      return [`${id}: explained behaviour needs an entry-local action claim from its run.`];
    }
    const supported = [
      claim.run_id === receipt.run_id,
      claimTouchesCandidate(claim.support, candidate),
      claimTouchesCandidate(claim.entrypoints, candidate),
    ].every(Boolean);
    return supported
      ? []
      : [`${id}: explained behaviour needs an entry-local action claim from its run.`];
  });
}
function behaviourErrors(
  receipt: BehaviourReceipt,
  candidate: DiscoveryCandidate | undefined,
  input: DiscoveryInput,
): string[] {
  const errors = discoveryEvidenceErrors(receipt.inspected, input);
  const local =
    candidate !== undefined &&
    receipt.inspected.length > 0 &&
    receipt.inspected.every((item) => candidateOwns(candidate, item));
  const honestUnexamined =
    receipt.outcome === 'unresolved' &&
    receipt.claim_ids.length === 0 &&
    receipt.inspected.length === 0;
  if (!local && !honestUnexamined) {
    errors.push(`${receipt.candidate_id}: behaviour needs entry-local inspected evidence.`);
  }
  const run = input.interpretation.runs.find((item) => item.id === receipt.run_id);
  if (!run || receipt.inspected.some((item) => !run.input_context_ids.includes(item.context_id))) {
    errors.push(`${receipt.candidate_id}: behaviour evidence was not supplied to its run.`);
  }
  if ((receipt.outcome === 'explained') !== receipt.claim_ids.length > 0) {
    errors.push(`${receipt.candidate_id}: behaviour outcome disagrees with its claims.`);
  }
  errors.push(...behaviourClaimErrors(receipt, candidate, input));
  return errors;
}
export function discoveryBehaviourErrors(document: ScanDiscovery, input: DiscoveryInput): string[] {
  const entries = input.inventory.candidates.filter((item) => item.kind === 'entry');
  const errors = entries.flatMap((candidate) =>
    document.behaviours.filter((item) => item.candidate_id === candidate.id).length === 1
      ? []
      : [`${candidate.id}: entry needs exactly one behaviour receipt.`],
  );
  for (const receipt of document.behaviours) {
    const candidate = entries.find((item) => item.id === receipt.candidate_id);
    if (!candidate) errors.push(`${receipt.candidate_id}: behaviour references an unknown entry.`);
    errors.push(...behaviourErrors(receipt, candidate, input));
  }
  return errors;
}
