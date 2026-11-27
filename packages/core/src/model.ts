import type {
  CiteAnchorsFile,
  ComponentFile,
  ContractsFile,
  DomainDef,
  ExternalFile,
  FlowFile,
  HandlersFile,
  OrientationFile,
  PlanBaseLockFile,
  PlanChangesFile,
  PlanDesignFile,
  PlanExecutionFile,
  PlanManifestFile,
  PlanProgressFile,
  PlanProofFile,
  RepositoryPin,
  ReviewNoteFile,
  ScreensFile,
  SpaceConfig,
  StoreFile,
  StructureEvidence,
  SurfaceInventory,
  SystemFile,
  TopicFile,
} from "@groundwork/schema";

export interface SpaceProblem {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly file?: string;
  readonly entity_id?: string;
  readonly message: string;
}

export interface LoadedComponent {
  readonly id: string; // canonical: service:<slug> or app:<slug>
  readonly slug: string;
  readonly system_id: string;
  readonly dir: string;
  readonly component: ComponentFile;
  readonly contracts: ContractsFile;
  readonly screens: ScreensFile;
  readonly handlers: HandlersFile;
  readonly orientation?: OrientationFile;
}

export interface LoadedSystem {
  readonly id: string; // canonical: system:<slug>
  readonly slug: string;
  readonly dir: string;
  readonly system: SystemFile;
  /** Present for mapped: false stub systems */
  readonly stub_contracts?: ContractsFile;
  readonly components: readonly LoadedComponent[];
  readonly stores: readonly StoreFile[];
  readonly topics: readonly TopicFile[];
}

export interface LoadedExternal {
  readonly id: string; // canonical: external:<slug>
  readonly slug: string;
  readonly external: ExternalFile;
  readonly contracts: ContractsFile;
}

export interface LoadedPlan {
  readonly id: string; // canonical: plan:<slug>
  readonly slug: string;
  readonly dir: string;
  readonly manifest: PlanManifestFile;
  readonly changes: PlanChangesFile;
  readonly additions_systems: readonly LoadedSystem[];
  readonly additions_flows: readonly FlowFile[];
  readonly base_lock?: PlanBaseLockFile;
  readonly design?: PlanDesignFile;
  readonly execution: PlanExecutionFile;
  readonly progress?: PlanProgressFile;
  readonly proof: PlanProofFile;
  readonly reviews: readonly ReviewNoteFile[];
}

export interface RepoEvidence {
  readonly repo_key: string;
  readonly repository: RepositoryPin;
  readonly inventory?: SurfaceInventory;
  readonly anchors?: CiteAnchorsFile;
  readonly structure?: StructureEvidence;
}

export interface SpaceModel {
  readonly root_dir: string;
  readonly config: SpaceConfig;
  readonly domains: readonly DomainDef[];
  readonly systems: readonly LoadedSystem[];
  readonly externals: readonly LoadedExternal[];
  readonly unassigned_stores: readonly StoreFile[];
  readonly unassigned_topics: readonly TopicFile[];
  readonly flows: readonly FlowFile[];
  readonly evidence: Readonly<Record<string, RepoEvidence>>;
  readonly plans: readonly LoadedPlan[];
  readonly problems: readonly SpaceProblem[];
}
