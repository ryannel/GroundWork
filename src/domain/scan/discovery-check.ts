import { discoveryBehaviourErrors } from './discovery-behaviours';
import { discoveryCandidateErrors } from './discovery-candidates';
import { discoveryHostErrors } from './discovery-hosts';
import { discoveryInventoryErrors } from './discovery-inventory';
import { discoveryReceiptErrors } from './discovery-receipts';
import type { DiscoveryAssessment, DiscoveryInput } from './discovery-types';
import type { ScanDiscovery } from './discovery.generated';
import { interpretationErrors } from './interpretation-check';

export function discoveryErrors(document: ScanDiscovery, input: DiscoveryInput): readonly string[] {
  const { inventory } = input;
  const identity =
    document.repo === inventory.repo &&
    document.commit === inventory.commit &&
    document.analysis_version === inventory.analysis_version;
  const digests =
    document.snapshot_sha256 === inventory.snapshot_sha256 &&
    document.inventory_sha256 === inventory.sha256;
  return [
    ...(identity && digests
      ? []
      : ['Discovery pin, analysis version or inventory digest changed.']),
    ...interpretationErrors(input.interpretation, input.snapshots),
    ...discoveryInventoryErrors(input),
    ...discoveryCandidateErrors(document, input),
    ...discoveryReceiptErrors(document, input),
    ...discoveryBehaviourErrors(document, input),
    ...discoveryHostErrors(document, input),
  ];
}
export function assessDiscovery(
  document: ScanDiscovery | undefined,
  input: DiscoveryInput,
): DiscoveryAssessment {
  if (!document) {
    return {
      status: 'unknown',
      blockers: ['Component discovery has not been assessed.'],
      knowledgeGaps: [],
    };
  }
  const unresolved = [
    ...document.candidates
      .filter((item) => item.disposition === 'unresolved')
      .map((item) => `${item.candidate_id}: unresolved candidate blocks exhaustive discovery.`),
    ...document.behaviours
      .filter((item) => item.outcome === 'unresolved')
      .map(
        (item) => `${item.candidate_id}: unresolved entry behaviour blocks exhaustive discovery.`,
      ),
  ];
  const unanchored = input.inventory.candidates
    .filter((item) => item.evidence.length === 0)
    .map((item) => `${item.id}: candidate source anchor remains unresolved.`);
  const emptyInventory =
    input.inventory.candidates.length === 0
      ? ['Discovery inventory has no candidates; scope coverage cannot be established.']
      : [];
  const blockers = [
    ...discoveryErrors(document, input),
    ...unresolved,
    ...unanchored,
    ...emptyInventory,
    ...(input.interpretation.state === 'complete'
      ? []
      : ['Discovery requires completed best-effort interpretation.']),
  ];
  return {
    status: blockers.length > 0 ? 'blocked' : 'complete',
    blockers,
    knowledgeGaps: [
      ...unresolved,
      ...unanchored,
      ...emptyInventory,
      ...document.receipts
        .filter((item) => item.outcome === 'insufficient_context')
        .map((item) => `${item.component_id}: ${item.area}: ${item.reason}`),
    ],
  };
}
