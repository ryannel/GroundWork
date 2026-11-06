/* Generated from schema/plan.schema.json by tools/generate-plan-types.ts. Do not edit: run npm run generate. */

export type AddOp =
  | {
      add: 'domain';
      into?: string;
      after?: string;
      value: WorkspaceDomainFile;
    }
  | {
      add: 'system';
      into: string;
      after?: string;
      value: WorkspaceSystemFile;
    }
  | {
      add: 'component';
      into: string;
      after?: string;
      value: WorkspaceComponent;
    }
  | {
      add: 'library';
      into?: string;
      after?: string;
      value: WorkspaceLibrary;
    }
  | {
      add: 'external';
      into?: string;
      after?: string;
      value: WorkspaceExternal;
    }
  | {
      add: 'team';
      into?: string;
      after?: string;
      value: WorkspaceTeam;
    }
  | {
      add: 'actor';
      into?: string;
      after?: string;
      value: WorkspaceActor;
    }
  | {
      add: 'area';
      into?: string;
      after?: string;
      value: WorkspaceArea;
    }
  | {
      add: 'interface';
      into: string;
      after?: string;
      value: WorkspaceInterface;
    }
  | {
      add: 'endpoint';
      into: string;
      after?: string;
      value: WorkspaceEndpoint;
    }
  | {
      add: 'message';
      into: string;
      after?: string;
      value: WorkspaceMessage;
    }
  | {
      add: 'subscription';
      into: string;
      after?: string;
      value: WorkspaceSubscription;
    }
  | {
      add: 'job';
      into: string;
      after?: string;
      value: WorkspaceJob;
    }
  | {
      add: 'interaction';
      into: string;
      after?: string;
      value: WorkspaceInteraction;
    }
  | {
      add: 'operation';
      into: string;
      after?: string;
      value: WorkspaceOperation;
    }
  | {
      add: 'schema';
      into: string;
      after?: string;
      value: WorkspaceSchema;
    }
  | {
      add: 'screen';
      into: string;
      after?: string;
      value: WorkspaceScreen;
    }
  | {
      add: 'handler';
      into: string;
      after?: string;
      value: WorkspaceHandler;
    }
  | {
      add: 'relationship';
      into: string;
      after?: string;
      value: WorkspaceRelationship;
    }
  | {
      add: 'graph';
      into?: string;
      after?: string;
      value: WorkspaceGraphFile;
    }
  | {
      add: 'subgraph';
      into: string;
      after?: string;
      value: WorkspaceSubgraph;
    }
  | {
      add: 'flow';
      into?: string;
      after?: string;
      value: WorkspaceFlowFile;
    }
  | {
      add: 'journey';
      into?: string;
      after?: string;
      value: WorkspaceJourneyFile;
    }
  | {
      add: 'programme';
      into?: string;
      after?: string;
      value: WorkspaceProgrammeFile;
    }
  | {
      add: 'concept';
      into: string;
      after?: string;
      value: WorkspaceConcept;
    }
  | {
      add: 'keyTerm';
      into?: string;
      after?: string;
      value: WorkspaceKeyTerm;
    }
  | {
      add: 'field';
      into: string;
      after?: string;
      value: WorkspaceField;
    }
  | {
      add: 'region';
      into: string;
      after?: string;
      value: WorkspaceRegion;
    }
  | {
      add: 'failure';
      into: string;
      after?: string;
      value: WorkspaceFailure;
    }
  | {
      add: 'step';
      into: string;
      after?: string;
      value: WorkspaceStep | WorkspaceFlowStep;
    };
/**
 * @minItems 1
 */
export type WorkspaceAuthoredCites = [string, ...string[]];
export type WorkspaceComponent =
  | WorkspaceServiceComponent
  | WorkspaceAppComponent
  | WorkspaceStoreComponent
  | WorkspaceTopicComponent;
export type WorkspaceConfidence = 'low' | 'medium' | 'high';
export type WorkspaceInterface =
  | WorkspaceRestInterface
  | WorkspaceGraphqlInterface
  | WorkspaceGrpcInterface
  | WorkspaceSdkInterface;
export type WorkspaceEndpoint =
  WorkspaceRestEntry | WorkspaceGraphqlEntry | WorkspaceGrpcEntry | WorkspaceSdkEntry;
export type WorkspaceJsonValue =
  | (null | boolean | number | string)
  | WorkspaceJsonValue[]
  | {
      [k: string]: WorkspaceJsonValue | undefined;
    };
export type WorkspaceFieldType =
  | string
  | {
      array: WorkspaceFieldType;
    }
  | {
      map: {
        key: WorkspaceFieldType;
        value: WorkspaceFieldType;
      };
    }
  | {
      /**
       * @minItems 1
       */
      one_of: [WorkspaceFieldType, ...WorkspaceFieldType[]];
    }
  | {
      /**
       * @minItems 1
       */
      enum: [string | number | boolean | null, ...(string | number | boolean | null)[]];
    };
export type WorkspaceSteps = WorkspaceStep[];
export type Op = AddOp | ModifyOp | DeprecateOp | RemoveOp;
export type Level3 = 'low' | 'med' | 'high';

/**
 * Schema definition lookup used by the validator’s typed API.
 */
export interface CanonicalPlanTypes {
  AddOp: AddOp;
  ModifyOp: ModifyOp;
  DeprecateOp: DeprecateOp;
  RemoveOp: RemoveOp;
  op: Op;
  change: Change;
  decision: Decision;
  execution: Execution;
  meta: Meta;
  milestone: Milestone;
  problem: Problem;
  question: Question;
  risk: Risk;
  story: Story;
  test: Test;
  workItem: WorkItem;
  chapter: Chapter;
  date: string;
  glossaryEntry: GlossaryEntry;
  id_blocker: string;
  id_chg: string;
  id_dec: string;
  id_ms: string;
  id_ms_programme: string;
  id_ms_ref: string;
  id_proves: string;
  id_q: string;
  id_risk: string;
  id_team: string;
  id_tst: string;
  id_walk: string;
  id_wi: string;
  id_wi_ref: string;
  level3: Level3;
  metric: Metric;
  option: Option;
  requirement: Requirement;
  scenario: Scenario;
  slug: string;
  id_flow: string;
  id_req: string;
  id_sc: string;
  document: CanonicalPlanDocument;
}
export interface WorkspaceDomainFile {
  id: string;
  name: string;
  purpose?: string;
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceSystemFile {
  id: string;
  name: string;
  purpose?: string;
  team?: string;
  runs_on?: string[];
  mapped?: boolean;
  homes?: Record<string, WorkspaceCodeHome | undefined>;
  components?: WorkspaceComponent[];
  connections?: WorkspaceConnection[];
  relationships?: WorkspaceRelationship[];
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceCodeHome {
  repo: string;
  path?: string;
}
export interface WorkspaceServiceComponent {
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
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceAppComponent {
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
  cites?: WorkspaceAuthoredCites;
  form?: 'web' | 'mobile' | 'admin';
}
export interface WorkspaceStoreComponent {
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
  cites?: WorkspaceAuthoredCites;
  form?: 'database' | 'cache' | 'bucket' | 'warehouse' | 'vector' | 'managed';
  owner?: WorkspaceOwner;
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
export interface WorkspaceOwner {
  id: string;
  cites: WorkspaceAuthoredCites;
}
export interface WorkspaceTopicComponent {
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
  cites?: WorkspaceAuthoredCites;
  form?: 'stream' | 'queue';
  owner?: WorkspaceOwner;
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
export interface WorkspaceConnection {
  to: string;
  says: string;
  /**
   * @minItems 1
   */
  backs: [string, ...string[]];
}
export interface WorkspaceRelationship {
  id: string;
  from: string;
  to: string;
  kind: 'call' | 'publish' | 'consume' | 'read' | 'write';
  says: string;
  reason: string;
  cites: WorkspaceAuthoredCites;
}
export interface WorkspaceLibrary {
  id: string;
  name: string;
  does?: string;
  summary?: string;
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceExternal {
  id: string;
  name: string;
  summary?: string;
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceTeam {
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
export interface WorkspaceActor {
  id: string;
  name: string;
  summary?: string;
  uses?: string[];
  customer?: boolean;
}
export interface WorkspaceArea {
  id: string;
  name: string;
  purpose: string;
  activities?: string[];
  boundary?: string;
  confidence?: WorkspaceConfidence;
  evidence_count?: number;
}
export interface WorkspaceRestInterface {
  id: string;
  kind: 'rest';
  name?: string;
  component?: string;
  external?: string;
  version?: string;
  summary?: string;
  subgraph?: string;
  entries?: WorkspaceRestEntry[];
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceRestEntry {
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
    cites?: WorkspaceAuthoredCites;
  }[];
  sig?: string;
  version?: string;
  supersedes?: string;
  deprecated?: boolean;
  cites?: WorkspaceAuthoredCites;
  method?: string;
  path?: string;
}
export interface WorkspaceGraphqlInterface {
  id: string;
  kind: 'graphql';
  name?: string;
  component?: string;
  external?: string;
  version?: string;
  summary?: string;
  subgraph?: string;
  entries?: WorkspaceGraphqlEntry[];
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceGraphqlEntry {
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
    cites?: WorkspaceAuthoredCites;
  }[];
  sig?: string;
  version?: string;
  supersedes?: string;
  deprecated?: boolean;
  cites?: WorkspaceAuthoredCites;
  field?: string;
  signature?: string;
}
export interface WorkspaceGrpcInterface {
  id: string;
  kind: 'grpc';
  name?: string;
  component?: string;
  external?: string;
  version?: string;
  summary?: string;
  subgraph?: string;
  entries?: WorkspaceGrpcEntry[];
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceGrpcEntry {
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
    cites?: WorkspaceAuthoredCites;
  }[];
  sig?: string;
  version?: string;
  supersedes?: string;
  deprecated?: boolean;
  cites?: WorkspaceAuthoredCites;
  rpc?: string;
}
export interface WorkspaceSdkInterface {
  id: string;
  kind: 'sdk';
  name?: string;
  component?: string;
  external?: string;
  version?: string;
  summary?: string;
  subgraph?: string;
  entries?: WorkspaceSdkEntry[];
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceSdkEntry {
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
    cites?: WorkspaceAuthoredCites;
  }[];
  sig?: string;
  version?: string;
  supersedes?: string;
  deprecated?: boolean;
  cites?: WorkspaceAuthoredCites;
  call?: string;
}
export interface WorkspaceMessage {
  id: string;
  name?: string;
  topic: string;
  payload?: string;
  key?: string;
  semantics?: 'event' | 'command' | 'state';
  summary?: string;
  version?: string;
  supersedes?: string;
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceSubscription {
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
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceJob {
  id: string;
  component: string;
  name?: string;
  every?: string;
  cron?: string;
  trigger?: string;
  when?: string;
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceInteraction {
  id: string;
  component: string;
  name?: string;
  on: string;
  action: string;
  to?: string;
  effect?: string;
  summary?: string;
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceOperation {
  id: string;
  component: string;
  name?: string;
  kind?: 'query' | 'mutation' | 'subscription';
  graph: string;
  document: string;
  screens?: string[];
  variables?: WorkspaceJsonValue;
  summary?: string;
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceSchema {
  id: string;
  name?: string;
  kind: 'dto' | 'record' | 'payload' | 'graph-type';
  store?: string;
  table?: string;
  graph?: string;
  root?: 'query' | 'mutation' | 'subscription';
  keys?: WorkspaceJsonValue[];
  summary?: string;
  fields?: WorkspaceField[];
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceField {
  id: string;
  name: string;
  type?: WorkspaceFieldType;
  required?: boolean;
  key?: boolean;
  unique?: boolean;
  default?: WorkspaceJsonValue;
  note?: string;
  cites?: WorkspaceAuthoredCites;
  args?: WorkspaceField[];
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
  cache?: WorkspacecacheUse[];
  cache_control?: WorkspacecacheControl;
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
export interface WorkspacecacheUse {
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
export interface WorkspacecacheControl {
  /**
   * seconds
   */
  max_age: number;
  scope?: 'public' | 'private';
}
export interface WorkspaceScreen {
  id: string;
  app: string;
  name: string;
  kind?: 'page' | 'modal' | 'sheet' | 'print' | 'email';
  device?: string;
  route?: string;
  summary?: string;
  regions?: WorkspaceRegion[];
  assets?: WorkspaceAsset[];
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceRegion {
  id: string;
  name: string;
  summary?: string;
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceAsset {
  figma?: string;
  file?: string;
  region?: string;
  label?: string;
}
export interface WorkspaceHandler {
  id: string;
  component: string;
  on: string;
  summary?: string;
  steps: WorkspaceSteps;
  failures?: WorkspaceFailure[];
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceStep {
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
  then?: WorkspaceSteps;
  else?: WorkspaceSteps;
  each?: string;
  steps?: WorkspaceSteps;
  /**
   * @minItems 1
   */
  parallel?: [WorkspaceLane, ...WorkspaceLane[]];
  try?: WorkspaceSteps;
  catch?: WorkspaceSteps;
  finally?: WorkspaceSteps;
  transaction?: true;
  retry?: WorkspaceRetry;
  when?: string;
  async?: boolean;
  causes?: string;
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceLane {
  lane?: string;
  steps: WorkspaceSteps;
}
export interface WorkspaceRetry {
  until: string;
  times?: number;
  exhausted?: WorkspaceSteps;
}
export interface WorkspaceFailure {
  id: string;
  when: string;
  return: number | string;
  cites: WorkspaceAuthoredCites;
}
export interface WorkspaceGraphFile {
  id: string;
  name: string;
  gateway?: string;
  registry?: string;
  summary?: string;
  subgraphs?: WorkspaceSubgraph[];
  composition?: WorkspaceJsonValue;
  federation?: WorkspaceJsonValue;
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceSubgraph {
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
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceFlowFile {
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
  steps: WorkspaceFlowStep[];
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceFlowStep {
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
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceJourneyFile {
  id: string;
  name: string;
  actor?: string;
  interactions?: string[];
  flows?: string[];
  summary?: string;
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceProgrammeFile {
  id: string;
  title: string;
  outcome: string;
  problem?: Problem;
  scenarios?: Scenario[];
  decisions?: Decision[];
  questions?: Question[];
  milestones?: Milestone[];
}
export interface Problem {
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
  metrics?: Metric[];
  scenarios?: Scenario[];
  glossary?: GlossaryEntry[];
}
export interface Metric {
  name: string;
  today?: string;
  target?: string;
}
export interface Scenario {
  id: string;
  title: string;
  /**
   * markdown; may cite [[id]]
   */
  story?: string;
  flows?: string[];
}
export interface GlossaryEntry {
  term: string;
  /**
   * markdown; may cite [[id]]
   */
  means: string;
}
export interface Decision {
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
  options?: Option[];
  cites?: WorkspaceAuthoredCites;
}
export interface Option {
  name: string;
  /**
   * markdown; may cite [[id]]
   */
  why_not?: string;
}
export interface Question {
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
  cites?: WorkspaceAuthoredCites;
  /**
   * the decision that answers this question; the question stays open until that decision is accepted
   */
  answered_by?: string;
}
export interface Milestone {
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
export interface WorkspaceConcept {
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
  cites?: WorkspaceAuthoredCites;
}
export interface WorkspaceKeyTerm {
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
export interface ModifyOp {
  modify: string;
  set?: Record<string, WorkspaceJsonValue | undefined>;
  append?: Record<string, WorkspaceJsonValue[] | undefined>;
  drop?: Record<string, WorkspaceJsonValue[] | undefined>;
}
export interface DeprecateOp {
  deprecate: string;
  replaced_by?: string;
  reason?: string;
}
export interface RemoveOp {
  remove: string;
  reason?: string;
}
export interface Change {
  id: string;
  title: string;
  /**
   * markdown; may cite [[id]]
   */
  why?: string;
  decisions?: string[];
  /**
   * markdown; may cite [[id]]
   */
  rollout?: string;
  requires?: Requirement[];
  /**
   * the questions or decisions that hold the change back
   */
  blocked_by?: string[];
  /**
   * may be empty or left out only while the change has requires and an open question in blocked_by
   */
  ops?: Op[];
  cites?: WorkspaceAuthoredCites;
}
/**
 * what the change must make true, said before (or without) the ops that make it
 */
export interface Requirement {
  id: string;
  /**
   * markdown; may cite [[id]]
   */
  text: string;
  cites?: WorkspaceAuthoredCites;
}
/**
 * Plain-language account of how the plan plays out; chapter 4 opens on it (How it plays out).
 */
export interface Execution {
  /**
   * markdown; explain how the design works, including what stays unchanged
   */
  summary: string;
  /**
   * @minItems 1
   */
  paths: [
    {
      name: string;
      /**
       * markdown; the condition or outcome of this path
       */
      summary?: string;
      /**
       * @minItems 2
       */
      steps: [
        {
          label: string;
          /**
           * markdown; may cite [[id]]
           */
          detail: string;
        },
        {
          label: string;
          /**
           * markdown; may cite [[id]]
           */
          detail: string;
        },
        ...{
          label: string;
          /**
           * markdown; may cite [[id]]
           */
          detail: string;
        }[],
      ];
    },
    ...{
      name: string;
      /**
       * markdown; the condition or outcome of this path
       */
      summary?: string;
      /**
       * @minItems 2
       */
      steps: [
        {
          label: string;
          /**
           * markdown; may cite [[id]]
           */
          detail: string;
        },
        {
          label: string;
          /**
           * markdown; may cite [[id]]
           */
          detail: string;
        },
        ...{
          label: string;
          /**
           * markdown; may cite [[id]]
           */
          detail: string;
        }[],
      ];
    }[],
  ];
  /**
   * Items: markdown; a material limitation or unresolved implementation detail
   */
  caveats?: string[];
}
export interface Meta {
  id: string;
  title: string;
  version?: string;
  date?: string;
  /**
   * when delivery starts (YYYY-MM-DD); milestone due dates count from here
   */
  start?: string;
  /**
   * the plan's lifecycle: draft, review, approved (the teams agreed). 'committed' is the old name for approved and still reads as it, with a warning
   */
  status?: 'draft' | 'review' | 'approved' | 'committed';
  /**
   * the revision ledger: one entry per proposed revision, oldest first; the newest approved entry is the canonical plan, snapshotted at plans/<slug>/revisions/<version>.yaml (tools/revision.mjs)
   */
  revisions?: {
    /**
     * major.minor, e.g. 1.1; a scope change (goals, non-goals, milestones) is a new major
     */
    version: string;
    status: 'proposed' | 'approved' | 'rejected';
    /**
     * when proposed (YYYY-MM-DD)
     */
    date: string;
    /**
     * one line: what this revision changes and why it is proposed
     */
    summary?: string;
    /**
     * the proposer's reasoning in two or three sentences: what is wrong without it and why this way; the revision page leads with it
     */
    why?: string;
    /**
     * the proposer's word on what happens to work items the revision touches; the page infers the rest and marks it as inferred
     */
    work?: {
      /**
       * the work item
       */
      item: string;
      /**
       * rework: it changes (reopened when done); keep: it stands as it is; drop: it goes; new: it is added
       */
      action: 'rework' | 'keep' | 'drop' | 'new';
      /**
       * what changes for it, in a sentence
       */
      note?: string;
    }[];
    /**
     * who proposes it: team ids (team:…) or names
     */
    by?: string[];
    /**
     * the pull request that proposed it
     */
    pr?: number;
    approved_on?: string;
    /**
     * a GitHub handle such as @ryannel: whoever merged the pull request. One person answers for it; there is no sign-off across teams
     */
    approved_by?: string;
    rejected_on?: string;
    /**
     * a GitHub handle such as @ryannel: whoever closed the pull request
     */
    rejected_by?: string;
    /**
     * why it was approved or rejected, in a sentence or two; a rejection without one leaves the history unexplained
     */
    reason?: string;
    /**
     * the pull request that approved or rejected it; leave it out when that is the pull request that proposed it (`pr`)
     */
    approval_pr?: number;
  }[];
  authors?: string[];
  appetite?: string;
  /**
   * GitHub repos in scope, "org/name"; discovery starts here
   */
  repos?: string[];
  programme?: string;
}
export interface Risk {
  id: string;
  /**
   * markdown; may cite [[id]]
   */
  statement: string;
  likelihood?: Level3;
  impact?: Level3;
  roam?: 'resolved' | 'owned' | 'accepted' | 'mitigated';
  owner?: string;
  /**
   * markdown; may cite [[id]]
   */
  mitigation?: string;
  about?: string[];
  cites?: WorkspaceAuthoredCites;
  /**
   * with roam: accepted, the decision that knowingly accepts this risk as a trade-off
   */
  accepted_by?: string;
}
export interface Story {
  chapters?: {
    why?: Chapter;
    today?: Chapter;
    runs?: Chapter;
    new?: Chapter;
    changes?: Chapter;
    prove?: Chapter;
    build?: Chapter;
    commit?: Chapter;
  };
}
export interface Chapter {
  headline?: string;
  recap?: string[];
}
export interface Test {
  id: string;
  level: 'unit' | 'service' | 'contract' | 'integration' | 'e2e';
  name: string;
  /**
   * markdown; may cite [[id]]
   */
  given?: string;
  /**
   * markdown; may cite [[id]]
   */
  when?: string;
  /**
   * markdown; may cite [[id]]
   */
  then?: string;
  proves: string[];
  walks?: string[];
  owner?: string;
  env?: 'local' | 'ci' | 'staging' | 'prod';
}
export interface WorkItem {
  id: string;
  title: string;
  team: string;
  size?: 'XS' | 'S' | 'M' | 'L' | 'XL';
  milestone?: string;
  /**
   * when we need it (YYYY-MM-DD); a team's promised date lives in progress.yaml
   */
  needed_by?: string;
  /**
   * the changes it implements; recovery and operations work implements none
   */
  implements?: string[];
  verified_by?: string[];
  depends_on?: string[];
  /**
   * the decisions or questions it waits on, here or in another plan or the programme
   */
  blocked_by?: string[];
  repo?: string;
  /**
   * markdown; may cite [[id]]
   */
  body?: string;
  /**
   * GitHub issue number in `repo`; written back by tools/export-issues.mjs, never authored by hand
   */
  github_issue?: number;
  /**
   * which issue template (.github/ISSUE_TEMPLATE/<type>.yml) the exported issue uses; default task
   */
  issue_type?: 'task' | 'story' | 'feature' | 'bug';
}
/**
 * An overlay over the canonical workspace model. System facts are referenced by immutable id and changed by ops; they are never copied into base collections.
 */
export interface CanonicalPlanDocument {
  meta: Meta;
  problem: Problem;
  builds_on?: string[];
  changes: Change[];
  tests?: Test[];
  milestones?: Milestone[];
  execution?: Execution;
  work_items?: WorkItem[];
  decisions?: Decision[];
  risks?: Risk[];
  questions?: Question[];
  story?: Story;
}
