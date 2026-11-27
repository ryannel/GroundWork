export interface ProjectSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly systems_count: number;
  readonly components_count: number;
  readonly plans_count: number;
  readonly repos_count: number;
}

export interface WorkspaceSummary {
  readonly id: string;
  readonly name: string;
  readonly root_dir: string;
  readonly source: "pointer" | "example" | "env";
  readonly mode: "single-space" | "multi-project";
  readonly projects: readonly string[];
  readonly description?: string;
  readonly systems_count?: number;
  readonly components_count?: number;
  readonly plans_count?: number;
  readonly repos_count?: number;
  readonly project_summaries?: readonly ProjectSummary[];
}

export interface DerivedEdge {
  readonly from: string;
  readonly from_system: string;
  readonly to: string;
  readonly to_system?: string;
  readonly kind: string;
  readonly via: string;
  readonly label?: string;
}

export interface ModelGap {
  readonly kind: string;
  readonly entity_id: string;
  readonly detail: string;
}

export interface HandlerStep {
  readonly id: string;
  readonly say?: string;
  readonly does?: string;
  readonly read?: string;
  readonly from?: string;
  readonly write?: string;
  readonly to?: string;
  readonly call?: string;
  readonly unresolved_call?: { readonly target_hint: string; readonly gap_id: string };
  readonly publish?: string;
  readonly run?: string;
  readonly wait?: string;
  readonly return?: string | number;
  readonly if?: string;
  readonly then?: readonly HandlerStep[];
  readonly else?: readonly HandlerStep[];
  readonly each?: string;
  readonly steps?: readonly HandlerStep[];
  readonly try?: readonly HandlerStep[];
  readonly catch?: readonly HandlerStep[];
  readonly cites?: readonly unknown[];
}

export interface HandlerDef {
  readonly id: string;
  readonly on?: string;
  readonly summary: string;
  readonly cite_base?: string;
  readonly steps: readonly HandlerStep[];
  readonly failures?: readonly { readonly id: string; readonly when: string; readonly return?: string | number }[];
}

export interface EndpointDef {
  readonly id: string;
  readonly method?: string;
  readonly path?: string;
  readonly summary?: string;
  readonly auth?: string;
  readonly request?: string;
  readonly response?: string;
  readonly cites?: readonly unknown[];
}

export interface InterfaceDef {
  readonly id: string;
  readonly kind: string;
  readonly known_from: string;
  readonly base_path?: string;
  readonly auth?: string;
  readonly entries: readonly EndpointDef[];
}

export interface SchemaDef {
  readonly id: string;
  readonly kind: string;
  readonly table?: string;
  readonly fields: readonly { readonly id: string; readonly name: string; readonly type: unknown; readonly required?: boolean }[];
}

export interface LoadedComponent {
  readonly id: string;
  readonly slug: string;
  readonly system_id: string;
  readonly component: {
    readonly id: string;
    readonly name: string;
    readonly kind: "service" | "app" | "module";
    readonly form?: string;
    readonly tech?: string;
    readonly home?: string;
    readonly depth?: string;
    readonly does?: string;
    readonly cites?: readonly unknown[];
    readonly depends_on?: readonly string[];
    readonly public_modules?: readonly { readonly name: string; readonly summary?: string; readonly cites?: readonly unknown[] }[];
    readonly invariants?: readonly string[];
    readonly triage?: readonly { readonly surface: string; readonly disposition: string; readonly reason: string }[];
  };
  readonly contracts: {
    readonly interfaces?: readonly InterfaceDef[];
    readonly subscriptions?: readonly { readonly id: string; readonly message: string }[];
    readonly jobs?: readonly { readonly id: string; readonly every?: string; readonly cron?: string }[];
    readonly schemas?: readonly SchemaDef[];
  };
  readonly screens: {
    readonly screens: readonly {
      readonly id: string;
      readonly name?: string;
      readonly kind: string;
      readonly route?: string;
      readonly regions?: readonly { readonly id: string; readonly name: string }[];
    }[];
  };
  readonly handlers: {
    readonly procedures?: readonly HandlerDef[];
    readonly handlers: readonly HandlerDef[];
  };
  readonly orientation?: OrientationFilePayload;
}

export type OrientationZoneRole = "core" | "contract" | "feature" | "adapter" | "infra" | "diagnostic";

export interface OrientationZonePayload {
  readonly id: string;
  readonly name: string;
  readonly role: OrientationZoneRole;
  readonly summary: string;
  readonly paths: readonly string[];
}

export interface OrientationStartHerePayload {
  readonly path: string;
  readonly symbol?: string;
  readonly why: string;
}

export interface OrientationTrapPayload {
  readonly title: string;
  readonly detail: string;
  readonly cite: unknown;
}

export interface OrientationTaskPayload {
  readonly label: string;
  readonly path?: string;
  readonly command?: string;
  readonly note?: string;
}

export interface OrientationFilePayload {
  readonly lifecycle?: string;
  readonly zones?: readonly OrientationZonePayload[];
  readonly start_here?: readonly OrientationStartHerePayload[];
  readonly traps?: readonly OrientationTrapPayload[];
  readonly tasks?: readonly OrientationTaskPayload[];
}

export interface StructureModulePayload {
  readonly path: string;
  readonly name: string;
  readonly kind: "dir" | "file";
  readonly visibility: "public" | "hidden" | "internal" | "test" | "asset";
  readonly file_count: number;
  readonly source_files: number;
  readonly loc: number;
  readonly asset_counts?: Readonly<Record<string, number>>;
  readonly doc_summary?: string;
}

export interface StructureEntrypointPayload {
  readonly path: string;
  readonly name: string;
  readonly kind: "binary" | "library" | "script" | "container" | "harness";
  readonly command?: string;
  readonly summary?: string;
}

export interface PackageStructurePayload {
  readonly package_root: string;
  readonly name: string;
  readonly language: string;
  readonly repo_name?: string;
  readonly web_url?: string;
  readonly git_ref?: string;
  readonly repo_subpath?: string;
  readonly doc_summary?: string;
  readonly total_files: number;
  readonly source_files: number;
  readonly total_loc: number;
  readonly tier: "compact" | "standard" | "deep";
  readonly entrypoints: readonly StructureEntrypointPayload[];
  readonly modules: readonly StructureModulePayload[];
  readonly flags?: readonly string[];
  readonly tech_stack: readonly { readonly category: string; readonly items: readonly string[] }[];
}

export interface ModuleSurfaceCountsPayload {
  readonly routes: number;
  readonly tables: number;
  readonly topics: number;
  readonly other: number;
}

export interface ComponentCodeInfoPayload {
  readonly home_repo?: string;
  readonly home_path?: string;
  readonly web_url?: string;
  readonly git_ref?: string;
  readonly repo_subpath?: string;
  readonly package_root?: {
    readonly path: string;
    readonly name: string;
    readonly language: string;
    readonly manifest: string;
    readonly repo_name?: string;
    readonly submodule_path?: string;
    readonly capabilities: Readonly<Record<string, string>>;
    readonly key_dependencies: readonly string[];
  };
  readonly submodule?: {
    readonly path: string;
    readonly name: string;
    readonly remote?: string;
    readonly commit: string;
    readonly branch: string;
    readonly dirty: boolean;
  };
  readonly package_structure?: PackageStructurePayload;
  readonly workspace_harnesses: readonly StructureEntrypointPayload[];
  readonly surface_counts_by_module: Readonly<Record<string, ModuleSurfaceCountsPayload>>;
  readonly matched_surfaces: readonly ScannedSurface[];
}

export interface StoreFile {
  readonly id: string;
  readonly name: string;
  readonly form: string;
  readonly tech?: string;
  readonly owner: string;
  readonly notes?: string;
  readonly records?: readonly SchemaDef[];
}

export interface TopicFile {
  readonly id: string;
  readonly name: string;
  readonly form: string;
  readonly tech?: string;
  readonly owner: string;
  readonly messages?: readonly { readonly id: string; readonly semantics: string; readonly summary?: string }[];
}

export interface LoadedSystem {
  readonly id: string;
  readonly slug: string;
  readonly system: {
    readonly id: string;
    readonly name: string;
    readonly purpose: string;
    readonly domain?: string;
    readonly team?: string;
    readonly mapped: boolean;
    readonly homes?: Readonly<Record<string, { readonly repo: string; readonly path?: string }>>;
  };
  readonly stub_contracts?: { readonly interfaces?: readonly InterfaceDef[] };
  readonly components: readonly LoadedComponent[];
  readonly stores: readonly StoreFile[];
  readonly topics: readonly TopicFile[];
}

export interface LoadedExternal {
  readonly id: string;
  readonly slug: string;
  readonly external: { readonly id: string; readonly name: string; readonly summary: string; readonly doc_root?: string };
  readonly contracts: { readonly interfaces?: readonly InterfaceDef[] };
}

export interface FlowFile {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly actor?: string;
  readonly steps: readonly { readonly id: string; readonly label: string; readonly ref: string; readonly note?: string }[];
}

export interface DiffEntry {
  readonly entity_id: string;
  readonly change_id: string;
  readonly kind: "added" | "modified" | "removed";
  readonly detail?: string;
}

export interface LoadedPlanPayload {
  readonly id: string;
  readonly slug: string;
  readonly manifest: {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly date?: string;
    readonly problem: { readonly summary: string; readonly why?: string; readonly non_goals?: readonly string[] };
    readonly pillars: {
      readonly design: { readonly applicable: boolean; readonly reason?: string; readonly file?: string };
    };
    readonly signoffs?: Readonly<Record<string, { readonly by: string; readonly at: string }>>;
    readonly questions?: readonly { readonly id: string; readonly text: string; readonly status: string; readonly answer?: string }[];
    readonly decisions?: readonly { readonly id: string; readonly title: string; readonly status: string; readonly reversibility?: string }[];
  };
  readonly changes: {
    readonly relies_on?: readonly string[];
    readonly changes: readonly {
      readonly id: string;
      readonly title: string;
      readonly requires?: readonly { readonly id: string; readonly text: string }[];
      readonly ops?: readonly unknown[];
    }[];
  };
  readonly design?: {
    readonly design_system: string;
    readonly screens: readonly {
      readonly screen: string;
      readonly prototype: string;
      readonly fidelity: string;
      readonly viewports?: readonly string[];
      readonly states: readonly { readonly id: string; readonly label: string }[];
      readonly bindings?: readonly { readonly selector: string; readonly region?: string; readonly reads?: readonly string[]; readonly calls?: string }[];
    }[];
  };
  readonly execution: {
    readonly milestones: readonly { readonly id: string; readonly name: string; readonly due?: string }[];
    readonly work_items: readonly {
      readonly id: string;
      readonly title: string;
      readonly milestone: string;
      readonly team?: string;
      readonly target: { readonly repo?: string; readonly new_repo?: string; readonly external?: string };
      readonly implements?: readonly string[];
      readonly verified_by?: readonly string[];
      readonly depends_on?: readonly string[];
    }[];
  };
  readonly progress?: { readonly events: readonly { readonly work_item: string; readonly status: string; readonly at: string; readonly by: string; readonly note?: string }[] };
  readonly proof: {
    readonly tests: readonly {
      readonly id: string;
      readonly level: string;
      readonly name: string;
      readonly env: string;
      readonly proves: readonly string[];
      readonly given?: string;
      readonly when?: string;
      readonly then?: string | readonly string[];
    }[];
  };
  readonly reviews: readonly {
    readonly id: string;
    readonly target_id: string;
    readonly author: string;
    readonly created_at: string;
    readonly status: string;
    readonly body: string;
  }[];
  readonly diff: readonly DiffEntry[];
  readonly after_systems: readonly LoadedSystem[];
  readonly after_edges: readonly DerivedEdge[];
  readonly drift: { readonly status: string; readonly items: readonly { readonly target_id: string; readonly status: string; readonly detail: string }[] };
  readonly gate_ready: { readonly passed: boolean; readonly violations: readonly { readonly gate: string; readonly severity: string; readonly message: string }[] };
  readonly reconciliation: { readonly changes: readonly { readonly change_id: string; readonly status: string; readonly details: readonly string[] }[] };
}

export interface ScannedSurface {
  readonly surface_id: string;
  readonly kind: string;
  readonly facet: string;
  readonly package_root: string;
  readonly repo_name?: string;
  readonly denominator: string;
  readonly extractor: string;
  readonly file: string;
  readonly lines?: readonly [number, number];
  readonly symbol?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface RepoEvidencePayload {
  readonly repo_key: string;
  readonly repository: {
    readonly repo_name: string;
    readonly remote?: string;
    readonly commit: string;
    readonly branch: string;
    readonly dirty: boolean;
    readonly scanned_at: string;
    readonly submodules?: readonly {
      readonly path: string;
      readonly name: string;
      readonly remote?: string;
      readonly commit: string;
      readonly branch: string;
      readonly dirty: boolean;
    }[];
    readonly package_roots: readonly {
      readonly path: string;
      readonly name: string;
      readonly language: string;
      readonly manifest: string;
      readonly repo_name?: string;
      readonly submodule_path?: string;
      readonly capabilities: Readonly<Record<string, string>>;
      readonly key_dependencies: readonly string[];
    }[];
  };
  readonly inventory?: {
    readonly summary: {
      readonly total_surfaces: number;
      readonly by_kind: Readonly<Record<string, number>>;
      readonly by_package: Readonly<Record<string, number>>;
    };
    readonly surfaces: readonly ScannedSurface[];
    readonly cross_checks: readonly {
      readonly facet: string;
      readonly spec_count: number;
      readonly code_count: number;
      readonly matched: number;
      readonly spec_only: readonly { readonly normalized_key: string }[];
      readonly code_only: readonly { readonly normalized_key: string }[];
    }[];
  };
}

export interface SpacePayload {
  readonly workspace: WorkspaceSummary;
  readonly project_id: string | null;
  readonly config: {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    readonly repos?: Readonly<Record<string, { readonly path?: string; readonly remote?: string; readonly default_branch?: string }>>;
    readonly teams?: readonly { readonly id: string; readonly name: string; readonly channel?: string }[];
    readonly actors?: readonly { readonly id: string; readonly name: string; readonly summary: string }[];
    readonly organisations?: readonly { readonly id: string; readonly name: string; readonly categories?: readonly string[] }[];
  };
  readonly domains: readonly { readonly id: string; readonly name: string; readonly purpose: string }[];
  readonly systems: readonly LoadedSystem[];
  readonly externals: readonly LoadedExternal[];
  readonly unassigned_stores: readonly StoreFile[];
  readonly unassigned_topics: readonly TopicFile[];
  readonly flows: readonly FlowFile[];
  readonly edges: readonly DerivedEdge[];
  readonly gaps: readonly ModelGap[];
  readonly roles: Readonly<Record<string, readonly string[]>>;
  readonly evidence?: Readonly<Record<string, RepoEvidencePayload>>;
  readonly component_code_info?: Readonly<Record<string, ComponentCodeInfoPayload>>;
  readonly completeness: {
    readonly unclaimed_repos: readonly string[];
    readonly unclaimed_package_roots: readonly string[];
    readonly components: readonly {
      readonly component_id: string;
      readonly system_id: string;
      readonly depth: string;
      readonly accounted_pct: number;
      readonly has_deferred: boolean;
      readonly unpromoted_observed_edges: number;
      readonly orientation?: {
        readonly tier: "compact" | "standard" | "deep";
        readonly orientation_required: boolean;
        readonly has_orientation: boolean;
        readonly zone_count: number;
        readonly significant_modules: number;
        readonly covered_modules: number;
        readonly uncovered_modules: readonly string[];
        readonly coverage_pct: number;
        readonly broken_paths: readonly string[];
      };
    }[];
    readonly summary: {
      readonly total_components: number;
      readonly full_depth: number;
      readonly contract_only_depth: number;
      readonly stub_systems: number;
      readonly total_unaccounted_surfaces: number;
    };
  };
  readonly plans: readonly LoadedPlanPayload[];
}
