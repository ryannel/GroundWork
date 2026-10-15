/* Generated from schema/plan.schema.json by tools/generate-plan-types.ts. Do not edit: run `npm run generate`. */

export type HandlerSource = CodeSource | Source;
/**
 * how the fact was made: read from code by a scan, seeded by hand for a demo, or written by a person
 */
export type Origin = 'extracted' | 'seeded' | 'curated';
export type HandlerStep =
  | HandlerDoes
  | HandlerCall
  | HandlerPublish
  | HandlerRead
  | HandlerWrite
  | HandlerIf
  | HandlerEach
  | HandlerParallel
  | HandlerRetry
  | HandlerTry
  | HandlerReturn
  | HandlerWait;
export type HandlerSteps = HandlerStep[];
export type Op = OpAdd | OpModify | OpDeprecate | OpRemove;
export type OpAdd =
  | {
      add: 'service';
      value: Service;
    }
  | {
      add: 'system';
      value: System;
    }
  | {
      add: 'store';
      value: Store;
    }
  | {
      add: 'schema';
      value: Schema;
    }
  | {
      add: 'field';
      value: Field;
      into: string;
    }
  | {
      add: 'interface';
      value: Interface;
    }
  | {
      add: 'endpoint';
      value: Endpoint;
      into: string;
    }
  | {
      add: 'message';
      value: Message;
    }
  | {
      add: 'flow';
      value: Flow;
    }
  | {
      add: 'step';
      value: Step;
      into: string;
      after?: string;
    }
  | {
      add: 'screen';
      value: Screen;
    }
  | {
      add: 'region';
      value: Region;
      into: string;
    }
  | {
      add: 'graph';
      value: Graph;
    }
  | {
      add: 'subgraph';
      value: Subgraph;
    }
  | {
      add: 'interaction';
      value: Interaction;
    }
  | {
      add: 'userJourney';
      value: UserJourney;
    }
  | {
      add: 'operation';
      value: Operation;
    }
  | {
      add: 'handler';
      value: Handler;
    };
export type Level3 = 'low' | 'med' | 'high';

/**
 * Base arrays describe the system as it is today; every delta is an op inside changes[]. See SPEC.md §1.
 */
export interface Plan {
  meta: Meta;
  problem: Problem;
  domain?: Domain;
  teams: Team[];
  /**
   * a system is several deployables (services) of one team that are built, run and changed together; the system map draws it as one card with its services inside
   */
  systems?: System[];
  services: Service[];
  stores?: Store[];
  schemas?: Schema[];
  interfaces?: Interface[];
  messages?: Message[];
  flows?: Flow[];
  /**
   * what people see today: pages, modals, emails, pushes, prints, each with a screenshot and named regions; the to-be look is set by ops
   */
  screens?: Screen[];
  /**
   * Recorded screen interactions independent of system flows; shared navigation has several from screens or regions
   */
  interactions?: Interaction[];
  /**
   * Ordered paths through recorded interactions; every adjacent interaction connects through the same screen
   */
  user_journeys?: UserJourney[];
  /**
   * federated GraphQL graphs: the gateway that composes and routes them
   */
  graphs?: Graph[];
  /**
   * who contributes to a graph: each subgraph is served by one service
   */
  subgraphs?: Subgraph[];
  /**
   * the GraphQL documents the front end sends (queries and mutations); the query plan is derived from them
   */
  operations?: Operation[];
  /**
   * what runs when an endpoint is called, a message consumed, a schedule fires or a person acts
   */
  handlers?: Handler[];
  changes?: Change[];
  tests?: Test[];
  milestones?: Milestone[];
  execution?: Execution;
  work_items?: WorkItem[];
  decisions?: Decision[];
  risks?: Risk[];
  questions?: Question[];
  commitment?: Commitment[];
  story?: Story;
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
   * the plan's lifecycle: draft, review, approved (the room said yes). 'committed' is the old name for approved and still reads as it, with a warning
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
/**
 * The business language and the path data takes, before any system detail. Rendered as chapter 2's opening screens.
 */
export interface Domain {
  /**
   * markdown; the narrative of how the domain's things are born and fan out. May cite [[id]]
   */
  summary?: string;
  concepts?: Concept[];
  /**
   * in the order data moves through them
   */
  stages?: Stage[];
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
  means: string;
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
  sources?: Source[];
}
/**
 * Where this fact lives: a GitHub permalink (blob/<sha>/path#L10-L20), a doc, a dashboard
 */
export interface Source {
  url: string;
  /**
   * shown instead of the URL; defaults to repo · path#line for GitHub blob links
   */
  label?: string;
  /**
   * markdown; what the reader will find there
   */
  note?: string;
}
export interface Stage {
  id: string;
  /**
   * a short verb or noun (Shop, Pick, Pay)
   */
  name: string;
  /**
   * markdown; may cite [[id]]
   */
  summary?: string;
  services?: {
    svc: string;
    /**
     * what this service reads from when no flow or topic access already says so (service, topic, interface or endpoint); drawn as a line on the system map
     */
    from?: string[];
  }[];
  /**
   * optional; flows are otherwise placed by the stage of the service that acts in most of their steps
   */
  flows?: string[];
}
export interface Team {
  id: string;
  name: string;
  channel?: string;
  /**
   * the team's slot in the app's thirteen-colour team palette (--team-1 to --team-13; 9 to 13 are drawn with a ring). Give a team the same slot in every plan, and no two teams in one plan the same while a slot is free
   */
  colour?: number;
}
export interface System {
  id: string;
  /**
   * what people call the whole thing (often the repo or Backstage system name, in words)
   */
  name: string;
  team: string;
  /**
   * the role of the whole system in plain words, ≤ 10 words; shown at the top of its card
   */
  does?: string;
  /**
   * markdown; why these services belong together (shared repo, store, release). May cite [[id]]
   */
  summary?: string;
  /**
   * evidence it is one system: the Backstage spec.system line, the shared repo or the shared store
   */
  sources?: Source[];
}
export interface Service {
  id: string;
  name: string;
  team: string;
  /**
   * sys:<kebab-slug>
   */
  system?: string;
  kind: 'ui' | 'service' | 'job' | 'external';
  tech?: string;
  /**
   * its role in plain words a newcomer understands: what it does for the business, ≤ 10 words, sentence case, no jargon or code names. Shown on the system map card
   */
  does?: string;
  /**
   * markdown; may cite [[id]]
   */
  summary?: string;
  /**
   * evidence links; every as-is entity should have one
   */
  sources?: Source[];
}
export interface Store {
  id: string;
  name: string;
  kind: 'database' | 'cache' | 'topic' | 'queue' | 'warehouse' | 'bucket';
  tech?: string;
  /**
   * its role in plain words a newcomer understands: what it holds or carries, and for whom, ≤ 10 words, sentence case, no jargon or code names. Shown on the system map card
   */
  does?: string;
  owner: string;
  access?: StoreAccess[];
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
  /**
   * markdown; may cite [[id]]
   */
  notes?: string;
  /**
   * evidence links; every as-is entity should have one
   */
  sources?: Source[];
}
export interface StoreAccess {
  svc: string;
  mode: 'read' | 'write' | 'readwrite';
}
export interface Schema {
  id: string;
  name: string;
  kind: 'record' | 'dto' | 'payload' | 'graph-type';
  store?: string;
  /**
   * kind: graph-type only: the graph the type belongs to
   */
  graph?: string;
  /**
   * kind: graph-type only: Query or Mutation
   */
  root?: 'query' | 'mutation';
  /**
   * kind: graph-type only: entity keys; `in` = the subgraphs that can be asked for the entity by that key (stub contributors included)
   */
  keys?: {
    /**
     * @minItems 1
     */
    fields: [string, ...string[]];
    /**
     * @minItems 1
     */
    in: [string, ...string[]];
  }[];
  /**
   * markdown; may cite [[id]]
   */
  summary?: string;
  fields?: Field[];
  /**
   * evidence links; every as-is entity should have one
   */
  sources?: Source[];
}
export interface Field {
  name: string;
  type: string;
  required?: boolean;
  /**
   * part of the record's identity (primary key)
   */
  key?: boolean;
  /**
   * a reference to another record: sch:* (its key) or sch:*#field
   */
  ref?: string;
  /**
   * the value used when the field is left out
   */
  default?: string | number | boolean;
  /**
   * no two records share the value
   */
  unique?: boolean;
  /**
   * GraphQL arguments, verbatim (e.g. "sku: ID!")
   */
  args?: string;
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
  /**
   * markdown; may cite [[id]]
   */
  note?: string;
  /**
   * evidence links; every as-is entity should have one
   */
  sources?: Source[];
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
export interface Interface {
  id: string;
  service: string;
  protocol: 'rest' | 'grpc' | 'graphql' | 'https';
  version?: string;
  /**
   * markdown; may cite [[id]]
   */
  summary?: string;
  supersedes?: string;
  endpoints?: Endpoint[];
  /**
   * evidence links; every as-is entity should have one
   */
  sources?: Source[];
}
export interface Endpoint {
  id: string;
  sig: string;
  /**
   * markdown; may cite [[id]]
   */
  summary?: string;
  request?: string;
  response?: string;
  auth?: string;
  idempotent?: boolean;
  errors?: EndpointError[];
  supersedes?: string;
  /**
   * evidence links; every as-is entity should have one
   */
  sources?: Source[];
}
export interface EndpointError {
  status: number;
  code?: string;
  when?: string;
}
export interface Message {
  id: string;
  name: string;
  version?: string;
  topic: string;
  payload?: string;
  producer: string;
  consumers?: string[];
  /**
   * the payload field the message is keyed by (its partition key), e.g. sku
   */
  key?: string;
  semantics?: string;
  /**
   * markdown; may cite [[id]]
   */
  summary?: string;
  supersedes?: string;
  /**
   * evidence links; every as-is entity should have one
   */
  sources?: Source[];
}
export interface Flow {
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
  steps: Step[];
  /**
   * evidence links; every as-is entity should have one
   */
  sources?: Source[];
}
export interface Step {
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
   * evidence links; every as-is entity should have one
   */
  sources?: Source[];
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
}
/**
 * A screen a person sees: a page, a modal, an email, a push notification, a printed document. `image` is what it looks like (a screenshot today; a wireframe or export of the design in the to-be, set by a modify op). Steps point at the screen (or one of its regions) they happen on, which is how a flow becomes a UI journey
 */
export interface Screen {
  id: string;
  name: string;
  /**
   * svc:<kebab-slug>
   */
  service: string;
  kind?: 'page' | 'modal' | 'sheet' | 'email' | 'push' | 'print';
  /**
   * the path or deep link, e.g. /p/{sku}, app://orders/{id}
   */
  route?: string;
  /**
   * what the image was taken on
   */
  device?: 'desktop' | 'mobile' | 'handheld' | 'any';
  /**
   * markdown; may cite [[id]]
   */
  summary?: string;
  /**
   * screenshot of the screen today (as-is); a modify op sets the to-be picture (wireframe, design export)
   */
  image?: string;
  /**
   * the design file or frame; usually set by a modify op in the to-be
   */
  figma?: string;
  /**
   * a walking mockup: a static HTML file under the plan folder, opened at #<screen-id> (see tools/mockup.mjs and the plan-atlas-mockup skill)
   */
  mockup?: string;
  regions?: Region[];
  /**
   * evidence links; every as-is entity should have one
   */
  sources?: Source[];
}
/**
 * A named part of a screen: a block the reader can point at (the price, the delivery line, the Pay button). Regions are what ops change and what steps point at
 */
export interface Region {
  id: string;
  name: string;
  /**
   * markdown; what the region shows and where the data comes from; may cite [[id]]
   */
  shows?: string;
  /**
   * the records or fields the region displays
   */
  reads?: string[];
  at?: RegionBox;
  /**
   * evidence links; every as-is entity should have one
   */
  sources?: Source[];
}
/**
 * where the region sits on the image, in percent of its width/height (x,y = top-left corner)
 */
export interface RegionBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Interaction {
  id: string;
  /**
   * The control or trigger in plain words
   */
  name: string;
  /**
   * @minItems 1
   */
  from: [string, ...string[]];
  to: string;
  trigger: 'click' | 'submit' | 'scroll' | 'system';
  effect: 'navigate' | 'update' | 'output';
  condition?: string;
  result?: string;
  supporting_steps?: string[];
  sources?: Source[];
  evidence?: {
    file: string;
    /**
     * What the local drawn example records; do not claim production evidence
     */
    note: string;
  };
}
export interface UserJourney {
  id: string;
  name: string;
  actor?: string;
  /**
   * Ordered interaction IDs; a repeat is permitted when a journey revisits a screen
   *
   * @minItems 1
   */
  interactions: [string, ...string[]];
  sources?: Source[];
}
/**
 * A federated GraphQL graph. The gateway is an ordinary service; its team owns the graph
 */
export interface Graph {
  id: string;
  name: string;
  gateway: string;
  /**
   * schema registry / query-plan explorer
   */
  registry?: string;
  /**
   * markdown; may cite [[id]]
   */
  summary?: string;
  /**
   * evidence links; every as-is entity should have one
   */
  sources?: Source[];
}
/**
 * A subgraph: the unit of ownership in federation, served by one service
 */
export interface Subgraph {
  id: string;
  name: string;
  graph: string;
  service: string;
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
  /**
   * evidence links; every as-is entity should have one
   */
  sources?: Source[];
}
/**
 * A GraphQL document the front end sends; paths, variables and the query plan are derived from it
 */
export interface Operation {
  id: string;
  name: string;
  kind: 'query' | 'mutation' | 'subscription';
  graph: string;
  /**
   * the screens or regions that issue it
   */
  screens?: string[];
  /**
   * svc:<kebab-slug>
   */
  client?: string;
  /**
   * the edge cannot cache POST
   */
  method?: 'GET' | 'POST';
  persisted?: 'apq' | 'safelist' | 'none';
  /**
   * the operation verbatim
   */
  document: string;
  /**
   * edge / gateway layers in front of it; ttl here is an override with a reason
   */
  cache?: CacheUse[];
  /**
   * the registry's query plan, to check the derived one against
   */
  plan_check?: {
    fetches?: number;
    round_trips?: number;
    source?: string;
  };
  /**
   * a mutation's root resolver writes (checked against the root field's subgraph service)
   */
  writes?: string[];
  /**
   * markdown; may cite [[id]]
   */
  summary?: string;
  /**
   * evidence links; every as-is entity should have one
   */
  sources?: Source[];
  /**
   * when the front end sends it (fired when the page loads, when the button is pressed, …)
   */
  trigger?: 'load' | 'click' | 'scroll' | 'submit' | 'interval';
}
/**
 * what runs when something arrives at a component, as a short tree of steps
 */
export interface Handler {
  id: string;
  on: string;
  component: string;
  /**
   * markdown; may cite [[id]]
   */
  summary?: string;
  /**
   * where the handler lives in code
   */
  sources?: HandlerSource[];
  origin?: Origin;
  steps: HandlerSteps;
  fails?: HandlerFail[];
}
/**
 * a place in code; the permalink is derived from it
 */
export interface CodeSource {
  /**
   * the repository, e.g. github.com/alder-finch/pricing
   */
  repo: string;
  /**
   * the file, from the repository root
   */
  path: string;
  /**
   * [from, to], both inclusive
   *
   * @minItems 2
   * @maxItems 2
   */
  lines: [number, number];
  /**
   * the commit the lines were read at
   */
  commit: string;
  /**
   * the function or class, e.g. PriceController.getPrice
   */
  symbol?: string;
}
/**
 * work done in place
 */
export interface HandlerDoes {
  /**
   * what the step does, in plain words
   */
  does: string;
  /**
   * a guard in plain words: the step runs only when this holds
   */
  when?: string;
  /**
   * true when the handler does not wait for the step to finish
   */
  async?: boolean;
  /**
   * where the step lives in code
   */
  sources?: HandlerSource[];
  origin?: Origin;
}
/**
 * calls an endpoint and waits for it
 */
export interface HandlerCall {
  call: string;
  /**
   * what the step does, in plain words
   */
  does?: string;
  /**
   * a guard in plain words: the step runs only when this holds
   */
  when?: string;
  /**
   * true when the handler does not wait for the step to finish
   */
  async?: boolean;
  /**
   * where the step lives in code
   */
  sources?: HandlerSource[];
  origin?: Origin;
}
/**
 * publishes a message
 */
export interface HandlerPublish {
  publish: string;
  /**
   * what the step does, in plain words
   */
  does?: string;
  /**
   * a guard in plain words: the step runs only when this holds
   */
  when?: string;
  /**
   * true when the handler does not wait for the step to finish
   */
  async?: boolean;
  /**
   * where the step lives in code
   */
  sources?: HandlerSource[];
  origin?: Origin;
}
/**
 * reads a schema from a store
 */
export interface HandlerRead {
  read: string;
  from: string;
  /**
   * what the step does, in plain words
   */
  does?: string;
  /**
   * a guard in plain words: the step runs only when this holds
   */
  when?: string;
  /**
   * true when the handler does not wait for the step to finish
   */
  async?: boolean;
  /**
   * where the step lives in code
   */
  sources?: HandlerSource[];
  origin?: Origin;
}
/**
 * writes a schema to a store
 */
export interface HandlerWrite {
  write: string;
  to: string;
  /**
   * what the step does, in plain words
   */
  does?: string;
  /**
   * a guard in plain words: the step runs only when this holds
   */
  when?: string;
  /**
   * true when the handler does not wait for the step to finish
   */
  async?: boolean;
  /**
   * where the step lives in code
   */
  sources?: HandlerSource[];
  origin?: Origin;
}
/**
 * a fork
 */
export interface HandlerIf {
  if: string;
  then: HandlerSteps;
  else?: HandlerSteps;
  /**
   * what the step does, in plain words
   */
  does?: string;
  /**
   * a guard in plain words: the step runs only when this holds
   */
  when?: string;
  /**
   * true when the handler does not wait for the step to finish
   */
  async?: boolean;
  /**
   * where the step lives in code
   */
  sources?: HandlerSource[];
  origin?: Origin;
}
/**
 * a loop
 */
export interface HandlerEach {
  each: string;
  do: HandlerSteps;
  /**
   * what the step does, in plain words
   */
  does?: string;
  /**
   * a guard in plain words: the step runs only when this holds
   */
  when?: string;
  /**
   * true when the handler does not wait for the step to finish
   */
  async?: boolean;
  /**
   * where the step lives in code
   */
  sources?: HandlerSource[];
  origin?: Origin;
}
/**
 * branches at once
 */
export interface HandlerParallel {
  /**
   * branches that run at once
   *
   * @minItems 1
   */
  parallel: [HandlerSteps, ...HandlerSteps[]];
  /**
   * what the step does, in plain words
   */
  does?: string;
  /**
   * a guard in plain words: the step runs only when this holds
   */
  when?: string;
  /**
   * true when the handler does not wait for the step to finish
   */
  async?: boolean;
  /**
   * where the step lives in code
   */
  sources?: HandlerSource[];
  origin?: Origin;
}
/**
 * tries the steps again when they fail
 */
export interface HandlerRetry {
  /**
   * what is retried, or on what
   */
  retry: string;
  times?: number;
  do: HandlerSteps;
  /**
   * what the step does, in plain words
   */
  does?: string;
  /**
   * a guard in plain words: the step runs only when this holds
   */
  when?: string;
  /**
   * true when the handler does not wait for the step to finish
   */
  async?: boolean;
  /**
   * where the step lives in code
   */
  sources?: HandlerSource[];
  origin?: Origin;
}
/**
 * steps with a fallback when they fail
 */
export interface HandlerTry {
  try: HandlerSteps;
  catch: HandlerSteps;
  /**
   * what the step does, in plain words
   */
  does?: string;
  /**
   * a guard in plain words: the step runs only when this holds
   */
  when?: string;
  /**
   * true when the handler does not wait for the step to finish
   */
  async?: boolean;
  /**
   * where the step lives in code
   */
  sources?: HandlerSource[];
  origin?: Origin;
}
/**
 * what the handler answers
 */
export interface HandlerReturn {
  /**
   * a schema id, or what comes back in plain words
   */
  return: string;
  /**
   * what the step does, in plain words
   */
  does?: string;
  /**
   * a guard in plain words: the step runs only when this holds
   */
  when?: string;
  /**
   * true when the handler does not wait for the step to finish
   */
  async?: boolean;
  /**
   * where the step lives in code
   */
  sources?: HandlerSource[];
  origin?: Origin;
}
/**
 * a pause
 */
export interface HandlerWait {
  /**
   * a timer or a schedule
   */
  wait: string;
  /**
   * what the step does, in plain words
   */
  does?: string;
  /**
   * a guard in plain words: the step runs only when this holds
   */
  when?: string;
  /**
   * true when the handler does not wait for the step to finish
   */
  async?: boolean;
  /**
   * where the step lives in code
   */
  sources?: HandlerSource[];
  origin?: Origin;
}
export interface HandlerFail {
  when: string;
  /**
   * what the caller gets, e.g. 404 not_found
   */
  result: string;
  sources?: HandlerSource[];
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
  /**
   * @minItems 1
   */
  ops: [Op, ...Op[]];
  /**
   * evidence links
   */
  sources?: Source[];
}
export interface OpModify {
  modify: string;
  /**
   * scalar/whole-value replacement per prop
   */
  set?: Record<string, unknown>;
  /**
   * list props: values appended
   */
  append?: Record<string, unknown[]>;
  /**
   * list props: values removed
   */
  drop?: Record<string, unknown[]>;
}
export interface OpDeprecate {
  deprecate: string;
  replaced_by?: string;
}
export interface OpRemove {
  remove: string;
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
export interface WorkItem {
  id: string;
  title: string;
  team: string;
  size?: 'XS' | 'S' | 'M' | 'L' | 'XL';
  milestone?: string;
  implements: string[];
  verified_by?: string[];
  depends_on?: string[];
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
export interface Decision {
  id: string;
  title: string;
  /**
   * deferred: deliberately left until after this plan; set decide_by as the date to revisit it
   */
  status: 'proposed' | 'accepted' | 'deferred' | 'rejected' | 'superseded';
  /**
   * team:<kebab-slug>
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
  /**
   * evidence links
   */
  sources?: Source[];
}
export interface Option {
  name: string;
  /**
   * markdown; may cite [[id]]
   */
  why_not?: string;
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
  /**
   * evidence links
   */
  sources?: Source[];
  /**
   * dec:<kebab-slug>
   */
  accepted_by?: string;
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
  /**
   * evidence links
   */
  sources?: Source[];
  /**
   * dec:<kebab-slug>
   */
  answered_by?: string;
}
export interface Commitment {
  team: string;
  confidence?: number;
  /**
   * markdown; may cite [[id]]
   */
  note?: string;
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
