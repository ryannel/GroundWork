/* Generated from schema/scan-discovery.schema.json. Run node tools/scan-discovery-types.ts. */

/**
 * This interface was referenced by `ScanDiscovery`'s JSON-Schema
 * via the `definition` "DiscoveryEvidence".
 */
export type DiscoveryEvidence =
  | {
      kind: 'observed_record';
      context_id: string;
      record_id: string;
      source_id: string;
    }
  | {
      kind: 'context_snapshot';
      context_id: string;
      path: string;
      commit: string;
      sha256: string;
      /**
       * @minItems 2
       * @maxItems 2
       */
      lines: [number, number];
    };

export interface ScanDiscovery {
  format: 'scan-discovery/v1';
  repo: string;
  commit: string;
  analysis_version: string;
  snapshot_sha256: string;
  inventory_sha256: string;
  /**
   * @minItems 0
   */
  candidates: CandidateDisposition[];
  /**
   * @minItems 0
   */
  components: DiscoveredComponent[];
  /**
   * @minItems 0
   */
  receipts: DiscoveryReceipt[];
  /**
   * @minItems 0
   */
  behaviours: BehaviourReceipt[];
  action_hosts?: ActionHost[];
}
/**
 * This interface was referenced by `ScanDiscovery`'s JSON-Schema
 * via the `definition` "CandidateDisposition".
 */
export interface CandidateDisposition {
  candidate_id: string;
  disposition: 'component' | 'part_of_component' | 'non_runtime' | 'unresolved' | 'split';
  component_id: string | null;
  reason: string;
  /**
   * @minItems 0
   */
  evidence: DiscoveryEvidence[];
  /**
   * @minItems 2
   */
  component_ids?: [string, string, ...string[]];
}
/**
 * This interface was referenced by `ScanDiscovery`'s JSON-Schema
 * via the `definition` "DiscoveredComponent".
 */
export interface DiscoveredComponent {
  id: string;
  /**
   * @minItems 1
   */
  candidate_ids: [string, ...string[]];
  boundary: 'source_declared';
  deployment: 'unknown';
  /**
   * @minItems 1
   */
  evidence: [DiscoveryEvidence, ...DiscoveryEvidence[]];
  /**
   * @minItems 1
   */
  source_roots?: [string, ...string[]];
}
/**
 * This interface was referenced by `ScanDiscovery`'s JSON-Schema
 * via the `definition` "DiscoveryReceipt".
 */
export interface DiscoveryReceipt {
  component_id: string;
  area: 'purpose' | 'actor' | 'action' | 'journey' | 'relationship';
  run_id: string;
  outcome: 'claims_proposed' | 'insufficient_context' | 'not_applicable';
  /**
   * @minItems 0
   */
  claim_ids: string[];
  reason: string;
  /**
   * @minItems 1
   */
  inspected: [DiscoveryEvidence, ...DiscoveryEvidence[]];
}
/**
 * This interface was referenced by `ScanDiscovery`'s JSON-Schema
 * via the `definition` "BehaviourReceipt".
 */
export interface BehaviourReceipt {
  candidate_id: string;
  run_id: string;
  outcome: 'explained' | 'supporting' | 'unresolved';
  /**
   * @minItems 0
   */
  claim_ids: string[];
  reason: string;
  /**
   * @minItems 0
   */
  inspected: DiscoveryEvidence[];
}
/**
 * This interface was referenced by `ScanDiscovery`'s JSON-Schema
 * via the `definition` "ActionHost".
 */
export interface ActionHost {
  action_id: string;
  component_id: string;
  /**
   * @minItems 1
   */
  evidence: [DiscoveryEvidence, ...DiscoveryEvidence[]];
}
