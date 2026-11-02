/* Generated from schema/scan-interpretation.schema.json. Run node tools/scan-interpretation-types.ts. */

/**
 * This interface was referenced by `ScanInterpretation`'s JSON-Schema
 * via the `definition` "Context".
 */
export type Context =
  | {
      id: string;
      sha256: string;
      role: 'target' | 'surrounding';
      kind: 'scan_snapshot';
      scan_id: string;
      repo: string;
      commit: string;
    }
  | {
      id: string;
      sha256: string;
      role: 'target' | 'surrounding';
      kind: 'context_snapshot';
      uri: string;
      title: string;
      revision: string;
      authority: 'curated' | 'documentation' | 'team_note' | 'user_context';
      input_provenance: InputProvenance;
      /**
       * @minItems 0
       */
      pins: Pin[];
    };
/**
 * This interface was referenced by `ScanInterpretation`'s JSON-Schema
 * via the `definition` "Usage".
 */
export type Usage =
  | {
      state: 'measured';
      calls: number;
      input_tokens: number;
      output_tokens: number;
    }
  | {
      state: 'unknown';
      calls_lower_bound: number;
      reason: string;
    };
/**
 * This interface was referenced by `ScanInterpretation`'s JSON-Schema
 * via the `definition` "Claim".
 */
export type Claim = PurposeClaim | ActorClaim | ActionClaim | JourneyClaim | RelationshipClaim;
/**
 * This interface was referenced by `ScanInterpretation`'s JSON-Schema
 * via the `definition` "Confidence".
 */
export type Confidence = 'low' | 'medium' | 'high';
/**
 * This interface was referenced by `ScanInterpretation`'s JSON-Schema
 * via the `definition` "Evidence".
 */
export type Evidence =
  | {
      kind: 'observed_record';
      context_id: string;
      record_id: string;
      /**
       * @minItems 1
       */
      source_ids: [string, ...string[]];
    }
  | ContextReference;
/**
 * This interface was referenced by `ScanInterpretation`'s JSON-Schema
 * via the `definition` "EntityReference".
 */
export type EntityReference =
  | ObservedReference
  | ContextReference
  | {
      kind: 'inferred_claim';
      claim_id: string;
    };

export interface ScanInterpretation {
  format: 'scan-interpretation/v1';
  id: string;
  state: 'pending' | 'partial' | 'complete';
  /**
   * @minItems 1
   */
  contexts: [Context, ...Context[]];
  /**
   * @minItems 0
   */
  runs: Run[];
  /**
   * @minItems 0
   */
  claims: Claim[];
  /**
   * @minItems 0
   */
  attempts: Attempt[];
}
/**
 * This interface was referenced by `ScanInterpretation`'s JSON-Schema
 * via the `definition` "InputProvenance".
 */
export interface InputProvenance {
  provided_by: 'user' | 'workspace' | 'connected_source';
  retrieved_at: string;
  description: string;
}
/**
 * This interface was referenced by `ScanInterpretation`'s JSON-Schema
 * via the `definition` "Pin".
 */
export interface Pin {
  repo: string;
  commit: string;
}
/**
 * This interface was referenced by `ScanInterpretation`'s JSON-Schema
 * via the `definition` "Run".
 */
export interface Run {
  /**
   * Actual author identities supplied by trusted orchestration, not model names. Omission means unknown and cannot establish independence from a reviewer.
   *
   * @minItems 1
   */
  author_ids?: [string, ...string[]];
  id: string;
  provider: string;
  model: Model;
  /**
   * Actual model execution time, or null when unavailable; explain unknown timing in method. Never substitute serialisation time.
   */
  started_at: string | null;
  /**
   * Actual model execution time, or null when unavailable; explain unknown timing in method. Never substitute serialisation time.
   */
  finished_at: string | null;
  method: string;
  /**
   * @minItems 1
   */
  input_context_ids: [string, ...string[]];
  usage: Usage;
}
/**
 * This interface was referenced by `ScanInterpretation`'s JSON-Schema
 * via the `definition` "Model".
 */
export interface Model {
  name: string | null;
  provenance: 'runtime_reported' | 'user_requested' | 'unknown';
}
/**
 * This interface was referenced by `ScanInterpretation`'s JSON-Schema
 * via the `definition` "PurposeClaim".
 */
export interface PurposeClaim {
  id: string;
  label: 'inferred';
  statement: string;
  reasoning: string;
  confidence: Confidence;
  /**
   * @minItems 0
   */
  alternatives: string[];
  /**
   * @minItems 1
   */
  limitations: [string, ...string[]];
  /**
   * @minItems 1
   */
  support: [Evidence, ...Evidence[]];
  /**
   * @minItems 0
   */
  dependencies: string[];
  run_id: string;
  confirmation?: Confirmation;
  kind: 'purpose';
  subject: EntityReference;
}
/**
 * This interface was referenced by `ScanInterpretation`'s JSON-Schema
 * via the `definition` "ContextReference".
 */
export interface ContextReference {
  kind: 'context_snapshot';
  context_id: string;
  locator: string;
  /**
   * @minItems 2
   * @maxItems 2
   */
  lines: [number, number];
}
/**
 * This interface was referenced by `ScanInterpretation`'s JSON-Schema
 * via the `definition` "Confirmation".
 */
export interface Confirmation {
  by: string;
  at: string;
  notes: string;
}
/**
 * This interface was referenced by `ScanInterpretation`'s JSON-Schema
 * via the `definition` "ObservedReference".
 */
export interface ObservedReference {
  kind: 'observed_record';
  context_id: string;
  record_id: string;
}
/**
 * This interface was referenced by `ScanInterpretation`'s JSON-Schema
 * via the `definition` "ActorClaim".
 */
export interface ActorClaim {
  id: string;
  label: 'inferred';
  statement: string;
  reasoning: string;
  confidence: Confidence;
  /**
   * @minItems 0
   */
  alternatives: string[];
  /**
   * @minItems 1
   */
  limitations: [string, ...string[]];
  /**
   * @minItems 1
   */
  support: [Evidence, ...Evidence[]];
  /**
   * @minItems 0
   */
  dependencies: string[];
  run_id: string;
  confirmation?: Confirmation;
  kind: 'actor';
  name: string;
  actor_type: 'person' | 'organisation' | 'system' | 'unknown';
  /**
   * The supported actor goal, or null when the examined evidence does not establish it.
   */
  goal: string | null;
}
/**
 * This interface was referenced by `ScanInterpretation`'s JSON-Schema
 * via the `definition` "ActionClaim".
 */
export interface ActionClaim {
  id: string;
  label: 'inferred';
  statement: string;
  reasoning: string;
  confidence: Confidence;
  /**
   * @minItems 0
   */
  alternatives: string[];
  /**
   * @minItems 1
   */
  limitations: [string, ...string[]];
  /**
   * @minItems 1
   */
  support: [Evidence, ...Evidence[]];
  /**
   * @minItems 0
   */
  dependencies: string[];
  run_id: string;
  confirmation?: Confirmation;
  kind: 'action';
  name: string;
  /**
   * A supported actor claim reference, or null when the examined evidence does not establish the actor.
   */
  actor: string | null;
  /**
   * @minItems 1
   */
  entrypoints: [Evidence, ...Evidence[]];
  goal: string;
}
/**
 * This interface was referenced by `ScanInterpretation`'s JSON-Schema
 * via the `definition` "JourneyClaim".
 */
export interface JourneyClaim {
  id: string;
  label: 'inferred';
  statement: string;
  reasoning: string;
  confidence: Confidence;
  /**
   * @minItems 0
   */
  alternatives: string[];
  /**
   * @minItems 1
   */
  limitations: [string, ...string[]];
  /**
   * @minItems 1
   */
  support: [Evidence, ...Evidence[]];
  /**
   * @minItems 0
   */
  dependencies: string[];
  run_id: string;
  confirmation?: Confirmation;
  kind: 'journey';
  name: string;
  /**
   * A supported actor claim reference, or null when the examined evidence does not establish the actor.
   */
  actor: string | null;
  goal: string;
  /**
   * @minItems 1
   */
  steps: [
    {
      action: string;
      reason: string;
    },
    ...{
      action: string;
      reason: string;
    }[],
  ];
}
/**
 * This interface was referenced by `ScanInterpretation`'s JSON-Schema
 * via the `definition` "RelationshipClaim".
 */
export interface RelationshipClaim {
  id: string;
  label: 'inferred';
  statement: string;
  reasoning: string;
  confidence: Confidence;
  /**
   * @minItems 0
   */
  alternatives: string[];
  /**
   * @minItems 1
   */
  limitations: [string, ...string[]];
  /**
   * @minItems 1
   */
  support: [Evidence, ...Evidence[]];
  /**
   * @minItems 0
   */
  dependencies: string[];
  run_id: string;
  confirmation?: Confirmation;
  kind: 'relationship';
  from: EntityReference;
  to: EntityReference;
  relationship: 'uses' | 'supports' | 'depends_on' | 'belongs_to' | 'hands_off_to';
}
/**
 * This interface was referenced by `ScanInterpretation`'s JSON-Schema
 * via the `definition` "Attempt".
 */
export interface Attempt {
  area: 'purpose' | 'actor' | 'action' | 'journey' | 'relationship';
  outcome: 'claims_proposed' | 'insufficient_context' | 'not_applicable';
  /**
   * @minItems 0
   */
  claim_ids: string[];
  reason: string;
  run_id: string;
}
