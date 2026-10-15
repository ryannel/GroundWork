import type { EntityType, PathSegment } from '@/domain/plan/plan-ids';
import type {
  Change,
  Concept,
  Decision,
  Endpoint,
  Field,
  Flow,
  Graph,
  Interaction,
  Interface,
  Message,
  Milestone,
  Operation,
  Question,
  Region,
  Risk,
  Scenario,
  Schema,
  Screen,
  Service,
  Stage,
  Step,
  Store,
  Subgraph,
  System,
  Team,
  Test,
  UserJourney,
  WorkItem,
} from '@/domain/plan/plan.generated';

// A node is an entity plus the `$`-props the graph derives. Children (fields, steps, endpoints,
// regions) are nodes themselves, and `$type` narrows a PlanNode to one entity.
interface NodeMeta<K extends EntityType> {
  $type: K;
  $path: PathSegment[];
  $parent?: string;
  $index?: number;
  $seq?: number;
  $service?: string;
}

export type TeamNode = Team & NodeMeta<'team'>;
export type SystemNode = System & NodeMeta<'system'>;
export type ServiceNode = Service & NodeMeta<'service'>;
export type StoreNode = Store & NodeMeta<'store'>;
export type FieldNode = Field & { id: string } & NodeMeta<'field'>;
export type SchemaNode = Omit<Schema, 'fields'> & { fields: FieldNode[] } & NodeMeta<'schema'>;
export type EndpointNode = Endpoint & NodeMeta<'endpoint'>;
export type InterfaceNode = Omit<Interface, 'endpoints'> & {
  endpoints: EndpointNode[];
} & NodeMeta<'interface'>;
export type MessageNode = Message & NodeMeta<'message'>;
export type StepNode = Step & NodeMeta<'step'>;
export type FlowNode = Omit<Flow, 'steps'> & { steps: StepNode[] } & NodeMeta<'flow'>;
export type RegionNode = Region & NodeMeta<'region'>;
export type ScreenNode = Omit<Screen, 'regions'> & { regions: RegionNode[] } & NodeMeta<'screen'>;
export type GraphNode = Graph & NodeMeta<'graph'>;
export type SubgraphNode = Subgraph & NodeMeta<'subgraph'>;
export type OperationNode = Operation & NodeMeta<'operation'>;
export type InteractionNode = Interaction & NodeMeta<'interaction'>;
export type UserJourneyNode = UserJourney & NodeMeta<'userJourney'>;

export type PlanNode =
  | TeamNode
  | SystemNode
  | ServiceNode
  | StoreNode
  | FieldNode
  | SchemaNode
  | EndpointNode
  | InterfaceNode
  | MessageNode
  | StepNode
  | FlowNode
  | RegionNode
  | ScreenNode
  | GraphNode
  | SubgraphNode
  | OperationNode
  | InteractionNode
  | UserJourneyNode;

export interface SystemGraph {
  readonly byId: Map<string, PlanNode>;
  readonly duplicates: PlanNode[];
  readonly teams: TeamNode[];
  readonly systems: SystemNode[];
  readonly services: ServiceNode[];
  readonly stores: StoreNode[];
  readonly schemas: SchemaNode[];
  readonly fields: FieldNode[];
  readonly interfaces: InterfaceNode[];
  readonly endpoints: EndpointNode[];
  readonly messages: MessageNode[];
  readonly flows: FlowNode[];
  readonly steps: StepNode[];
  readonly screens: ScreenNode[];
  readonly regions: RegionNode[];
  readonly interactions: InteractionNode[];
  readonly userJourneys: UserJourneyNode[];
  readonly graphs: GraphNode[];
  readonly subgraphs: SubgraphNode[];
  readonly operations: OperationNode[];
  get: (id: string | null | undefined) => PlanNode | undefined;
  has: (id: string) => boolean;
}

/** The system half of a plan: the base arrays only. */
export interface SystemSource {
  teams: Team[];
  systems: System[];
  services: Service[];
  stores: Store[];
  schemas: Schema[];
  interfaces: Interface[];
  messages: Message[];
  flows: Flow[];
  screens: Screen[];
  interactions: Interaction[];
  user_journeys: UserJourney[];
  graphs: Graph[];
  subgraphs: Subgraph[];
  operations: Operation[];
}

export type OpKind = 'add' | 'modify' | 'deprecate' | 'remove';

export interface OpProblem {
  code: string;
  /** Path segments relative to the op. */
  at: PathSegment[];
  message: string;
}

export interface PropChange {
  prop: string;
  change: 'set' | 'append' | 'drop';
  before: unknown;
  after: unknown;
  values?: unknown[];
}

/** What one op did to the as-is system, in ledger order. */
export interface OpRecord {
  kind: OpKind | null;
  changeId: string | undefined;
  changeIndex: number;
  opIndex: number;
  path: PathSegment[];
  target: string | null;
  type: EntityType | null;
  ids: string[];
  parent?: string | null;
  afterId?: string | null;
  value?: unknown;
  props: PropChange[];
  replacedBy?: string | null;
  removed?: unknown;
  problems: OpProblem[];
  warnings: OpProblem[];
}

export interface AppliedOps {
  system: SystemSource;
  records: OpRecord[];
  origins: Map<string, PathSegment[]>;
}

/** An entity that lives outside the system graphs. */
export type PlanEntity =
  Change | Test | Milestone | WorkItem | Decision | Risk | Question | Scenario | Concept | Stage;

export interface PlanEntry {
  id: string;
  type: EntityType;
  entity: PlanEntity;
  /** Where the entity sits in plan.yaml. */
  path: PathSegment[];
}

export interface FanoutCall {
  from: string;
  to: string;
  via: string | null;
  kind: 'api' | 'msg' | 'internal';
  /** True for a call the gateway makes on the step's behalf, not one the step names. */
  fanout: boolean;
  subgraph?: string;
}

export interface FanoutRead {
  svc: string | null;
  store: string | null;
  rw: 'read' | 'write';
  ref: string | null;
  field?: string;
  cache?: boolean;
}

/** What a step reaches once its `via` is expanded; the federation port fills in the operation case. */
export interface FanoutResult {
  calls: FanoutCall[];
  data: FanoutRead[];
  purges: { svc: string | null; store: string }[];
  refs: string[];
  services: string[];
  subgraphs: string[];
  operation: string | null;
}

export type Fanout = (g: SystemGraph, step: StepNode) => FanoutResult;
