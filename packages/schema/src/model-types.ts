import type { FacetName, SchemaVersion } from "./types.js";

// ── Citations (4 first-class kinds) ─────────────────────────────────────────

export type Cite =
  | string // compact code shorthand: "<home>:<path>#L<a>-<b> [symbol]" or "#L<a>-<b> [symbol]" when cite_base is set
  | { readonly code: string; readonly symbol?: string }
  | { readonly evidence: string }
  | {
      readonly doc: string;
      readonly title: string;
      readonly section?: string;
      readonly version?: string;
      readonly retrieved_at: string;
    }
  | {
      readonly catalog: string;
      readonly source: string;
      readonly ref: string;
      readonly snapshot_at: string;
      readonly digest?: string;
    };

// ── Workspaces & Fractal Spaces ─────────────────────────────────────────────

export interface RepoConfig {
  readonly path?: string;
  readonly remote?: string;
  readonly default_branch?: string;
}

export interface OrganisationRelationship {
  readonly id: string;
  readonly target: string;
  readonly name: string;
  readonly kind: "direct" | "product" | "indirect";
  readonly method?: "automated" | "manual" | "offline";
  readonly summary: string;
  readonly cites: readonly Cite[];
}

export interface Organisation {
  readonly id: string;
  readonly name: string;
  readonly categories?: readonly string[];
  readonly relationships?: readonly OrganisationRelationship[];
}

export interface TeamContact {
  readonly name: string;
  readonly role?: string;
}

export interface Team {
  readonly id: string;
  readonly name: string;
  readonly channel?: string;
  readonly organisation?: string;
  readonly contacts?: readonly TeamContact[];
}

export interface Actor {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly customer?: boolean;
  readonly uses?: readonly string[];
}

export interface WorkspacePointerFile {
  readonly schema_version: SchemaVersion;
  readonly id: string;
  readonly name?: string;
  readonly root: string;
  readonly repo?: string;
}

export interface SpaceConfig {
  readonly schema_version: SchemaVersion;
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly private?: boolean;
  readonly repos?: Readonly<Record<string, RepoConfig>>;
  readonly teams?: readonly Team[];
  readonly actors?: readonly Actor[];
  readonly organisations?: readonly Organisation[];
}

export interface WorkspaceFile extends SpaceConfig {
  /** When present, this workspace is a multi-project container holding isolated Spaces under projects/<slug>/ */
  readonly projects?: readonly string[];
}

export interface DomainDef {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
}

export interface DomainsFile {
  readonly schema_version: SchemaVersion;
  readonly domains: readonly DomainDef[];
}

// ── System & Components ─────────────────────────────────────────────────────

export interface CodeHome {
  readonly repo: string;
  readonly path?: string;
}

export interface SystemConnection {
  readonly to: string;
  readonly says: string;
  readonly backs: readonly string[];
}

export interface SystemFile {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  readonly domain?: string;
  readonly team?: string;
  readonly mapped: boolean;
  readonly runs_on?: readonly string[];
  readonly homes?: Readonly<Record<string, CodeHome>>;
  readonly connections?: readonly SystemConnection[];
}

export type ComponentKind = "service" | "app" | "module";
export type ModelingDepth = "stub" | "contract-only" | "module-boundary" | "full";
export type TriageDisposition = "operational" | "dead_code" | "test_only" | "deferred";

export interface TriageRule {
  /** Exact surface_id or glob pattern such as "route:GET:/docs*" or "route:*:/actuator/**" */
  readonly surface: string;
  readonly disposition: TriageDisposition;
  readonly reason: string;
}

export interface FacetAttestation {
  readonly facet: FacetName;
  readonly state: "verified_none";
  readonly checked: readonly string[];
  readonly reason: string;
}

export interface ObservedEdge {
  readonly id: string;
  readonly to: string;
  readonly kind: "call" | "publish" | "consume" | "read" | "write";
  readonly says: string;
  readonly status?: "unpromoted" | "unused_registration";
  readonly reason: string;
  readonly cites: readonly Cite[];
}

export interface PublicModuleExport {
  readonly name: string;
  readonly summary?: string;
  readonly cites?: readonly Cite[];
}

export interface ComponentFile {
  readonly id: string;
  readonly name: string;
  readonly kind: ComponentKind;
  readonly form?: "web" | "mobile" | "admin" | "cli" | "library" | "runtime" | "tool";
  readonly tech?: string;
  readonly home?: string;
  readonly depth?: ModelingDepth;
  readonly infrastructure?: boolean;
  readonly uses?: readonly string[];
  /** Explicit in-process module/crate dependencies (e.g. ["module:thrum-core", "module:thrum-render"]) */
  readonly depends_on?: readonly string[];
  /** High-level exported sub-modules / public API surface for module-boundary depth */
  readonly public_modules?: readonly PublicModuleExport[];
  /** Architectural invariants / forbidden dependencies for this module */
  readonly invariants?: readonly string[];
  readonly does?: string;
  readonly cites?: readonly Cite[];
  readonly triage?: readonly TriageRule[];
  readonly attestations?: readonly FacetAttestation[];
  readonly observed_edges?: readonly ObservedEdge[];
}

// ── Contracts, Schemas, Stores, Topics, Externals ───────────────────────────

export type KnownFrom = "implementation" | "declared-spec" | "consumer-observed" | "vendor-doc";

export type FieldType =
  | string
  | { readonly array: FieldType }
  | { readonly map: { readonly key: FieldType; readonly value: FieldType } }
  | { readonly one_of: readonly FieldType[] }
  | { readonly enum: readonly string[] };

export interface SchemaField {
  readonly id: string;
  readonly name: string;
  readonly type: FieldType;
  readonly required?: boolean;
  readonly note?: string;
  readonly cites?: readonly Cite[];
}

export interface SchemaDef {
  readonly id: string;
  readonly kind: "dto" | "record" | "payload" | "graph-type";
  readonly table?: string;
  readonly fields: readonly SchemaField[];
  readonly cites?: readonly Cite[];
}

export interface EndpointDef {
  readonly id: string;
  readonly method?: string;
  readonly path?: string;
  readonly field?: string;
  readonly signature?: string;
  readonly rpc?: string;
  readonly call?: string;
  readonly summary?: string;
  readonly auth?: string;
  readonly idempotent?: boolean;
  readonly request?: string; // canonical schema:... or "none"
  readonly response?: string; // canonical schema:... or "none"
  readonly errors?: readonly { readonly status: number | string; readonly when: string }[];
  readonly surface?: string;
  readonly cites?: readonly Cite[];
}

export interface InterfaceDef {
  readonly id: string;
  readonly kind: "rest" | "graphql" | "grpc" | "sdk" | "websocket";
  readonly known_from: KnownFrom;
  readonly version?: string;
  readonly base_path?: string;
  readonly auth?: string;
  readonly entries: readonly EndpointDef[];
}

export interface SubscriptionDef {
  readonly id: string;
  readonly message: string;
  readonly group?: string;
  readonly when?: string;
  readonly concurrency?: number;
  readonly delivery?: { readonly retries?: number; readonly dead_letter?: string };
  readonly surface?: string;
  readonly cites?: readonly Cite[];
}

export interface JobDef {
  readonly id: string;
  readonly every?: string;
  readonly cron?: string;
  readonly trigger?: string;
  readonly when?: string;
  readonly surface?: string;
  readonly cites?: readonly Cite[];
}

export interface InteractionDef {
  readonly id: string;
  readonly on: string;
  readonly action: string;
  readonly summary?: string;
  readonly cites?: readonly Cite[];
}

export interface ContractsFile {
  readonly interfaces?: readonly InterfaceDef[];
  readonly subscriptions?: readonly SubscriptionDef[];
  readonly jobs?: readonly JobDef[];
  readonly interactions?: readonly InteractionDef[];
  readonly schemas?: readonly SchemaDef[];
}

export interface StoreFile {
  readonly id: string;
  readonly name: string;
  readonly form: "database" | "cache" | "bucket" | "warehouse" | "vector" | "managed";
  readonly tech?: string;
  readonly owner: string; // canonical service:/app: ID OR "unknown"
  readonly owner_cites?: readonly Cite[];
  readonly notes?: string;
  readonly cites?: readonly Cite[];
  readonly records?: readonly SchemaDef[];
}

export interface MessageDef {
  readonly id: string;
  readonly payload?: string;
  readonly key?: string;
  readonly semantics: "event" | "command" | "state";
  readonly summary?: string;
  readonly schema?: SchemaDef;
  readonly surface?: string;
  readonly cites?: readonly Cite[];
}

export interface TopicFile {
  readonly id: string;
  readonly name: string;
  readonly form: "stream" | "queue";
  readonly tech?: string;
  readonly owner: string; // canonical service:/app: ID OR "unknown"
  readonly owner_cites?: readonly Cite[];
  readonly cites?: readonly Cite[];
  readonly messages?: readonly MessageDef[];
}

export interface ScreenRegion {
  readonly id: string;
  readonly name: string;
}

export interface ScreenDef {
  readonly id: string;
  readonly name?: string;
  readonly kind: "page" | "modal" | "sheet" | "print" | "email";
  readonly device?: string;
  readonly route?: string;
  readonly regions?: readonly ScreenRegion[];
  readonly cites?: readonly Cite[];
}

export interface ScreensFile {
  readonly screens: readonly ScreenDef[];
}

export interface ExternalFile {
  readonly id: string;
  readonly name: string;
  readonly organisation?: string;
  readonly summary: string;
  readonly doc_root?: string;
}

// ── Handlers & Reusable Procedures ──────────────────────────────────────────

export interface RetryConfig {
  readonly until?: string;
  readonly description?: string;
  readonly times?: number;
  readonly exhausted?: readonly HandlerStep[];
}

export interface ParallelLane {
  readonly lane?: string;
  readonly steps: readonly HandlerStep[];
}

export interface DispatchCase {
  readonly match: string;
  readonly run: string; // canonical procedure:...
}

export interface UnresolvedCall {
  readonly target_hint: string;
  readonly gap_id: string;
}

export interface HandlerStep {
  readonly id: string;
  readonly say?: string;
  readonly does?: string;
  readonly when?: string;
  readonly async?: boolean;
  readonly causes?: string;
  readonly cites?: readonly Cite[];
  // Effects (at most one)
  readonly read?: string;
  readonly from?: string;
  readonly write?: string;
  readonly to?: string;
  readonly call?: string;
  readonly unresolved_call?: UnresolvedCall;
  readonly publish?: string;
  readonly run?: string; // canonical procedure:...
  readonly wait?: string;
  readonly return?: string | number;
  // Control structures (at most one)
  readonly if?: string;
  readonly then?: readonly HandlerStep[];
  readonly else?: readonly HandlerStep[];
  readonly dispatch?: { readonly on: string; readonly cases: readonly DispatchCase[] };
  readonly each?: string;
  readonly steps?: readonly HandlerStep[];
  readonly parallel?: readonly ParallelLane[];
  readonly try?: readonly HandlerStep[];
  readonly catch?: readonly HandlerStep[];
  readonly finally?: readonly HandlerStep[];
  readonly transaction?: boolean;
  readonly retry?: RetryConfig;
}

export interface HandlerFailure {
  readonly id: string;
  readonly when: string;
  readonly return?: string | number;
  readonly cites?: readonly Cite[];
}

export interface ProcedureDef {
  readonly id: string;
  readonly summary: string;
  readonly cite_base?: string;
  readonly cites?: readonly Cite[];
  readonly steps: readonly HandlerStep[];
  readonly failures?: readonly HandlerFailure[];
}

export interface HandlerDef {
  readonly id: string;
  readonly on: string; // canonical endpoint: | subscription: | job: | interaction:
  readonly summary: string;
  readonly cite_base?: string;
  readonly cites?: readonly Cite[];
  readonly steps: readonly HandlerStep[];
  readonly failures?: readonly HandlerFailure[];
}

export interface HandlersFile {
  readonly procedures?: readonly ProcedureDef[];
  readonly handlers: readonly HandlerDef[];
}

// ── Cross-System Data Movement Flows ────────────────────────────────────────

export interface FlowStepRef {
  readonly id: string;
  readonly label: string;
  readonly ref: string; // canonical handler:..., endpoint:..., message:..., or handler:...#step
  readonly note?: string;
}

export interface FlowFile {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly actor?: string;
  readonly steps: readonly FlowStepRef[];
}

export interface AliasesFile {
  readonly schema_version: SchemaVersion;
  readonly aliases: Readonly<Record<string, string | null>>;
}

// ── Codebase Orientation (orientation.yaml) ─────────────────────────────────

export type OrientationZoneRole = "core" | "contract" | "feature" | "adapter" | "infra" | "diagnostic";

export interface OrientationZone {
  readonly id: string;
  readonly name: string;
  readonly role: OrientationZoneRole;
  readonly summary: string;
  /** Package-root-relative file or directory paths (no leading "./", no catch-all "." or "src") */
  readonly paths: readonly string[];
}

export interface OrientationStartHere {
  /** Package-root-relative file or directory path */
  readonly path: string;
  readonly symbol?: string;
  readonly why: string;
}

export interface OrientationTrap {
  readonly title: string;
  readonly detail: string;
  /** Citation proving this trap exists in code */
  readonly cite: Cite;
}

export interface OrientationTask {
  readonly label: string;
  /** Package-root-relative path to inspect/edit */
  readonly path?: string;
  /** Command to run (local dev, test, or workspace harness) */
  readonly command?: string;
  readonly note?: string;
}

export interface OrientationFile {
  /** One-line mental model / execution lifecycle through this component */
  readonly lifecycle?: string;
  readonly zones?: readonly OrientationZone[];
  readonly start_here?: readonly OrientationStartHere[];
  /** Explicit traps / "not what it looks like" warnings (cited; empty array allowed) */
  readonly traps?: readonly OrientationTrap[];
  readonly tasks?: readonly OrientationTask[];
}
