/* Generated from schema/workspace.schema.json by tools/generate-plan-types.ts. Do not edit: run npm run generate. */

export type JsonValue =
  | (null | boolean | number | string)
  | JsonValue[]
  | {
      [k: string]: JsonValue | undefined;
    };
/**
 * @minItems 1
 */
export type AuthoredCites = [string, ...string[]];
export type Cite = CodeRef | EvidenceRef;
/**
 * @minItems 1
 */
export type Cites = [Cite, ...Cite[]];
export type Component = ServiceComponent | AppComponent | StoreComponent | TopicComponent;
export type FieldType =
  | string
  | {
      array: FieldType;
    }
  | {
      map: {
        key: FieldType;
        value: FieldType;
      };
    }
  | {
      /**
       * @minItems 1
       */
      one_of: [FieldType, ...FieldType[]];
    }
  | {
      /**
       * @minItems 1
       */
      enum: [string | number | boolean | null, ...(string | number | boolean | null)[]];
    };
export type Endpoint = RestEntry | GraphqlEntry | GrpcEntry | SdkEntry;
export type Interface = RestInterface | GraphqlInterface | GrpcInterface | SdkInterface;
export type Steps = Step[];
export type HandlersFile = Handler[];
export type Confidence = 'low' | 'medium' | 'high';
/**
 * Canonical authored workspace files. Model and evidence references are resolved by readModel; unknown facts are omitted and reported as gaps. uniqueIds/uniqueChildIds are generic keywords registered by the shared Ajv loader.
 */
export type WorkspaceDocumentDocument =
  | WorkspaceFile
  | DomainFile
  | SystemFile
  | ContractsFile
  | ScreensFile
  | HandlersFile
  | GraphFile
  | LanguageFile
  | DomainLanguageFile
  | TargetFile
  | AliasesFile
  | LibrariesFile
  | ExternalsFile
  | FlowFile
  | JourneyFile
  | LandscapeFile
  | NarrativesFile
  | ProgrammeFile;

/**
 * Schema definition lookup used by the validator’s typed API.
 */
export interface WorkspaceDocumentTypes {
  Id: string;
  ChildId: string;
  ComponentId: string;
  ExecutableId: string;
  SchemaRef: string;
  ScreenRef: string;
  HandlerRef: string;
  EntryRef: string;
  JsonValue: JsonValue;
  AuthoredCite: string;
  AuthoredCites: AuthoredCites;
  CodeHome: CodeHome;
  CodeRef: CodeRef;
  EvidenceRef: EvidenceRef;
  Cite: Cite;
  Cites: Cites;
  Owner: Owner;
  Connection: Connection;
  Relationship: Relationship;
  ServiceComponent: ServiceComponent;
  AppComponent: AppComponent;
  StoreComponent: StoreComponent;
  TopicComponent: TopicComponent;
  Component: Component;
  SystemFile: SystemFile;
  Team: Team;
  Actor: Actor;
  WorkspaceFile: WorkspaceFile;
  DomainFile: DomainFile;
  Library: Library;
  External: External;
  LibrariesFile: LibrariesFile;
  ExternalsFile: ExternalsFile;
  Alias: Alias;
  AliasesFile: AliasesFile;
  FieldType: FieldType;
  Field: Field;
  Schema: Schema;
  RestEntry: RestEntry;
  RestInterface: RestInterface;
  GraphqlEntry: GraphqlEntry;
  GraphqlInterface: GraphqlInterface;
  GrpcEntry: GrpcEntry;
  GrpcInterface: GrpcInterface;
  SdkEntry: SdkEntry;
  SdkInterface: SdkInterface;
  Endpoint: Endpoint;
  Interface: Interface;
  Message: Message;
  Subscription: Subscription;
  Job: Job;
  Interaction: Interaction;
  Operation: Operation;
  ContractsFile: ContractsFile;
  Region: Region;
  Asset: Asset;
  Screen: Screen;
  ScreensFile: ScreensFile;
  Steps: Steps;
  Retry: Retry;
  Lane: Lane;
  Step: Step;
  Failure: Failure;
  Handler: Handler;
  HandlersFile: HandlersFile;
  GraphFile: GraphFile;
  Subgraph: Subgraph;
  Concept: Concept;
  DomainLanguageFile: DomainLanguageFile;
  KeyTerm: KeyTerm;
  LanguageFile: LanguageFile;
  TargetStage: TargetStage;
  TargetShift: TargetShift;
  TargetFile: TargetFile;
  Area: Area;
  LandscapeFile: LandscapeFile;
  FlowFile: FlowFile;
  FlowStep: FlowStep;
  JourneyFile: JourneyFile;
  NarrativesFile: NarrativesFile;
  ProgrammeFile: ProgrammeFile;
  id_team: string;
  id_sys: string;
  id_svc: string;
  id_st: string;
  id_sch: string;
  id_if: string;
  id_api: string;
  id_msg: string;
  id_flow: string;
  id_chg: string;
  id_tst: string;
  id_wi: string;
  id_ms: string;
  id_dec: string;
  id_risk: string;
  id_q: string;
  id_sc: string;
  id_step: string;
  id_field: string;
  id_any: string;
  id_node: string;
  id_via: string;
  id_schemaOrField: string;
  id_walk: string;
  id_versioned: string;
  id_con: string;
  id_stage: string;
  id_ui: string;
  id_uj: string;
  id_scr: string;
  id_region: string;
  id_screenOrRegion: string;
  id_graph: string;
  id_sg: string;
  id_gql: string;
  id_h: string;
  id_req: string;
  id_wi_ref: string;
  id_ms_ref: string;
  id_ms_programme: string;
  id_blocker: string;
  id_proves: string;
  cacheControl: CacheControl;
  cacheUse: CacheUse;
  LandscapeConnection: LandscapeConnection;
  LandscapeRelationship: LandscapeRelationship;
  LandscapeSystemRelationship: LandscapeSystemRelationship;
  LandscapeCollaboration: LandscapeCollaboration;
  LandscapeValueFlow: LandscapeValueFlow;
  LandscapeDetail: LandscapeDetail;
  NarrativeStage: NarrativeStage;
  Narrative: Narrative;
  Confidence: Confidence;
  document: WorkspaceDocumentDocument;
}
export interface CodeHome {
  repo: string;
  path?: string;
}
export interface CodeRef {
  kind: 'code';
  repo: string;
  commit: string;
  path: string;
  /**
   * @minItems 2
   * @maxItems 2
   */
  lines?: [number, number];
  symbol?: string;
}
export interface EvidenceRef {
  kind: 'evidence';
  id: string;
}
export interface Owner {
  id: string;
  cites: AuthoredCites;
}
export interface Connection {
  to: string;
  says: string;
  /**
   * @minItems 1
   */
  backs: [string, ...string[]];
}
export interface Relationship {
  id: string;
  from: string;
  to: string;
  kind: 'call' | 'publish' | 'consume' | 'read' | 'write';
  says: string;
  reason: string;
  cites: AuthoredCites;
}
export interface ServiceComponent {
  id: string;
  kind: 'service';
  name: string;
  does?: string;
  tech?: string;
  /**
   * @minItems 1
   */
  homes?: [string, ...string[]];
  uses?: string[];
  infrastructure?: boolean;
  cites?: AuthoredCites;
}
export interface AppComponent {
  id: string;
  kind: 'app';
  name: string;
  does?: string;
  tech?: string;
  /**
   * @minItems 1
   */
  homes?: [string, ...string[]];
  uses?: string[];
  infrastructure?: boolean;
  cites?: AuthoredCites;
  form?: 'web' | 'mobile' | 'admin';
}
export interface StoreComponent {
  id: string;
  kind: 'store';
  name: string;
  does?: string;
  tech?: string;
  /**
   * @minItems 1
   */
  homes?: [string, ...string[]];
  uses?: string[];
  infrastructure?: boolean;
  cites?: AuthoredCites;
  form?: 'database' | 'cache' | 'bucket' | 'warehouse' | 'vector' | 'managed';
  owner?: Owner;
  notes?: string;
  /**
   * kind: cache: where the layer sits on the cache path (outermost first)
   */
  layer?: 'edge' | 'gateway' | 'subgraph';
  /**
   * kind: cache: whole responses, or per entity per subgraph fetch (Apollo Router entity caching)
   */
  granularity?: 'response' | 'entity';
  /**
   * kind: cache: what the key is made of, in words
   */
  keyed_by?: string;
  /**
   * seconds it may serve stale
   */
  stale?: {
    while_revalidate?: number;
    if_error?: number;
  };
  /**
   * how an entry is emptied (surrogate key per sku, POST /invalidate)
   */
  purge?: string;
  /**
   * events that empty it (a shortcut; a flow step with purges: says who does it)
   */
  invalidated_by?: string[];
  /**
   * measured numbers, not settings
   */
  observed?: {
    hit_ratio?: number;
    latency_ms?: {
      hit?: number;
      miss?: number;
    };
  };
}
export interface TopicComponent {
  id: string;
  kind: 'topic';
  name: string;
  does?: string;
  tech?: string;
  /**
   * @minItems 1
   */
  homes?: [string, ...string[]];
  uses?: string[];
  infrastructure?: boolean;
  cites?: AuthoredCites;
  form?: 'stream' | 'queue';
  owner?: Owner;
  notes?: string;
  /**
   * kind: cache: where the layer sits on the cache path (outermost first)
   */
  layer?: 'edge' | 'gateway' | 'subgraph';
  /**
   * kind: cache: whole responses, or per entity per subgraph fetch (Apollo Router entity caching)
   */
  granularity?: 'response' | 'entity';
  /**
   * kind: cache: what the key is made of, in words
   */
  keyed_by?: string;
  /**
   * seconds it may serve stale
   */
  stale?: {
    while_revalidate?: number;
    if_error?: number;
  };
  /**
   * how an entry is emptied (surrogate key per sku, POST /invalidate)
   */
  purge?: string;
  /**
   * events that empty it (a shortcut; a flow step with purges: says who does it)
   */
  invalidated_by?: string[];
  /**
   * measured numbers, not settings
   */
  observed?: {
    hit_ratio?: number;
    latency_ms?: {
      hit?: number;
      miss?: number;
    };
  };
}
export interface SystemFile {
  id: string;
  name: string;
  purpose?: string;
  team?: string;
  runs_on?: string[];
  mapped?: boolean;
  homes?: Record<string, CodeHome | undefined>;
  components?: Component[];
  connections?: Connection[];
  relationships?: Relationship[];
  cites?: AuthoredCites;
}
export interface Team {
  id: string;
  name: string;
  colour?: number;
  channel?: string;
  handles?: string[];
  partner?: boolean;
  contacts?: {
    name: string;
    role?: string;
  }[];
}
export interface Actor {
  id: string;
  name: string;
  summary?: string;
  uses?: string[];
  customer?: boolean;
}
export interface WorkspaceFile {
  format?: 2;
  id: string;
  name: string;
  description?: string;
  private?: boolean;
  teams?: Team[];
  actors?: Actor[];
}
export interface DomainFile {
  id: string;
  name: string;
  purpose?: string;
  cites?: AuthoredCites;
}
export interface Library {
  id: string;
  name: string;
  does?: string;
  summary?: string;
  cites?: AuthoredCites;
}
export interface External {
  id: string;
  name: string;
  summary?: string;
  cites?: AuthoredCites;
}
export interface LibrariesFile {
  libraries: Library[];
}
export interface ExternalsFile {
  externals: External[];
}
export interface Alias {
  to: string | null;
  reason?: string;
}
export type AliasesFile = Record<string, Alias | undefined>;
export interface Field {
  id: string;
  name: string;
  type?: FieldType;
  required?: boolean;
  key?: boolean;
  unique?: boolean;
  default?: JsonValue;
  note?: string;
  cites?: AuthoredCites;
  args?: Field[];
  /**
   * a reference to another record: sch:* (its key) or sch:*#field
   */
  ref?: string;
  /**
   * the subgraphs that resolve the field; required unless it is a key field
   */
  subgraphs?: string[];
  /**
   * @shareable: two or more subgraphs resolve it
   */
  shareable?: boolean;
  /**
   * @provides: fields of the return type this subgraph can resolve on the same fetch
   */
  provides?: string[];
  /**
   * @requires: fields the gateway must fetch first and send along
   */
  requires?: string[];
  /**
   * @override: this field moves from another subgraph; percent = progressive override (null once the move is contracted)
   */
  override?: {
    from: string;
    percent?: number;
  } | null;
  /**
   * the record fields the owning subgraph reads
   */
  reads?: string[];
  /**
   * an endpoint the resolver calls
   */
  via?: string;
  /**
   * data caches the resolver reads first
   */
  cache?: CacheUse[];
  cache_control?: CacheControl;
  /**
   * who may read it; non-empty makes the field private
   */
  auth?: string;
  /**
   * overrides the subgraph's batching for this field
   */
  batched?: boolean;
  /**
   * registry field usage (evidence for a deprecation)
   */
  usage?: {
    clients?: string[];
    per_day?: string | number;
    last_seen?: string;
    source?: string;
  };
}
/**
 * a cache layer attached to what it caches: on an operation, an edge/gateway override; on a graph field, a data cache the resolver reads first
 */
export interface CacheUse {
  at: string;
  /**
   * seconds; on an operation an override of the derived max-age (give a reason)
   */
  ttl?: number;
  /**
   * what the layer keys on: free text, or { operation: id|hash, variables: all|[names], headers: [names] }
   */
  key?:
    | string
    | {
        operation?: 'id' | 'hash';
        variables?: 'all' | string[];
        headers?: string[];
      };
  /**
   * why the override is acceptable
   */
  reason?: string;
}
/**
 * the cache hint the subgraph returns for the field (@cacheControl)
 */
export interface CacheControl {
  /**
   * seconds
   */
  max_age: number;
  scope?: 'public' | 'private';
}
export interface Schema {
  id: string;
  name?: string;
  kind: 'dto' | 'record' | 'payload' | 'graph-type';
  store?: string;
  table?: string;
  graph?: string;
  root?: 'query' | 'mutation' | 'subscription';
  keys?: JsonValue[];
  summary?: string;
  fields?: Field[];
  cites?: AuthoredCites;
}
export interface RestEntry {
  id: string;
  summary?: string;
  auth?: string;
  idempotent?: boolean;
  request?: string;
  response?: string;
  errors?: {
    status: number | string;
    when?: string;
    schema?: string;
    cites?: AuthoredCites;
  }[];
  sig?: string;
  version?: string;
  supersedes?: string;
  deprecated?: boolean;
  cites?: AuthoredCites;
  method?: string;
  path?: string;
}
export interface RestInterface {
  id: string;
  kind: 'rest';
  name?: string;
  component?: string;
  external?: string;
  version?: string;
  summary?: string;
  subgraph?: string;
  entries?: RestEntry[];
  cites?: AuthoredCites;
}
export interface GraphqlEntry {
  id: string;
  summary?: string;
  auth?: string;
  idempotent?: boolean;
  request?: string;
  response?: string;
  errors?: {
    status: number | string;
    when?: string;
    schema?: string;
    cites?: AuthoredCites;
  }[];
  sig?: string;
  version?: string;
  supersedes?: string;
  deprecated?: boolean;
  cites?: AuthoredCites;
  field?: string;
  signature?: string;
}
export interface GraphqlInterface {
  id: string;
  kind: 'graphql';
  name?: string;
  component?: string;
  external?: string;
  version?: string;
  summary?: string;
  subgraph?: string;
  entries?: GraphqlEntry[];
  cites?: AuthoredCites;
}
export interface GrpcEntry {
  id: string;
  summary?: string;
  auth?: string;
  idempotent?: boolean;
  request?: string;
  response?: string;
  errors?: {
    status: number | string;
    when?: string;
    schema?: string;
    cites?: AuthoredCites;
  }[];
  sig?: string;
  version?: string;
  supersedes?: string;
  deprecated?: boolean;
  cites?: AuthoredCites;
  rpc?: string;
}
export interface GrpcInterface {
  id: string;
  kind: 'grpc';
  name?: string;
  component?: string;
  external?: string;
  version?: string;
  summary?: string;
  subgraph?: string;
  entries?: GrpcEntry[];
  cites?: AuthoredCites;
}
export interface SdkEntry {
  id: string;
  summary?: string;
  auth?: string;
  idempotent?: boolean;
  request?: string;
  response?: string;
  errors?: {
    status: number | string;
    when?: string;
    schema?: string;
    cites?: AuthoredCites;
  }[];
  sig?: string;
  version?: string;
  supersedes?: string;
  deprecated?: boolean;
  cites?: AuthoredCites;
  call?: string;
}
export interface SdkInterface {
  id: string;
  kind: 'sdk';
  name?: string;
  component?: string;
  external?: string;
  version?: string;
  summary?: string;
  subgraph?: string;
  entries?: SdkEntry[];
  cites?: AuthoredCites;
}
export interface Message {
  id: string;
  name?: string;
  topic: string;
  payload?: string;
  key?: string;
  semantics?: 'event' | 'command' | 'state';
  summary?: string;
  version?: string;
  supersedes?: string;
  cites?: AuthoredCites;
}
export interface Subscription {
  id: string;
  component: string;
  message: string;
  group?: string;
  when?: string;
  concurrency?: number;
  delivery?: {
    retries?: number;
    dead_letter?: string;
  };
  cites?: AuthoredCites;
}
export interface Job {
  id: string;
  component: string;
  name?: string;
  every?: string;
  cron?: string;
  trigger?: string;
  when?: string;
  cites?: AuthoredCites;
}
export interface Interaction {
  id: string;
  component: string;
  name?: string;
  on: string;
  action: string;
  to?: string;
  effect?: string;
  summary?: string;
  cites?: AuthoredCites;
}
export interface Operation {
  id: string;
  component: string;
  name?: string;
  kind?: 'query' | 'mutation' | 'subscription';
  graph: string;
  document: string;
  screens?: string[];
  variables?: JsonValue;
  summary?: string;
  cites?: AuthoredCites;
}
export interface ContractsFile {
  interfaces?: Interface[];
  messages?: Message[];
  subscriptions?: Subscription[];
  jobs?: Job[];
  interactions?: Interaction[];
  operations?: Operation[];
  schemas?: Schema[];
}
export interface Region {
  id: string;
  name: string;
  summary?: string;
  cites?: AuthoredCites;
}
export interface Asset {
  figma?: string;
  file?: string;
  region?: string;
  label?: string;
}
export interface Screen {
  id: string;
  app: string;
  name: string;
  kind?: 'page' | 'modal' | 'sheet' | 'print' | 'email';
  device?: string;
  route?: string;
  summary?: string;
  regions?: Region[];
  assets?: Asset[];
  cites?: AuthoredCites;
}
export interface ScreensFile {
  screens: Screen[];
}
export interface Step {
  id: string;
  say?: string;
  does?: string;
  read?: string;
  from?: string;
  write?: string;
  to?: string;
  call?: string;
  publish?: string;
  wait?: string;
  return?: number | string;
  if?: string;
  then?: Steps;
  else?: Steps;
  each?: string;
  steps?: Steps;
  /**
   * @minItems 1
   */
  parallel?: [Lane, ...Lane[]];
  try?: Steps;
  catch?: Steps;
  finally?: Steps;
  transaction?: true;
  retry?: Retry;
  when?: string;
  async?: boolean;
  causes?: string;
  cites?: AuthoredCites;
}
export interface Lane {
  lane?: string;
  steps: Steps;
}
export interface Retry {
  until: string;
  times?: number;
  exhausted?: Steps;
}
export interface Failure {
  id: string;
  when: string;
  return: number | string;
  cites: AuthoredCites;
}
export interface Handler {
  id: string;
  component: string;
  on: string;
  summary?: string;
  steps: Steps;
  failures?: Failure[];
  cites?: AuthoredCites;
}
export interface GraphFile {
  id: string;
  name: string;
  gateway?: string;
  registry?: string;
  summary?: string;
  subgraphs?: Subgraph[];
  composition?: JsonValue;
  federation?: JsonValue;
  cites?: AuthoredCites;
}
export interface Subgraph {
  id: string;
  name?: string;
  graph: string;
  /**
   * markdown; may cite [[id]]
   */
  summary?: string;
  /**
   * request-scoped batching of entity lookups; none makes a list fetch an N+1
   */
  batching?: 'dataloader' | 'none';
  /**
   * numbers from monitoring, not settings
   */
  observed?: {
    /**
     * p50 of one fetch to this subgraph, in ms (a measurement, not a setting); lets the waterfall draw bars to scale
     */
    latency_ms?: number;
    source?: string;
  };
  /**
   * seconds; the max-age a field without a hint takes (0 = uncacheable)
   */
  cache_control_default?: number;
  timeout_ms?: number;
  component: string;
  cites?: AuthoredCites;
}
export interface Concept {
  id: string;
  /**
   * the business word, singular (Order line)
   */
  name: string;
  /**
   * other words that mean the same thing in prose; the plural of name is added automatically
   */
  terms?: string[];
  /**
   * markdown; what it is in business terms. The first sentence is the tooltip. May cite [[id]]
   */
  means?: string;
  /**
   * the system of record: where its id is minted
   */
  born_in?: string;
  part_of?: string;
  relates?: {
    to: string;
    /**
     * verb phrase read as '<name> <as> <to>', e.g. 'is selected by'
     */
    as: string;
  }[];
  /**
   * what each system calls it
   */
  aka?: {
    in: string;
    /**
     * the local name
     */
    as: string;
    /**
     * the schema, field or store that holds it
     */
    at?: string;
    /**
     * markdown; may cite [[id]]
     */
    note?: string;
  }[];
  /**
   * set when the plan introduces the concept
   */
  introduced_by?: string[];
  cites?: AuthoredCites;
}
export interface DomainLanguageFile {
  summary?: string;
  concepts?: Concept[];
}
export interface KeyTerm {
  id: string;
  name: string;
  group?: string;
  aliases?: string[];
  means: string;
  examples?: {
    context: 'everyday' | 'company';
    analogy?: string;
    sentence?: string;
  }[];
  relates?: {
    to: string;
    as: string;
  }[];
  anchors?: {
    to: string;
    fit: 'same' | 'close' | 'renamed' | 'clash' | 'lives-in';
    note?: string;
  }[];
}
export interface LanguageFile {
  summary?: string;
  source?: {
    title: string;
    url?: string;
    status?: string;
  };
  groups?: {
    id: string;
    name: string;
  }[];
  terms?: KeyTerm[];
}
export interface TargetStage {
  id: string;
  name: string;
  term?: string;
  owners?: string[];
  summary?: string;
  from?: string[];
}
export interface TargetShift {
  id: string;
  name: string;
  today?: string;
  target?: string;
  cites?: string[];
}
export interface TargetFile {
  summary?: string;
  stages?: TargetStage[];
  shifts?: TargetShift[];
}
export interface Area {
  id: string;
  name: string;
  purpose: string;
  activities?: string[];
  boundary?: string;
  confidence?: Confidence;
  evidence_count?: number;
}
export interface LandscapeFile {
  format?: 2;
  label?: 'Inferred';
  reviewed?: string;
  scope?: string;
  limitation?: string;
  areas: Area[];
  relationships?: LandscapeRelationship[];
  details?: LandscapeDetail[];
}
export interface LandscapeRelationship {
  id: string;
  from: string;
  to: string;
  label: string;
  kind: 'exchange' | 'transition' | 'support';
}
export interface LandscapeDetail {
  area: string;
  valueFlow?: LandscapeValueFlow;
  /**
   * @minItems 1
   */
  systems: [string, ...string[]];
  relationships: LandscapeSystemRelationship[];
  collaborations: LandscapeCollaboration[];
}
export interface LandscapeValueFlow {
  title: string;
  summary: string;
  confidence: Confidence;
  reasoning: string;
  limitations: string[];
  /**
   * @minItems 1
   */
  bands: [
    {
      id: string;
      title: string;
      summary: string;
      /**
       * @minItems 1
       */
      nodes: [
        {
          component: string;
          column: number;
        },
        ...{
          component: string;
          column: number;
        }[],
      ];
    },
    ...{
      id: string;
      title: string;
      summary: string;
      /**
       * @minItems 1
       */
      nodes: [
        {
          component: string;
          column: number;
        },
        ...{
          component: string;
          column: number;
        }[],
      ];
    }[],
  ];
  connections: LandscapeConnection[];
  /**
   * @minItems 1
   */
  columns?: [
    {
      system: string;
      column: number;
    },
    ...{
      system: string;
      column: number;
    }[],
  ];
  summaries?: LandscapeConnection[];
  overview?: LandscapeConnection[];
}
export interface LandscapeConnection {
  from: string;
  to: string;
  label: string;
  kind: 'api' | 'message' | 'data';
  cites: AuthoredCites;
}
export interface LandscapeSystemRelationship {
  id: string;
  from: string;
  to: string;
  label: string;
  kind: 'api' | 'message' | 'data';
  detail: string;
}
export interface LandscapeCollaboration {
  id: string;
  name: string;
  summary: string;
  /**
   * @minItems 2
   */
  systems: [string, string, ...string[]];
}
export interface FlowFile {
  id: string;
  name: string;
  actor?: string;
  /**
   * markdown; may cite [[id]]
   */
  trigger?: string;
  /**
   * markdown; may cite [[id]]
   */
  outcome?: string;
  steps: FlowStep[];
  cites?: AuthoredCites;
}
export interface FlowStep {
  id: string;
  from: string;
  to: string;
  via: string;
  action: string;
  /**
   * markdown; may cite [[id]]
   */
  logic?: string;
  reads?: string[];
  writes?: string[];
  /**
   * markdown; may cite [[id]]
   */
  fails?: string;
  beat?: string;
  /**
   * the screen (or region) the person is on when this step happens; makes the flow a UI journey
   */
  screen?: string;
  /**
   * via gql: only: which cache case the flow narrates (hit = the outermost layer answers; miss = it misses and the next answers; cold = every layer misses)
   */
  case?: 'hit' | 'miss' | 'cold';
  /**
   * cache stores this step empties (the acting service must own them or have access)
   */
  purges?: string[];
  handler_step?: string;
  cites?: AuthoredCites;
}
export interface JourneyFile {
  id: string;
  name: string;
  actor?: string;
  interactions?: string[];
  flows?: string[];
  summary?: string;
  cites?: AuthoredCites;
}
export interface NarrativesFile {
  format?: 2;
  label: 'Inferred';
  authored: string;
  generator: string;
  basis: string;
  /**
   * @minItems 1
   */
  stories: [Narrative, ...Narrative[]];
}
export interface Narrative {
  id: string;
  name: string;
  summary: string;
  confidence: Confidence;
  reasoning: string;
  limitations: string[];
  connections?: LandscapeConnection[];
  relatedSystems?: string[];
  /**
   * @minItems 2
   * @maxItems 8
   */
  stages:
    | [NarrativeStage, NarrativeStage]
    | [NarrativeStage, NarrativeStage, NarrativeStage]
    | [NarrativeStage, NarrativeStage, NarrativeStage, NarrativeStage]
    | [NarrativeStage, NarrativeStage, NarrativeStage, NarrativeStage, NarrativeStage]
    | [
        NarrativeStage,
        NarrativeStage,
        NarrativeStage,
        NarrativeStage,
        NarrativeStage,
        NarrativeStage,
      ]
    | [
        NarrativeStage,
        NarrativeStage,
        NarrativeStage,
        NarrativeStage,
        NarrativeStage,
        NarrativeStage,
        NarrativeStage,
      ]
    | [
        NarrativeStage,
        NarrativeStage,
        NarrativeStage,
        NarrativeStage,
        NarrativeStage,
        NarrativeStage,
        NarrativeStage,
        NarrativeStage,
      ];
}
export interface NarrativeStage {
  component: string;
  title: string;
  summary: string;
  supporting: string[];
  cites: AuthoredCites;
}
export interface ProgrammeFile {
  id: string;
  title: string;
  outcome: string;
  problem?: Planproblem;
  scenarios?: Planscenario[];
  decisions?: Plandecision[];
  questions?: Planquestion[];
  milestones?: Planmilestone[];
}
export interface Planproblem {
  /**
   * markdown; may cite [[id]]
   */
  summary: string;
  /**
   * markdown; may cite [[id]]
   */
  why?: string;
  goals?: string[];
  non_goals?: string[];
  metrics?: Planmetric[];
  scenarios?: Planscenario[];
  glossary?: PlanglossaryEntry[];
}
export interface Planmetric {
  name: string;
  today?: string;
  target?: string;
}
export interface Planscenario {
  id: string;
  title: string;
  /**
   * markdown; may cite [[id]]
   */
  story?: string;
  flows?: string[];
}
export interface PlanglossaryEntry {
  term: string;
  /**
   * markdown; may cite [[id]]
   */
  means: string;
}
export interface Plandecision {
  id: string;
  title: string;
  /**
   * deferred: deliberately left until after this plan; set decide_by as the date to revisit it
   */
  status: 'proposed' | 'accepted' | 'deferred' | 'rejected' | 'superseded';
  /**
   * the one team accountable for the call
   */
  decider?: string;
  /**
   * when a proposed decision must be accepted; when a deferred one is revisited
   */
  decide_by?: string;
  /**
   * when it was accepted or rejected
   */
  decided_on?: string;
  /**
   * one-way: costly or impossible to undo once shipped; two-way: can be changed later at low cost
   */
  reversibility?: 'one-way' | 'two-way';
  /**
   * decisions this one replaces (they are marked superseded)
   */
  supersedes?: string[];
  /**
   * markdown; may cite [[id]]
   */
  context?: string;
  /**
   * markdown; may cite [[id]]
   */
  decision?: string;
  /**
   * markdown; may cite [[id]]
   */
  consequences?: string;
  options?: Planoption[];
  cites?: AuthoredCites;
}
export interface Planoption {
  name: string;
  /**
   * markdown; may cite [[id]]
   */
  why_not?: string;
}
export interface Planquestion {
  id: string;
  /**
   * markdown; may cite [[id]]
   */
  question: string;
  decider?: string;
  decide_by?: string;
  status: 'open' | 'resolved';
  /**
   * markdown; may cite [[id]]
   */
  answer?: string;
  blocks?: string[];
  cites?: AuthoredCites;
  /**
   * the decision that answers this question; the question stays open until that decision is accepted
   */
  answered_by?: string;
}
export interface Planmilestone {
  id: string;
  name: string;
  /**
   * markdown; may cite [[id]]
   */
  exit?: string;
  /**
   * target date for the milestone exit (YYYY-MM-DD)
   */
  due?: string;
  /**
   * milestones that come first, here or in another plan
   */
  after?: string[];
  serves?: string;
}
