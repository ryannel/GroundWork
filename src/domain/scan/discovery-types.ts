import type { DiscoveryEvidence } from './discovery.generated';
import type { InterpretationSnapshot } from './interpretation-context';
import type { ScanInterpretation } from './interpretation.generated';

export interface DiscoveryCandidate {
  readonly id: string;
  readonly kind: 'boundary' | 'entry' | 'support';
  readonly root: string;
  readonly evidence: readonly (DiscoveryEvidence & {
    readonly basis: 'boundary' | 'entry' | 'implementation' | 'root_name';
  })[];
}
/** A source inventory frozen independently of the interpretation being assessed. */
export interface DiscoveryInventory {
  readonly repo: string;
  readonly commit: string;
  readonly analysis_version: string;
  readonly snapshot_sha256: string;
  readonly sha256: string;
  readonly candidates: readonly DiscoveryCandidate[];
}
export interface DiscoveryInput {
  readonly inventory: DiscoveryInventory;
  readonly interpretation: ScanInterpretation;
  readonly snapshots: readonly InterpretationSnapshot[];
}
export interface DiscoveryAssessment {
  readonly status: 'complete' | 'blocked' | 'unknown';
  readonly blockers: readonly string[];
  readonly knowledgeGaps: readonly string[];
}
