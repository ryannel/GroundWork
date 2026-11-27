import type { Cite, HandlerStep } from "./model-types.js";
import type { SchemaVersion } from "./types.js";

// ── Plan Manifest (plan.yaml) ───────────────────────────────────────────────

export type PlanGate = "draft" | "ready" | "executing" | "landed" | "abandoned";

export interface PillarSignoff {
  readonly by: string;
  readonly at: string;
  readonly note?: string;
}

export interface PlanQuestion {
  readonly id: string;
  readonly text: string;
  readonly owner?: string;
  readonly status: "open" | "answered";
  readonly answer?: string;
  readonly blocks?: readonly string[];
}

export interface PlanDecision {
  readonly id: string;
  readonly title: string;
  readonly status: "proposed" | "accepted" | "superseded";
  readonly reversibility?: "one-way" | "two-way";
  readonly rationale?: string;
}

export interface PlanRisk {
  readonly id: string;
  readonly description: string;
  readonly severity: "low" | "medium" | "high";
  readonly mitigation?: string;
}

export interface PlanManifestFile {
  readonly schema_version: SchemaVersion;
  readonly id: string;
  readonly title: string;
  readonly status: PlanGate;
  readonly date?: string;
  readonly builds_on?: readonly string[];
  readonly problem: {
    readonly summary: string;
    readonly why?: string;
    readonly non_goals?: readonly string[];
  };
  readonly pillars: {
    readonly architecture: {
      readonly file: string;
      readonly additions?: string;
    };
    readonly design:
      | { readonly applicable: true; readonly file: string }
      | { readonly applicable: false; readonly reason: string };
    readonly execution: {
      readonly file: string;
      readonly progress?: string;
    };
    readonly proof: {
      readonly file: string;
    };
  };
  readonly signoffs?: {
    readonly architecture?: PillarSignoff;
    readonly design?: PillarSignoff;
    readonly execution?: PillarSignoff;
    readonly proof?: PillarSignoff;
  };
  readonly questions?: readonly PlanQuestion[];
  readonly decisions?: readonly PlanDecision[];
  readonly risks?: readonly PlanRisk[];
}

// ── Pillar 1: Architecture Changes (architecture/changes.yaml) ──────────────

export type StepBranch = "steps" | "then" | "else" | "try" | "catch" | "finally" | "exhausted";

export type PlanOp =
  | {
      readonly add: "field" | "endpoint" | "message" | "subscription" | "job" | "screen" | "region" | "handler" | "procedure";
      readonly into: string;
      readonly value: Record<string, unknown>;
    }
  | {
      readonly modify: string;
      readonly set: Record<string, unknown>;
      readonly replace_all?: boolean;
      readonly reason?: string;
    }
  | {
      readonly remove: string;
      readonly reason?: string;
    }
  | {
      readonly insert_step: {
        readonly into: string; // handler:... or handler:...#step or procedure:...
        readonly branch?: StepBranch;
        readonly before?: string;
        readonly after?: string;
        readonly value: HandlerStep;
      };
    }
  | {
      readonly wrap_step: {
        readonly target: string; // handler:...#step
        readonly wrapper: Omit<HandlerStep, "steps" | "then" | "try"> & { readonly branch?: "steps" | "then" | "try" };
      };
    };

export interface PlanRequirement {
  readonly id: string;
  readonly text: string;
}

export interface PlanChange {
  readonly id: string;
  readonly title: string;
  readonly why?: string;
  readonly requires?: readonly PlanRequirement[];
  readonly blocked_by?: readonly string[];
  readonly ops?: readonly PlanOp[];
}

export interface PlanChangesFile {
  readonly schema_version: SchemaVersion;
  readonly relies_on?: readonly string[];
  readonly changes: readonly PlanChange[];
}

export interface PlanBaseLockFile {
  readonly schema_version: SchemaVersion;
  readonly locked_at: string;
  readonly targets: Readonly<Record<string, string>>; // entity/step ID -> sha256
  readonly relies_on: Readonly<Record<string, string>>; // entity/step ID -> sha256
}

// ── Pillar 2: Design (design/design.yaml) ───────────────────────────────────

export interface DesignScreenBinding {
  readonly selector: string;
  readonly region?: string;
  readonly reads?: readonly string[];
  readonly calls?: string;
}

export interface DesignScreenSpec {
  readonly screen: string;
  readonly prototype: string;
  readonly baseline?: string;
  readonly fidelity: "low" | "mid" | "high";
  readonly viewports?: readonly string[];
  readonly states: readonly { readonly id: string; readonly label: string }[];
  readonly a11y?: {
    readonly live_regions?: readonly string[];
    readonly keyboard_order?: readonly string[];
  };
  readonly bindings?: readonly DesignScreenBinding[];
}

export interface DesignFlowSpec {
  readonly id: string;
  readonly name: string;
  readonly entry: string;
  readonly transitions: readonly {
    readonly from: string;
    readonly on: string;
    readonly to: string;
  }[];
}

export interface PlanDesignFile {
  readonly schema_version: SchemaVersion;
  readonly design_system: "inherit" | "extend" | "new" | "code-cited";
  readonly design_system_source?: Cite;
  readonly tokens_patch?: string;
  readonly flows?: readonly DesignFlowSpec[];
  readonly screens: readonly DesignScreenSpec[];
}

// ── Pillar 3: Execution (execution/execution.yaml & progress.yaml) ──────────

export type WorkItemTarget =
  | { readonly repo: string }
  | { readonly new_repo: string }
  | { readonly external: string };

export interface PlanMilestone {
  readonly id: string;
  readonly name: string;
  readonly due?: string;
  readonly after?: readonly string[];
}

export interface PlanWorkItem {
  readonly id: string;
  readonly title: string;
  readonly milestone: string;
  readonly team?: string;
  readonly target: WorkItemTarget;
  readonly external_ref?: string;
  readonly implements?: readonly string[];
  readonly verified_by?: readonly string[];
  readonly verification_none_reason?: string;
  readonly depends_on?: readonly string[];
  readonly blocked_by?: readonly string[];
}

export interface PlanExecutionFile {
  readonly schema_version: SchemaVersion;
  readonly milestones: readonly PlanMilestone[];
  readonly work_items: readonly PlanWorkItem[];
}

export interface ProgressEvent {
  readonly work_item: string;
  readonly status: "todo" | "in_progress" | "in_review" | "done" | "blocked";
  readonly at: string;
  readonly by: string;
  readonly note?: string;
  readonly source_url?: string;
}

export interface PlanProgressFile {
  readonly schema_version: SchemaVersion;
  readonly events: readonly ProgressEvent[];
}

// ── Pillar 4: Proof (proof/proof.yaml) ──────────────────────────────────────

export interface PlanTestSpec {
  readonly id: string;
  readonly level: "unit" | "contract" | "integration" | "service" | "e2e" | "manual";
  readonly name: string;
  readonly env: "local" | "ci" | "staging" | "prod";
  readonly proves: readonly string[];
  readonly given?: string;
  readonly when?: string;
  readonly then?: string | readonly string[];
  readonly owner?: string;
  readonly cites?: readonly Cite[];
  readonly manual_signoff?: { readonly by: string; readonly at: string; readonly evidence?: string };
}

export interface PlanProofFile {
  readonly schema_version: SchemaVersion;
  readonly tests: readonly PlanTestSpec[];
}

// ── Inline Review Notes (reviews/<id>.yaml) ─────────────────────────────────

export interface ReviewNoteFile {
  readonly schema_version: SchemaVersion;
  readonly id: string;
  readonly target_id: string;
  readonly author: string;
  readonly created_at: string;
  readonly status: "open" | "resolved";
  readonly anchor_hash?: string;
  readonly body: string;
}
