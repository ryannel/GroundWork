/* Generated from schema/knowledge.schema.json. Run npm run generate:knowledge. */

export type KnowledgeDocument = KnowledgeBundle | KnowledgeSnapshot | QueryRequest | QueryResponse;
export type KnowledgeRecord =
  | Evidence
  | Artifact
  | Resolution
  | Implementation
  | Operation
  | Transition
  | Value
  | ValueFlow
  | Shape
  | Effect
  | Gap
  | Coverage
  | Claim
  | Derivation
  | SourceRevision
  | Entry
  | Resource
  | ArtifactSourceBinding
  | StorageWrite
  | ChannelBinding
  | DeliveryPolicy
  | Subscription
  | Handoff
  | ConsistencyBoundary
  | Milestone
  | RuntimeComponent
  | ExecutionBinding
  | ResourceBinding
  | InterfaceContract
  | EntryBinding
  | Interaction;
export type Representation = 'source' | 'constructed' | 'wire' | 'persisted';
export type ScalarLiteral = string | number | boolean | null;
export type SubscriptionHeaderFilter = 'equals' | 'present' | 'none' | 'unresolved';

export interface KnowledgeBundle {
  format: 'groundwork-knowledge/v1' | 'groundwork-knowledge/v2' | 'groundwork-knowledge/v3';
  workspace: string;
  records: KnowledgeRecord[];
}
export interface Evidence {
  id: string;
  kind: 'evidence';
  repo: string;
  commit: string;
  path: string;
  /**
   * @minItems 2
   * @maxItems 2
   */
  lines: [number, number];
  basis: 'source' | 'test_assertion';
  host?: string;
}
export interface Artifact {
  id: string;
  kind: 'artifact';
  coordinate: string;
  version: string;
  sourceCommit: string | null;
  correspondence: 'declared' | 'candidate' | 'verified';
  evidence: string[];
  digest: string | null;
}
export interface Resolution {
  id: string;
  kind: 'resolution';
  owner: string;
  requestedArtifact: string | null;
  basis: 'source_local' | 'artifact_verified' | 'unresolved';
  target: string | null;
  candidates: string[];
  evidence: string[];
  binding: string | null;
}
export interface Implementation {
  id: string;
  kind: 'implementation';
  logicalId: string;
  scope: string;
  entry: string;
  parameters: string[];
  evidence: string[];
  /**
   * Lexically captured values, distinct from source formal parameters.
   */
  captures?: string[];
  /**
   * Implicit source instance receiver, distinct from formal parameters and lexical captures.
   */
  receiver?: string | null;
  /**
   * Immediate source invocation return. Void has no returned value; Task/Promise handles remain values even when eventual completion has no value. Omission leaves the return kind unresolved. Constructors require separate allocation semantics, not an inferred void invocation result.
   */
  returnKind?: 'value' | 'void' | 'unresolved';
}
export interface Operation {
  id: string;
  kind: 'operation';
  owner: string;
  action: 'entry' | 'compute' | 'branch' | 'call' | 'return' | 'throw' | 'opaque';
  label: string;
  resolution: string | null;
  bindings: {
    parameter: string;
    value: string;
  }[];
  result: string | null;
  exit: string | null;
  httpStatus: number | null;
  evidence: string[];
  /**
   * Actual lexical origins for a bound invocation. This does not itself establish callback scheduling or invocation policy.
   */
  captureBindings?: {
    capture: string;
    value: string;
    /**
     * Variable binding mode: value copies the variable value (including an object reference, without copying the object); reference aliases its variable cell; unresolved establishes neither. Does not infer mutation, scheduling or invocation policy.
     */
    mode: 'value' | 'reference' | 'unresolved';
  }[];
  /**
   * Caller-owned instance receiver value; source syntax alone does not establish a callee or mutable alias effects.
   */
  receiver?: string | null;
  /**
   * Source call waiting boundary. None starts local asynchronous work without awaiting its completion; omission preserves legacy return traversal. Does not establish scheduler, synchronous prefix or interleaving.
   */
  waitsFor?: 'return' | 'await' | 'none';
}
export interface Transition {
  id: string;
  kind: 'transition';
  owner: string;
  from: string;
  to: string;
  on: string;
  condition: string | null;
  values: string[];
  evidence: string[];
}
export interface Value {
  id: string;
  kind: 'value';
  owner: string;
  definition: string;
  label: string;
  role: 'parameter' | 'definition' | 'field' | 'constant' | 'capture' | 'receiver';
  representation: Representation;
  shape: string | null;
  evidence: string[];
  accessPath: string[];
}
export interface ValueFlow {
  id: string;
  kind: 'flow';
  owner: string;
  from: string;
  to: string;
  at: string;
  transform: string;
  evidence: string[];
  gaps: string[];
  assumptions: string[];
}
export interface Shape {
  id: string;
  kind: 'shape';
  representation: Representation;
  label: string;
  fields: {
    name: string;
    type: string;
    status: 'declared' | 'candidate';
    wireTag?: number;
    optional?: boolean;
    shape?: string;
    evidence?: string[];
    nullable?: boolean;
    maxLength?: number;
    pattern?: string;
    const?: ScalarLiteral;
    /**
     * @minItems 1
     */
    enum?: [ScalarLiteral, ...ScalarLiteral[]];
  }[];
  completeness: 'partial' | 'closed';
  gaps: string[];
  evidence: string[];
  wireType?: string;
  encoding?: 'protobuf' | 'json' | 'messagepack_lz4' | 'relational';
  reservedTags?: number[];
  reservedNames?: string[];
  container?: 'object' | 'array';
  additionalProperties?: boolean;
  items?: string;
}
export interface Effect {
  id: string;
  kind: 'effect';
  owner: string;
  operation: string;
  effect: 'read' | 'write' | 'call' | 'publish';
  resource: string;
  modality: 'source_declared' | 'source_traced';
  representation: 'logical' | 'physical';
  selection: string[];
  payload: string[];
  evidence: string[];
}
export interface Gap {
  id: string;
  kind: 'gap';
  owner: string;
  obligation: string;
  reason: string;
  action: string;
  evidence: string[];
}
export interface Coverage {
  id: string;
  kind: 'coverage';
  owner: string;
  obligation: string;
  status: 'examined' | 'partial' | 'not_examined';
  scope: string;
  gaps: string[];
  evidence: string[];
}
export interface Claim {
  id: string;
  kind: 'claim';
  owner: string;
  statement: string;
  basis: 'source_declared' | 'source_traced' | 'test_asserted';
  inputs: string[];
  assumptions: string[];
  evidence: string[];
}
export interface Derivation {
  id: string;
  kind: 'derivation';
  output: string;
  rule: string;
  inputs: string[];
}
export interface SourceRevision {
  id: string;
  kind: 'source_revision';
  repo: string;
  commit: string;
}
export interface Entry {
  id: string;
  kind: 'entry';
  logicalId: string;
  method: string;
  path: string;
  implementation: string;
  evidence: string[];
  /**
   * Source registration kind. Omission preserves legacy REST entry semantics; non-REST bindings require their own protocol and declared address.
   */
  trigger?: 'rest' | 'process' | 'schedule' | 'startup' | 'callback' | 'rpc';
}
export interface Resource {
  id: string;
  kind: 'resource';
  label: string;
  technology: string;
  declaredDatabase: string | null;
  physicalLocation: string | null;
  shapes: string[];
  gaps: string[];
  evidence: string[];
  address?: {
    basis: 'source_declared';
    connectionSetting: string | null;
    database: string | null;
    table: string | null;
    container: string | null;
    path: string | null;
    key: string | null;
  };
}
export interface ArtifactSourceBinding {
  id: string;
  kind: 'artifact_source_binding';
  artifact: string;
  source: string;
  status: 'exact' | 'candidate';
  evidence: string[];
}
export interface StorageWrite {
  id: string;
  kind: 'storage_write';
  owner: string;
  effect: string;
  stagedAt: string;
  /**
   * Source-established write intent; unknown retains a proven write call and acknowledgement without guessing insert/update/replace/upsert/delete semantics. Unknown requires an explicit gap.
   */
  mode: 'insert' | 'upsert' | 'replace' | 'update' | 'delete' | 'unknown';
  acknowledgement: 'normal_return' | 'success_result' | 'ignored_result';
  atomicity: 'store_call_only' | 'unknown';
  fields: {
    path: string[];
    value: string;
    transform: string;
    context?: string[];
  }[];
  gaps: string[];
  evidence: string[];
  condition: string;
  acknowledgedAt: string;
  effectContext?: string[];
  stagedContext?: string[];
  acknowledgedContext?: string[];
}
export interface ChannelBinding {
  id: string;
  kind: 'channel_binding';
  resource: string;
  source: string;
  namespace: string | null;
  channel: string | null;
  environment: string;
  profile: string;
  basis: 'committed_configuration';
  conditions: string[];
  gaps: string[];
  evidence: string[];
}
export interface DeliveryPolicy {
  id: string;
  kind: 'delivery_policy';
  owner: string;
  operation: string;
  awaited: boolean;
  brokerPersistenceRequired: boolean | null;
  offsetCommit: 'unresolved' | 'explicit' | 'automatic';
  retryLimit: number | null;
  deduplication: 'entity_upsert' | 'none_in_inspected_scope' | 'unknown';
  deduplicationKeys: string[];
  ordering: 'not_established';
  deliveryGuarantee: 'not_established';
  gaps: string[];
  evidence: string[];
}
export interface Subscription {
  id: string;
  kind: 'subscription';
  owner: string;
  binding: string;
  header: string | null;
  messageType: string | null;
  payload: string;
  group: string | null;
  policy: string;
  gaps: string[];
  evidence: string[];
  headerFilter?: SubscriptionHeaderFilter;
}
export interface Handoff {
  id: string;
  kind: 'handoff';
  owner: string;
  effect: string;
  binding: string;
  subscription: string;
  messageType: string;
  wireShape: string;
  policy: string;
  status: 'source_matched' | 'unresolved';
  awaitsConsumer: false;
  partitionKey: 'null' | 'value' | 'unknown';
  keyValue: string | null;
  bindings: {
    from: string;
    to: string;
    transform: string;
  }[];
  correlation: {
    value: string;
    header: string;
    purpose: 'trace_correlation' | 'entity_identity' | 'message_identity';
    consumerUse: 'not_read_in_inspected_processor' | 'mapped' | 'unresolved';
  }[];
  gaps: string[];
  evidence: string[];
  compatibility: 'source_schema_match' | 'unresolved';
  typeHeader: string;
}
export interface ConsistencyBoundary {
  id: string;
  kind: 'consistency_boundary';
  owner: string;
  effects: string[];
  order: string[];
  coordination: 'separate_calls' | 'outbox' | 'unknown';
  sharedTransaction: 'not_established';
  failureWindow: string;
  gaps: string[];
  evidence: string[];
}
export interface Milestone {
  id: string;
  kind: 'milestone';
  owner: string;
  operation: string;
  stage:
    | 'local_persistence'
    | 'publication_attempt'
    | 'broker_receipt'
    | 'broker_persisted_report'
    | 'consumer_effect'
    | 'http_response';
  condition: string;
  resource: string | null;
  meaning: string;
  basis: 'conditional_source_path';
  gaps: string[];
  evidence: string[];
}
export interface RuntimeComponent {
  id: string;
  kind: 'runtime_component';
  logicalId: string;
  label: string;
  category: 'service' | 'store' | 'topic' | 'app' | 'external';
  technology: string;
  /**
   * @minItems 1
   */
  sources: [string, ...string[]];
  basis: 'source_declared';
  gaps: string[];
  /**
   * @minItems 1
   */
  evidence: [string, ...string[]];
}
export interface ExecutionBinding {
  id: string;
  kind: 'execution_binding';
  implementation: string;
  component: string;
  basis: 'source_declared' | 'artifact_verified';
  artifactBinding: string | null;
  gaps: string[];
  /**
   * @minItems 1
   */
  evidence: [string, ...string[]];
}
export interface ResourceBinding {
  id: string;
  kind: 'resource_binding';
  resource: string;
  component: string;
  gaps: string[];
  /**
   * @minItems 1
   */
  evidence: [string, ...string[]];
  role: 'storage' | 'transport' | 'remote_interface';
  scope?: 'in_process';
}
export interface InterfaceContract {
  id: string;
  kind: 'interface_contract';
  component: string | null;
  protocol: string;
  name: string;
  method: string | null;
  path: string | null;
  authority: 'source_declared' | 'caller_construction' | 'candidate' | 'unresolved';
  request: {
    part: 'path' | 'query' | 'headers' | 'body' | 'message' | 'key' | 'record';
    presence: 'present' | 'none' | 'unresolved';
    shape: string | null;
    contentType: string | null;
    gaps: string[];
    evidence: string[];
    sourceShape: string | null;
  }[];
  responses: {
    status: string;
    body: {
      part: 'path' | 'query' | 'headers' | 'body' | 'message' | 'key' | 'record';
      presence: 'present' | 'none' | 'unresolved';
      shape: string | null;
      contentType: string | null;
      gaps: string[];
      evidence: string[];
      sourceShape: string | null;
    };
    meaning: string;
    evidence: string[];
  }[];
  gaps: string[];
  /**
   * @minItems 1
   */
  evidence: [string, ...string[]];
  version?: string | null;
  candidates?: string[];
}
export interface EntryBinding {
  id: string;
  kind: 'entry_binding';
  entry: string;
  execution: string;
  contract: string;
  gaps: string[];
  /**
   * @minItems 1
   */
  evidence: [string, ...string[]];
}
export interface Interaction {
  id: string;
  kind: 'interaction';
  owner: string;
  execution: string;
  operation: string;
  target: string | null;
  /**
   * Known provider entry at the target component. Distinct caller_construction and source_declared provider contracts require identical established HTTP/HTTPS/gRPC protocol, method and path. Source address correspondence does not prove payload compatibility or deployed version correspondence.
   */
  targetEntry: string | null;
  /**
   * Contract describing the actual caller or consumer values. A linked provider entry may expose its own separate source-declared contract.
   */
  contract: string;
  effect: string | null;
  handoff: string | null;
  mode: 'request_response' | 'publish' | 'consume' | 'read' | 'write' | 'unknown';
  boundary: 'network' | 'in_process' | 'unresolved';
  waitsFor: 'response' | 'producer_result' | 'store_result' | 'handler_result' | 'none' | 'unknown';
  condition: string;
  requestBindings: {
    part:
      'path' | 'query' | 'headers' | 'body' | 'message' | 'key' | 'selection' | 'record' | 'result';
    path: string[];
    value: string;
    transform: string;
  }[];
  responseBindings: {
    part:
      'path' | 'query' | 'headers' | 'body' | 'message' | 'key' | 'selection' | 'record' | 'result';
    path: string[];
    value: string;
    transform: string;
  }[];
  gaps: string[];
  /**
   * @minItems 1
   */
  evidence: [string, ...string[]];
}
export interface KnowledgeSnapshot {
  format: 'groundwork-snapshot/v1' | 'groundwork-snapshot/v2' | 'groundwork-snapshot/v3';
  id: string;
  bundles: string[];
  interpretations: string[];
  rules: 'knowledge-query/v1' | 'knowledge-query/v2' | 'knowledge-query/v3';
}
export interface QueryRequest {
  format: 'groundwork-query/v1' | 'groundwork-query/v2' | 'groundwork-query/v3';
  snapshot: string;
  query:
    | 'trace'
    | 'value'
    | 'outcome'
    | 'effects'
    | 'impact'
    | 'continuations'
    | 'consistency'
    | 'records'
    | 'interactions';
  entry: string;
  value: string | null;
  context: string[];
  outcome: number | null;
  changed: string[];
  representation: Representation;
  candidates: 'exclude';
  maxNodes: number;
  environment?: string;
  maxRecords?: number;
  ids?: string[];
  omit?: string[];
  /**
   * Catalogue owners whose related facts are selected. Omission defaults to explicit records-query ids; pagination preserves the original selection.
   */
  associationOwners?: string[];
}
export interface QueryResponse {
  format: 'groundwork-result/v1' | 'groundwork-result/v2' | 'groundwork-result/v3';
  snapshot: string;
  queryVersion: 'knowledge-query/v1' | 'knowledge-query/v2' | 'knowledge-query/v3';
  request: QueryRequest;
  nodes: QueryNode[];
  edges: QueryEdge[];
  claims: string[];
  evidence: string[];
  coverage: string[];
  frontiers: Frontier[];
  limitsHit: ('maxNodes' | 'maxRecords')[];
  feasibility: 'not_checked';
  exhaustive: false;
  records: KnowledgeRecord[];
  traversalComplete: boolean;
  findings: {
    statement: string;
    support: string[];
    assumptions: string[];
  }[];
  nextRequest?: QueryRequest | null;
  sourceLinks?: {
    evidence: string;
    url: string;
    label: string;
  }[];
}
export interface QueryNode {
  id: string;
  record: string;
  context: string[];
  label: string;
  component?: string | null;
  execution?: string | null;
}
export interface QueryEdge {
  from: string;
  to: string;
  on: string;
  condition: string | null;
  assumption: string | null;
  evidence: string[];
  record: string | null;
  context?: string[];
  operation?: string;
}
export interface Frontier {
  at: string;
  reason:
    | 'version_unresolved'
    | 'opaque'
    | 'cycle'
    | 'query_limit'
    | 'representation_unresolved'
    | 'binding_unresolved'
    | 'unhandled_exception'
    | 'support_limit'
    | 'concurrency_unresolved';
  detail: string;
  references: string[];
}
