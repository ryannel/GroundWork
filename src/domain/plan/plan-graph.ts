import type { EntityType, PathSegment } from '@/domain/plan/plan-ids';
import type {
  Change,
  Concept,
  Decision,
  Endpoint,
  Field,
  Flow,
  Graph,
  Handler,
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
  readonly $type: K;
  readonly $path: readonly PathSegment[];
  readonly $parent?: string;
  readonly $index?: number;
  readonly $seq?: number;
  readonly $service?: string;
}

export type TeamNode = Team & NodeMeta<'team'>;
export type SystemNode = System & NodeMeta<'system'>;
export type ServiceNode = Service & NodeMeta<'service'>;
export type StoreNode = Store & NodeMeta<'store'>;
export type FieldNode = Field & { readonly id: string } & NodeMeta<'field'>;
export type SchemaNode = Omit<Schema, 'fields'> & {
  readonly fields: readonly FieldNode[];
} & NodeMeta<'schema'>;
export type EndpointNode = Endpoint & NodeMeta<'endpoint'>;
export type InterfaceNode = Omit<Interface, 'endpoints'> & {
  readonly endpoints: readonly EndpointNode[];
} & NodeMeta<'interface'>;
export type MessageNode = Message & NodeMeta<'message'>;
export type StepNode = Step & NodeMeta<'step'>;
export type FlowNode = Omit<Flow, 'steps'> & {
  readonly steps: readonly StepNode[];
} & NodeMeta<'flow'>;
export type RegionNode = Region & NodeMeta<'region'>;
export type ScreenNode = Omit<Screen, 'regions'> & {
  readonly regions: readonly RegionNode[];
} & NodeMeta<'screen'>;
export type GraphNode = Graph & NodeMeta<'graph'>;
export type SubgraphNode = Subgraph & NodeMeta<'subgraph'>;
export type OperationNode = Operation & NodeMeta<'operation'>;
export type InteractionNode = Interaction & NodeMeta<'interaction'>;
export type UserJourneyNode = UserJourney & NodeMeta<'userJourney'>;
export type HandlerNode = Handler & NodeMeta<'handler'>;

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
  | UserJourneyNode
  | HandlerNode;

export interface SystemGraph {
  readonly byId: ReadonlyMap<string, PlanNode>;
  readonly duplicates: readonly PlanNode[];
  readonly teams: readonly TeamNode[];
  readonly systems: readonly SystemNode[];
  readonly services: readonly ServiceNode[];
  readonly stores: readonly StoreNode[];
  readonly schemas: readonly SchemaNode[];
  readonly fields: readonly FieldNode[];
  readonly interfaces: readonly InterfaceNode[];
  readonly endpoints: readonly EndpointNode[];
  readonly messages: readonly MessageNode[];
  readonly flows: readonly FlowNode[];
  readonly steps: readonly StepNode[];
  readonly screens: readonly ScreenNode[];
  readonly regions: readonly RegionNode[];
  readonly interactions: readonly InteractionNode[];
  readonly userJourneys: readonly UserJourneyNode[];
  readonly graphs: readonly GraphNode[];
  readonly subgraphs: readonly SubgraphNode[];
  readonly operations: readonly OperationNode[];
  readonly handlers: readonly HandlerNode[];
  readonly get: (id: string | null | undefined) => PlanNode | undefined;
  readonly has: (id: string) => boolean;
}

/** The system half of a plan: the base arrays only. */
export interface SystemSource {
  readonly teams: readonly Team[];
  readonly systems: readonly System[];
  readonly services: readonly Service[];
  readonly stores: readonly Store[];
  readonly schemas: readonly Schema[];
  readonly interfaces: readonly Interface[];
  readonly messages: readonly Message[];
  readonly flows: readonly Flow[];
  readonly screens: readonly Screen[];
  readonly interactions: readonly Interaction[];
  readonly user_journeys: readonly UserJourney[];
  readonly graphs: readonly Graph[];
  readonly subgraphs: readonly Subgraph[];
  readonly operations: readonly Operation[];
  readonly handlers: readonly Handler[];
}

export type OpKind = 'add' | 'modify' | 'deprecate' | 'remove';

export interface OpProblem {
  readonly code: string;
  /** Path segments relative to the op. */
  readonly at: readonly PathSegment[];
  readonly message: string;
}

export interface PropChange {
  readonly prop: string;
  readonly change: 'set' | 'append' | 'drop';
  readonly before: unknown;
  readonly after: unknown;
  readonly values?: readonly unknown[];
}

/** What one op did to the as-is system, in ledger order. */
export interface OpRecord {
  readonly kind: OpKind | null;
  readonly changeId: string | undefined;
  readonly changeIndex: number;
  readonly opIndex: number;
  readonly path: readonly PathSegment[];
  readonly target: string | null;
  readonly type: EntityType | null;
  readonly ids: readonly string[];
  readonly parent?: string | null;
  readonly afterId?: string | null;
  readonly value?: unknown;
  readonly props: readonly PropChange[];
  readonly replacedBy?: string | null;
  readonly removed?: unknown;
  readonly problems: readonly OpProblem[];
  readonly warnings: readonly OpProblem[];
}

export interface AppliedOps {
  readonly system: SystemSource;
  readonly records: readonly OpRecord[];
  readonly origins: ReadonlyMap<string, readonly PathSegment[]>;
}

/** An entity that lives outside the system graphs. */
export type PlanEntity =
  Change | Test | Milestone | WorkItem | Decision | Risk | Question | Scenario | Concept | Stage;

export interface PlanEntry {
  readonly id: string;
  readonly type: EntityType;
  readonly entity: PlanEntity;
  /** Where the entity sits in plan.yaml. */
  readonly path: readonly PathSegment[];
}

export interface FanoutCall {
  readonly from: string;
  readonly to: string;
  readonly via: string | null;
  readonly kind: 'api' | 'msg' | 'internal';
  /** True for a call the gateway makes on the step's behalf, not one the step names. */
  readonly fanout: boolean;
  readonly subgraph?: string;
}

export interface FanoutRead {
  readonly svc: string | null;
  readonly store: string | null;
  readonly rw: 'read' | 'write';
  readonly ref: string | null;
  readonly field?: string;
  readonly cache?: boolean;
}

/** What a step reaches once its `via` is expanded; the federation port fills in the operation case. */
export interface FanoutResult {
  readonly calls: readonly FanoutCall[];
  readonly data: readonly FanoutRead[];
  readonly purges: readonly { readonly svc: string | null; readonly store: string }[];
  readonly refs: readonly string[];
  readonly services: readonly string[];
  readonly subgraphs: readonly string[];
  readonly operation: string | null;
}

export type Fanout = (g: SystemGraph, step: StepNode) => FanoutResult;
