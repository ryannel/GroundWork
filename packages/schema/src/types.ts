export type SchemaVersion = 1;

export type FacetName =
  | "interfaces"
  | "stores"
  | "messages_published"
  | "messages_consumed"
  | "jobs"
  | "screens"
  | "outbound_calls";

export type ExtractorSupport = "supported" | "partial" | "unsupported";

export interface FrameworkDetection {
  readonly name: string;
  readonly version?: string;
  readonly facet: FacetName;
  readonly support: ExtractorSupport;
  readonly source: string;
}

export interface SubmodulePin {
  readonly path: string;
  readonly name: string;
  readonly remote?: string;
  readonly commit: string;
  readonly branch: string;
  readonly dirty: boolean;
}

export interface PackageRoot {
  /** Relative path from repository root (e.g. "services/wordloop-core" or ".") */
  readonly path: string;
  /** Package/module name from manifest */
  readonly name: string;
  /** Primary language detected from manifest */
  readonly language: "go" | "typescript" | "javascript" | "python" | "csharp" | "java" | "rust" | "unknown";
  /** Manifest file that established this package root */
  readonly manifest: string;
  /** Owning submodule path if this package lives inside a git submodule */
  readonly submodule_path?: string;
  /** Owning repo name (submodule name or root repo name) */
  readonly repo_name?: string;
  /** Workspace-internal package/crate dependencies (for monolith/module-boundary graphs) */
  readonly workspace_dependencies?: readonly string[];
  /** Detected frameworks and extractor support per facet */
  readonly frameworks: readonly FrameworkDetection[];
  /** Per-facet extractor capability summary */
  readonly capabilities: Readonly<Record<FacetName, ExtractorSupport>>;
  /** Key dependencies relevant to architecture (HTTP, DB, messaging, cloud SDKs) */
  readonly key_dependencies: readonly string[];
}

export interface RepositoryPin {
  readonly schema_version: SchemaVersion;
  readonly repo_name: string;
  readonly remote?: string;
  readonly commit: string;
  readonly branch: string;
  readonly dirty: boolean;
  readonly scanned_at: string;
  readonly scanner_version: string;
  readonly submodules?: readonly SubmodulePin[];
  readonly package_roots: readonly PackageRoot[];
}

export type SurfaceKind =
  | "route"
  | "ws_channel"
  | "topic"
  | "subscription"
  | "table"
  | "job"
  | "screen"
  | "outbound_call"
  | "module_export"
  | "module_dep";

export type DenominatorSource = "declarative_spec" | "source_heuristic" | "infra_manifest";

export interface SurfaceRecord {
  /** Deterministic ID within the repo, e.g. "route:POST:/v1/meetings", "table:meetings", "topic:transcript.ready" */
  readonly surface_id: string;
  readonly kind: SurfaceKind;
  readonly facet: FacetName;
  /** Package root relative path (or "." for repo-wide specs like specs/core-openapi.json) */
  readonly package_root: string;
  /** Owning repo/submodule name when scanned inside a nested monorepo */
  readonly repo_name?: string;
  readonly denominator: DenominatorSource;
  /** Spec or framework that produced this surface, e.g. "openapi-3.0", "asyncapi-2.6", "sql-ddl", "go-http", "fastapi" */
  readonly extractor: string;
  readonly file: string;
  readonly lines?: readonly [number, number];
  readonly symbol?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface CrossCheckDiscrepancy {
  readonly normalized_key: string;
  readonly status: "matched" | "spec_only" | "code_only";
  readonly spec_surfaces: readonly string[];
  readonly code_surfaces: readonly string[];
}

export interface DenominatorCrossCheck {
  readonly facet: FacetName;
  readonly scope: string;
  readonly spec_count: number;
  readonly code_count: number;
  readonly matched: number;
  readonly spec_only: readonly CrossCheckDiscrepancy[];
  readonly code_only: readonly CrossCheckDiscrepancy[];
}

export interface SurfaceInventory {
  readonly schema_version: SchemaVersion;
  readonly repo_name: string;
  readonly commit: string;
  readonly scanned_at: string;
  readonly summary: {
    readonly total_surfaces: number;
    readonly by_kind: Readonly<Record<string, number>>;
    readonly by_denominator: Readonly<Record<DenominatorSource, number>>;
    readonly by_package: Readonly<Record<string, number>>;
  };
  /** Sorted deterministically by (package_root, kind, surface_id, denominator) */
  readonly surfaces: readonly SurfaceRecord[];
  /** Independent denominator cross-checks (e.g. OpenAPI routes vs AST routes) */
  readonly cross_checks: readonly DenominatorCrossCheck[];
}

export interface CiteAnchor {
  readonly file: string;
  readonly lines: readonly [number, number];
  readonly symbol?: string;
  readonly content_sha256: string;
}

export interface CiteAnchorsFile {
  readonly schema_version: SchemaVersion;
  readonly repo_name: string;
  readonly commit: string;
  readonly anchors: Readonly<Record<string, CiteAnchor>>;
}

export type AnchorDriftStatus = "unchanged" | "moved" | "changed" | "missing_file";

export interface AnchorCheckResult {
  readonly cite_key: string;
  readonly status: AnchorDriftStatus;
  readonly old_lines: readonly [number, number];
  readonly new_lines?: readonly [number, number];
}

// ── Codebase Structure Evidence (structure.json) ────────────────────────────

export type ModuleVisibility = "public" | "hidden" | "internal" | "test" | "asset";
export type OrientationTier = "compact" | "standard" | "deep";

export interface StructureModuleEntry {
  /** Package-root-relative path (e.g. "src/runtime", "internal/entrypoints/api", "cmd/api") */
  readonly path: string;
  readonly name: string;
  readonly kind: "dir" | "file";
  readonly visibility: ModuleVisibility;
  readonly file_count: number;
  readonly source_files: number;
  readonly loc: number;
  /** Non-code asset counts by extension (e.g. { wgsl: 11, sql: 4 }) */
  readonly asset_counts?: Readonly<Record<string, number>>;
  /** First sentence/paragraph extracted from file or package doc comment */
  readonly doc_summary?: string;
}

export interface StructureEntrypoint {
  /** Package-root-relative path (or repo-root-relative for workspace_harnesses) */
  readonly path: string;
  readonly name: string;
  readonly kind: "binary" | "library" | "script" | "container" | "harness";
  readonly command?: string;
  readonly summary?: string;
}

export interface TechStackGroup {
  readonly category: string;
  readonly items: readonly string[];
}

export interface PackageStructure {
  /** Same package root path as repository.json (e.g. "crates/thrum-render", "services/wordloop-core", ".") */
  readonly package_root: string;
  readonly name: string;
  readonly language: PackageRoot["language"];
  readonly repo_name?: string;
  /** Normalized HTTPS web URL for the owning repo/submodule (e.g. "https://github.com/org/repo") */
  readonly web_url?: string;
  /** Git commit or branch ref for building blob/tree URLs */
  readonly git_ref?: string;
  /** Subpath inside the owning repo (empty/omitted when package_root is the submodule/repo root) */
  readonly repo_subpath?: string;
  /** Package/crate-level doc comment or README intro */
  readonly doc_summary?: string;
  readonly total_files: number;
  readonly source_files: number;
  readonly total_loc: number;
  /** Recommended orientation tier based on deterministic footprint */
  readonly tier: OrientationTier;
  readonly entrypoints: readonly StructureEntrypoint[];
  /** Top-level modules/directories sorted deterministically by (loc desc, path asc) */
  readonly modules: readonly StructureModuleEntry[];
  /** Notable env-var or feature-gate flags detected (signals for traps) */
  readonly flags?: readonly string[];
  readonly tech_stack: readonly TechStackGroup[];
}

export interface StructureEvidence {
  readonly schema_version: SchemaVersion;
  readonly repo_name: string;
  readonly commit: string;
  readonly scanned_at: string;
  /** Workspace-level runnable harnesses / examples / xtasks outside individual library crates */
  readonly workspace_harnesses?: readonly StructureEntrypoint[];
  readonly packages: readonly PackageStructure[];
}
