import type { DiscoveryCandidate, DiscoveryInput } from './discovery-types';
import type { DiscoveryEvidence } from './discovery.generated';
import { evidenceErrors } from './interpretation-context';
import type { Evidence } from './interpretation.generated';

export function discoveryEvidenceContains(
  left: DiscoveryEvidence,
  right: DiscoveryEvidence,
): boolean {
  if (left.context_id !== right.context_id || left.kind !== right.kind) return false;
  if (left.kind === 'observed_record' && right.kind === 'observed_record') {
    return left.record_id === right.record_id && left.source_id === right.source_id;
  }
  if (left.kind !== 'context_snapshot' || right.kind !== 'context_snapshot') return false;
  return [
    left.path === right.path,
    left.commit === right.commit,
    left.sha256 === right.sha256,
    left.lines[0] <= right.lines[0],
    left.lines[1] >= right.lines[1],
  ].every(Boolean);
}
export function candidateOwns(candidate: DiscoveryCandidate, evidence: DiscoveryEvidence): boolean {
  return candidate.evidence.some((item) => discoveryEvidenceContains(item, evidence));
}
function interpretationEvidence(evidence: DiscoveryEvidence): Evidence {
  return evidence.kind === 'observed_record'
    ? {
        kind: evidence.kind,
        context_id: evidence.context_id,
        record_id: evidence.record_id,
        source_ids: [evidence.source_id],
      }
    : {
        kind: evidence.kind,
        context_id: evidence.context_id,
        locator: evidence.path,
        lines: evidence.lines,
      };
}
export function discoveryEvidenceErrors(
  evidence: readonly DiscoveryEvidence[],
  input: DiscoveryInput,
): string[] {
  return evidence.flatMap((item) =>
    evidenceErrors(interpretationEvidence(item), input.interpretation.contexts, input.snapshots),
  );
}
export function claimTouchesCandidate(
  support: readonly Evidence[],
  candidate: DiscoveryCandidate,
): boolean {
  return support.some((item) =>
    candidate.evidence.some((local) => {
      if (local.context_id !== item.context_id) return false;
      if (item.kind === 'observed_record' && local.kind === 'observed_record') {
        return local.record_id === item.record_id && item.source_ids.includes(local.source_id);
      }
      return (
        item.kind === 'context_snapshot' &&
        local.kind === 'context_snapshot' &&
        item.lines[0] <= local.lines[1] &&
        item.lines[1] >= local.lines[0]
      );
    }),
  );
}
