import type { InterpretationSnapshot } from './interpretation-context';
import type { ScanInterpretation } from './interpretation.generated';

export interface ReadinessExpectations {
  readonly repo: string;
  readonly commit: string;
  readonly scopeChecks: readonly {
    readonly scopeId: string;
    readonly checkIds: readonly string[];
  }[];
  readonly questionIds: readonly string[];
}
export type ReadinessCheckStatus = 'supported' | 'failed' | 'unresolved';
export type ReadinessPhase = 'cold' | 'warm' | 'rulesChanged' | 'parserChanged';
export interface ReadinessCheck {
  readonly id: string;
  readonly status: ReadinessCheckStatus;
}
export interface ReadinessBenchmark {
  readonly scopeId: string;
  readonly phases: Readonly<Record<ReadinessPhase, readonly ReadinessCheck[]>>;
  readonly mutations: readonly {
    readonly checkId: string;
    readonly applied: boolean;
    readonly baseline: ReadinessCheckStatus;
    readonly mutated: ReadinessCheckStatus;
  }[];
  readonly integrityPassed: boolean;
  readonly reusePassed: boolean;
}
export interface ReadinessQuery {
  readonly entryId: string;
  readonly artifactVerified: boolean;
  readonly selectedRecords: number;
  readonly returnedRecordIds: readonly string[];
  readonly pages: number;
  readonly bytes: number;
  readonly limits: {
    readonly maxRecords: number;
    readonly maxBytes: number;
    readonly maxRecordsPerPage: number;
    readonly maxPageBytes: number;
    readonly idsPerRequest: number;
  };
  readonly missing: number;
  readonly oversized: number;
  readonly omitted: number;
}
export type WorkflowCapability =
  | 'stop_resume'
  | 'incremental_add'
  | 'incremental_modify'
  | 'incremental_delete'
  | 'incremental_rename'
  | 'policy_invalidation'
  | 'source_budget'
  | 'edge_identity_stability';
export interface RepositoryReadinessInput {
  readonly expectations: ReadinessExpectations;
  readonly benchmark: readonly ReadinessBenchmark[];
  readonly questions: readonly {
    readonly id: string;
    readonly status: 'source-supported' | 'partial' | 'unsupported';
  }[];
  readonly catalogue: {
    readonly entries: readonly { readonly id: string; readonly planEntryId: string }[];
    readonly queries: readonly ReadinessQuery[];
  };
  readonly workflow: readonly {
    readonly capability: WorkflowCapability;
    readonly passed: boolean;
    readonly cases: number;
    readonly evidence: string;
  }[];
  readonly budgetStatus: 'within_bounds' | 'exceeded' | 'unknown';
  readonly sourceUsage: {
    readonly phase: 'deterministic_source';
    readonly calls: number;
    readonly tokens: number;
  };
  readonly interpretation: {
    readonly document: ScanInterpretation;
    readonly snapshots: readonly InterpretationSnapshot[];
  };
}
export interface RepositoryReadiness {
  readonly readiness: 'ready_for_bounded_repository_pass' | 'not_ready';
  readonly fullscanWorkflowReady: boolean;
  readonly blockers: readonly string[];
  readonly counts: {
    readonly supported: number;
    readonly partial: number;
    readonly unsupported: number;
  };
  readonly wider_scans: 'stopped_not_authorised';
  readonly modelBudget: 'measured' | 'unmetered';
}
