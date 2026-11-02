/* Generated from schema/scan.schema.json. Run node tools/generate-scan-types.ts. */

/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Concern".
 */
export type Concern =
  | 'control'
  | 'inputs'
  | 'outputs'
  | 'calls'
  | 'storage'
  | 'failures'
  | 'asynchronous'
  | 'controls'
  | 'actor_conditions'
  | 'visible_outcomes'
  | 'execution_mapping'
  | 'freshness';
/**
 * @minItems 1
 *
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Support".
 */
export type Support = [string, ...string[]];
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "ReasonCode".
 */
export type ReasonCode =
  'unsupported' | 'ambiguous' | 'missing_dependency' | 'budget' | 'missing_evidence';
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Answer".
 */
export type Answer =
  | {
      state: 'supported';
      /**
       * @minItems 0
       */
      value: string[];
      support: Support;
      closure?: string;
    }
  | {
      state: 'unresolved';
      reason: ReasonCode;
      gap: string;
    }
  | {
      state: 'not_examined';
      obligation: string;
    }
  | {
      state: 'not_applicable';
      rule: string;
      support: Support;
    }
  | {
      state: 'conflicting';
      /**
       * @minItems 2
       */
      alternatives: [SupportedValue, SupportedValue, ...SupportedValue[]];
    };
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Shape".
 */
export type Shape =
  | {
      kind: 'scalar';
      name: 'string' | 'number' | 'integer' | 'boolean' | 'null';
      spelling: string;
    }
  | {
      kind: 'literal';
      value: string | number | boolean | null;
      spelling: string;
    }
  | {
      kind: 'enum';
      /**
       * @minItems 1
       */
      values: [string | number | boolean | null, ...(string | number | boolean | null)[]];
      spelling: string;
    }
  | {
      kind: 'object';
      /**
       * @minItems 0
       */
      fields: ShapeField[];
      additionalProperties: boolean;
      spelling: string;
      enforcement: 'source' | 'wire' | 'persisted';
    }
  | {
      kind: 'array';
      item: Shape;
      spelling: string;
    }
  | {
      kind: 'map';
      key: Shape;
      value: Shape;
      spelling: string;
    }
  | {
      kind: 'tuple';
      /**
       * @minItems 0
       */
      items: Shape[];
      spelling: string;
    }
  | {
      kind: 'union';
      /**
       * @minItems 2
       */
      alternatives: [Shape, Shape, ...Shape[]];
      spelling: string;
    }
  | {
      kind: 'reference';
      target: string;
      spelling: string;
    }
  | {
      kind: 'unresolved';
      reason: ReasonCode;
      spelling: string;
    };
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Operation".
 */
export type Operation =
  | {
      kind: 'control';
      id: string;
      source: string;
      predicate: Predicate;
      /**
       * @minItems 0
       */
      otherwise: string[];
      /**
       * @minItems 0
       */
      consequent: string[];
    }
  | {
      kind: 'call';
      id: string;
      source: string;
      target: Answer;
      /**
       * @minItems 0
       */
      arguments: string[];
      waiting: 'sync' | 'awaited' | 'detached' | 'returned';
      result?: string;
      callee: string;
    }
  | {
      kind: 'await';
      id: string;
      source: string;
      task: string;
      result?: string;
    }
  | {
      kind: 'return';
      id: string;
      source: string;
      value: ReturnValue;
    }
  | {
      kind: 'throw';
      id: string;
      source: string;
      value: string;
    }
  | {
      kind: 'opaque';
      id: string;
      source: string;
      frontier: string;
    };
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "ReturnValue".
 */
export type ReturnValue =
  | {
      kind: 'void';
    }
  | {
      kind: 'value';
      /**
       * @minItems 1
       */
      values: [string, ...string[]];
    }
  | {
      kind: 'tuple';
      /**
       * @minItems 1
       */
      values: [string, ...string[]];
    }
  | {
      kind: 'task';
      /**
       * @minItems 1
       */
      values: [string, ...string[]];
    }
  | {
      kind: 'unresolved';
      gap: string;
    };
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Continuation".
 */
export type Continuation =
  | {
      kind: 'stay';
      surface: string;
      state: string;
    }
  | {
      kind: 'navigate';
      surface: string;
      state: string;
    }
  | {
      kind: 'external';
      target: string;
      return: Answer;
    }
  | {
      kind: 'terminal';
      goal: string;
    }
  | {
      kind: 'unresolved';
      gap: string;
    };
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "ExecutionTarget".
 */
export type ExecutionTarget =
  | {
      kind: 'local';
      summary: string;
      operation: string;
    }
  | {
      kind: 'entry';
      entry: string;
      knowledgeFormat: 'knowledge/v3';
    }
  | {
      kind: 'handoff';
      target: string;
      return: Answer;
    }
  | {
      kind: 'unresolved';
      gap: string;
    };
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "RefObservation".
 */
export type RefObservation =
  | {
      checkedAt: string;
      ref: string;
      source: 'local' | 'remote';
      status: 'observed';
      revision: string;
    }
  | {
      checkedAt: string;
      ref: string;
      source: 'local' | 'remote';
      status: 'unavailable';
      error: string;
    };
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "ConstraintExpression".
 */
export type ConstraintExpression =
  | {
      kind: 'all';
      /**
       * @minItems 1
       */
      constraints: [string, ...string[]];
    }
  | {
      kind: 'any';
      /**
       * @minItems 1
       */
      constraints: [string, ...string[]];
    }
  | {
      kind: 'not';
      constraint: string;
    }
  | {
      kind: 'predicate';
      source: string;
      expression: string;
      inputs: string[];
    };
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "SemanticRecord".
 */
export type SemanticRecord = SemanticNode | SemanticEdge;
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "SourceScalar".
 */
export type SourceScalar = string | number | boolean | null;
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "FrameworkRecord".
 */
export type FrameworkRecord =
  | SpringSchemaBinding
  | SpringRouteBinding
  | SpringSecurityBinding
  | AspNetRouteBinding
  | SourceFrameworkBinding;
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "BindingRecord".
 */
export type BindingRecord =
  | JavaCallBinding
  | JavaValueBinding
  | MongoCollectionBinding
  | MongoRepositoryBinding
  | MongoOperationBinding
  | ExceptionBinding
  | OutboundBinding
  | GraphqlBinding
  | LibraryBinding
  | JavaConstantBinding
  | GraphqlDocumentBinding
  | AsyncBinding
  | ExecutionBinding
  | EventBinding
  | ConfigurationBinding
  | ConsumerBinding
  | EnumBinding
  | JavaCollectionBinding
  | ScheduleBinding
  | CsharpSymbolBinding;
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "CallResultUse".
 */
export type CallResultUse = 'ignored' | 'returned' | 'joined' | 'bound' | 'unknown';
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "ScheduleAnnotationType".
 */
export type ScheduleAnnotationType =
  | 'org.springframework.scheduling.annotation.Scheduled'
  | 'net.javacrumbs.shedlock.spring.annotation.SchedulerLock'
  | 'org.springframework.scheduling.annotation.EnableScheduling'
  | 'net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock';
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "SemanticOperator".
 */
export type SemanticOperator =
  | '='
  | ':='
  | '+='
  | '-='
  | '*='
  | '/='
  | '%='
  | '**='
  | '<<='
  | '>>='
  | '>>>='
  | '&='
  | '|='
  | '^='
  | '&^='
  | '&&='
  | '||='
  | '??='
  | '=='
  | '!='
  | '==='
  | '!=='
  | '<'
  | '<='
  | '>'
  | '>='
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '**'
  | '<<'
  | '>>'
  | '>>>'
  | '&'
  | '|'
  | '^'
  | '&^'
  | '&&'
  | '||'
  | '??'
  | '!'
  | '~'
  | '++'
  | '--'
  | '<-'
  | 'typeof'
  | 'void'
  | 'delete'
  | 'in'
  | 'instanceof'
  | ',';

export interface ScanDocument {
  format: 'scan/v1';
  id: string;
  /**
   * @minItems 0
   */
  sources: Source[];
  /**
   * @minItems 0
   */
  rules: Rule[];
  /**
   * @minItems 0
   */
  derivations: Derivation[];
  /**
   * @minItems 0
   */
  gaps: Gap[];
  /**
   * @minItems 0
   */
  obligations: Obligation[];
  /**
   * @minItems 0
   */
  receipts: QuestionReceipt[];
  /**
   * @minItems 0
   */
  hosts: Host[];
  /**
   * @minItems 0
   */
  contracts: Contract[];
  /**
   * @minItems 0
   */
  effects: Effect[];
  /**
   * @minItems 0
   */
  summaries: LocalSummary[];
  /**
   * @minItems 0
   */
  actors: Actor[];
  /**
   * @minItems 0
   */
  surfaces: Surface[];
  /**
   * @minItems 0
   */
  controls: Control[];
  /**
   * @minItems 0
   */
  actions: UserAction[];
  /**
   * @minItems 0
   */
  outcomes: ActionOutcome[];
  /**
   * @minItems 0
   */
  executions: ActionExecutionBinding[];
  /**
   * @minItems 0
   */
  journeys: Journey[];
  /**
   * @minItems 0
   */
  dependencies: Dependency[];
  /**
   * @minItems 0
   */
  closures: DependencyClosure[];
  freshness?: FreshnessResult;
  searches?: SearchReceipt[];
  actorConstraints?: ActorConstraint[];
  semantic?: SemanticRecord[];
  framework?: FrameworkRecord[];
  bindings?: BindingRecord[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Source".
 */
export interface Source {
  kind: 'source';
  id: string;
  repo: string;
  path: string;
  commit: string;
  blob: string;
  /**
   * @minItems 2
   * @maxItems 2
   */
  lines: [number, number];
  host: string;
  authority: 'declared' | 'tested' | 'observed';
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Rule".
 */
export interface Rule {
  kind: 'rule';
  id: string;
  version: string;
  /**
   * @minItems 1
   */
  concerns: [Concern, ...Concern[]];
  applicability: 'extraction' | 'inapplicable';
  /**
   * @minItems 0
   */
  prerequisites: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Derivation".
 */
export interface Derivation {
  kind: 'derivation';
  id: string;
  rule: string;
  sources: Support;
  /**
   * @minItems 0
   */
  inputs: string[];
  /**
   * @minItems 0
   */
  dependencies: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Gap".
 */
export interface Gap {
  kind: 'gap';
  id: string;
  reason: ReasonCode;
  description: string;
  source?: string;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Obligation".
 */
export interface Obligation {
  kind: 'obligation';
  id: string;
  version: 'questions/v1';
  profile: 'endpoint' | 'action';
  scope: string;
  concern: Concern;
  /**
   * @minItems 0
   */
  allowedInapplicabilityRules: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "QuestionReceipt".
 */
export interface QuestionReceipt {
  kind: 'receipt';
  id: string;
  scope: string;
  profile: 'endpoint' | 'action';
  /**
   * @minItems 1
   */
  obligations: [string, ...string[]];
  /**
   * @minItems 1
   */
  answers: [
    {
      obligation: string;
      answer: Answer;
    },
    ...{
      obligation: string;
      answer: Answer;
    }[],
  ];
  authority: 'declared' | 'tested' | 'observed';
  closure?: string;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "SupportedValue".
 */
export interface SupportedValue {
  /**
   * @minItems 0
   */
  value: string[];
  support: Support;
  closure?: string;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Host".
 */
export interface Host {
  kind: 'host';
  id: string;
  component: string;
  environment: 'browser' | 'server' | 'worker' | 'unknown';
  support: Support;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Contract".
 */
export interface Contract {
  kind: 'contract';
  id: string;
  shape: Shape;
  support: Support;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "ShapeField".
 */
export interface ShapeField {
  name: string;
  presence: 'required' | 'optional';
  nullable: boolean;
  shape: Shape;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Effect".
 */
export interface Effect {
  kind: 'effect';
  id: string;
  phase: 'read' | 'staged' | 'acknowledged' | 'committed' | 'published' | 'delivered' | 'unknown';
  resource: string;
  source: string;
  support: Support;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "LocalSummary".
 */
export interface LocalSummary {
  kind: 'summary';
  id: string;
  host: string;
  source: string;
  implementation: string;
  context: SummaryContext;
  /**
   * @minItems 0
   */
  operations: Operation[];
  effects: Answer;
  /**
   * @minItems 0
   */
  frontiers: Frontier[];
  support: Support;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "SummaryContext".
 */
export interface SummaryContext {
  receiver?: string;
  /**
   * @minItems 0
   */
  arguments: string[];
  /**
   * @minItems 0
   */
  captures: string[];
  /**
   * @minItems 0
   */
  typeArguments: string[];
  /**
   * @minItems 0
   */
  configuration: string[];
  /**
   * @minItems 0
   */
  policy: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Predicate".
 */
export interface Predicate {
  expression: string;
  polarity: boolean;
  /**
   * @minItems 0
   */
  inputs: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Frontier".
 */
export interface Frontier {
  kind: 'frontier';
  id: string;
  reason: ReasonCode;
  source: string;
  nextQuestion: string;
  /**
   * @minItems 0
   */
  contextLoss: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Actor".
 */
export interface Actor {
  kind: 'actor';
  id: string;
  name: string;
  authority: 'authored' | 'source_candidate' | 'observed';
  support: Support;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Surface".
 */
export interface Surface {
  kind: 'surface';
  id: string;
  name: string;
  type: 'page' | 'dialog' | 'email' | 'push' | 'download';
  /**
   * @minItems 1
   */
  states: [string, ...string[]];
  support: Support;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Control".
 */
export interface Control {
  kind: 'control_binding';
  id: string;
  action: string;
  surface: string;
  state: string;
  trigger: 'activate' | 'submit' | 'change' | 'gesture' | 'voice' | 'keyboard' | 'navigate';
  source: string;
  availability: Answer;
  support: Support;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "UserAction".
 */
export interface UserAction {
  kind: 'action';
  id: string;
  intent: string;
  /**
   * @minItems 1
   */
  actors: [string, ...string[]];
  conditions: {
    eligibility: Answer;
    authentication: Answer;
    authorisation: Answer;
    ownership: Answer;
  };
  /**
   * @minItems 0
   */
  controls: string[];
  input: Answer;
  executions: Answer;
  /**
   * @minItems 1
   */
  outcomes: [string, ...string[]];
  support: Support;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "ActionOutcome".
 */
export interface ActionOutcome {
  kind: 'outcome';
  id: string;
  action: string;
  result:
    | 'success'
    | 'invalid_input'
    | 'denied'
    | 'not_found'
    | 'failure'
    | 'cancelled'
    | 'pending'
    | 'unresolved';
  visibleState: Answer;
  effects: Answer;
  timing: 'immediate' | 'accepted' | 'eventual' | 'unknown';
  continuation: Continuation;
  support: Support;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "ActionExecutionBinding".
 */
export interface ActionExecutionBinding {
  kind: 'execution';
  id: string;
  action: string;
  host: string;
  operation: string;
  source: string;
  guard: Answer;
  target: ExecutionTarget;
  /**
   * @minItems 0
   */
  inputMappings: Mapping[];
  /**
   * @minItems 0
   */
  outcomeMappings: {
    response: string;
    outcome: string;
    support: Support;
  }[];
  support: Support;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Mapping".
 */
export interface Mapping {
  from: string;
  to: string;
  support: Support;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Journey".
 */
export interface Journey {
  kind: 'journey';
  id: string;
  actor: string;
  goal: string;
  authority: 'authored' | 'derived' | 'observed';
  /**
   * @minItems 1
   */
  steps: [
    {
      action: string;
      outcome: string;
    },
    ...{
      action: string;
      outcome: string;
    }[],
  ];
  /**
   * @minItems 0
   */
  transitions: {
    from: string;
    to: string;
    guard: Answer;
  }[];
  support: Support;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "Dependency".
 */
export interface Dependency {
  id: string;
  kind: 'source' | 'configuration' | 'rule' | 'toolchain' | 'inventory' | 'negative_lookup';
  fingerprint: string;
  /**
   * @minItems 0
   */
  dependsOn: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "DependencyClosure".
 */
export interface DependencyClosure {
  id: string;
  complete: boolean;
  /**
   * @minItems 0
   */
  dependencies: string[];
  /**
   * @minItems 1
   */
  searches: [string, ...string[]];
  containingScope: string;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "FreshnessResult".
 */
export interface FreshnessResult {
  state:
    | 'unchanged'
    | 'changed'
    | 'configuration-changed'
    | 'rules-changed'
    | 'ref-rewritten'
    | 'baseline-unavailable'
    | 'observation-unavailable'
    | 'unknown-provenance';
  baseline: SourceBaseline;
  observation: RefObservation;
  sourceCurrent: boolean;
  deploymentCurrent: 'unknown';
  /**
   * @minItems 0
   */
  changedFiles: GitFileChange[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "SourceBaseline".
 */
export interface SourceBaseline {
  repo: string;
  commit: string;
  tree: string;
  ref: string;
  environmentDigest: string;
  ruleDigest: string;
  toolchainDigest: string;
  configDigest: string;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "GitFileChange".
 */
export interface GitFileChange {
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'type-changed';
  path: string;
  previousPath?: string;
  oldBlob?: string;
  newBlob?: string;
  binary?: boolean;
  gitlink?: boolean;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "SearchReceipt".
 */
export interface SearchReceipt {
  id: string;
  kind: 'search';
  scope: string;
  rule: string;
  sources: Support;
  inventoryFingerprint: string;
  complete: boolean;
  /**
   * @minItems 1
   */
  queries: [string, ...string[]];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "ActorConstraint".
 */
export interface ActorConstraint {
  kind: 'actor_constraint';
  id: string;
  concern: 'eligibility' | 'authentication' | 'authorisation' | 'ownership' | 'availability';
  authority: 'declared' | 'enforcement_bound' | 'unresolved';
  expression: ConstraintExpression;
  support: Support;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "SemanticNode".
 */
export interface SemanticNode {
  kind: 'semantic_node';
  id: string;
  owner: string;
  source: string;
  nodeKind:
    | 'identifier'
    | 'literal'
    | 'member'
    | 'index'
    | 'call'
    | 'construct'
    | 'object'
    | 'array'
    | 'property'
    | 'binary'
    | 'unary'
    | 'conditional'
    | 'template'
    | 'declaration'
    | 'parameter'
    | 'assignment'
    | 'return'
    | 'throw'
    | 'if'
    | 'loop'
    | 'try'
    | 'catch'
    | 'finally'
    | 'defer'
    | 'block'
    | 'function'
    | 'annotation'
    | 'jsx_element'
    | 'jsx_attribute'
    | 'sql'
    | 'resource'
    | 'runtime_boundary'
    | 'expression'
    | 'field'
    | 'control'
    | 'await'
    | 'callback'
    | 'import'
    | 'unknown'
    | 'value'
    | 'branch'
    | 'type'
    | 'sql_column'
    | 'variable'
    | 'invocation'
    | 'policy';
  syntax: string;
  name?: string;
  operator?: string;
  authority?: 'declared' | 'unresolved';
  value?: SourceScalar;
  declaredAsync?: boolean;
  returnType?: string;
  optionalAccess?: boolean;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "SemanticEdge".
 */
export interface SemanticEdge {
  kind: 'semantic_edge';
  id: string;
  owner: string;
  source: string;
  relation:
    | 'operand'
    | 'receiver'
    | 'callee'
    | 'argument'
    | 'property'
    | 'value'
    | 'target'
    | 'condition'
    | 'consequent'
    | 'otherwise'
    | 'body'
    | 'catch'
    | 'finally'
    | 'deferred'
    | 'initializer'
    | 'assigns'
    | 'reaching_definition'
    | 'returns'
    | 'parameter'
    | 'capture'
    | 'annotation'
    | 'callback'
    | 'registration'
    | 'continuation'
    | 'awaited'
    | 'resource'
    | 'sql_parameter'
    | 'column_binding'
    | 'available_when'
    | 'next'
    | 'call_target'
    | 'contains'
    | 'reads'
    | 'binds'
    | 'awaits'
    | 'field_value'
    | 'captures'
    | 'precedes'
    | 'ast_child'
    | 'left'
    | 'right'
    | 'assigned_value'
    | 'statement'
    | 'try_body'
    | 'catches'
    | 'declared_type'
    | 'key'
    | 'initialiser'
    | 'reaching_value'
    | 'scheduling_unknown'
    | 'delivery_unknown'
    | 'rollback_unknown'
    | 'registry_context_unknown'
    | 'scope';
  from: string;
  to: string;
  position?: number;
  label?: string;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "SpringSchemaBinding".
 */
export interface SpringSchemaBinding {
  kind: 'schema_binding';
  id: string;
  typeName: string;
  direction: 'source' | 'request' | 'response';
  properties: SpringDeclaredProperty[];
  inheritedTypes: string[];
  genericArguments: string[];
  enumValues: string[];
  polymorphism: SpringPolymorphism | null;
  completeness: 'complete' | 'partial';
  gaps: SpringSchemaGap[];
  source: string;
  support: string[];
  profiles: SpringSchemaProfile[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "SpringDeclaredProperty".
 */
export interface SpringDeclaredProperty {
  name: string;
  jsonName: string;
  type: string;
  source: string;
  constraints: SpringConstraint[];
  views: string[];
  presence: 'unknown';
  nullable: 'unknown';
  access: 'declared_field' | 'declared_getter';
  annotations: SpringSchemaAnnotation[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "SpringConstraint".
 */
export interface SpringConstraint {
  annotation: string;
  groups: string[];
  attributes: Record<string, string | undefined>;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "SpringSchemaAnnotation".
 */
export interface SpringSchemaAnnotation {
  name: string;
  arguments: Record<string, string | undefined>;
  source: string;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "SpringPolymorphism".
 */
export interface SpringPolymorphism {
  strategy: string | null;
  discriminator: string | null;
  defaultType: string | null;
  visible: string | null;
  subtypes: {
    type: string;
    name: string | null;
  }[];
  unresolved: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "SpringSchemaGap".
 */
export interface SpringSchemaGap {
  kind: string;
  typeName: string;
  detail: string;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "SpringSchemaProfile".
 */
export interface SpringSchemaProfile {
  routeId: string;
  direction: 'request' | 'response';
  validationGroups: string[];
  views: string[];
  fields: {
    name: string;
    included: true | false | 'unknown';
    constraints: SpringConstraint[];
    nonNull: true | false | 'unknown';
  }[];
  completeness: 'complete' | 'partial';
  gaps: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "springRouteBinding".
 */
export interface SpringRouteBinding {
  kind: 'route_binding';
  id: string;
  source_ids: string[];
  controller: string;
  method: {
    name: string;
    parameter_types: string[];
    return_type: string;
    implementation_source_id?: string;
    declaration_source_id: string;
  };
  http_method: string;
  path: string;
  parameters: {
    name: string;
    java_name: string;
    type: string;
    location: 'header' | 'query' | 'path' | 'body' | 'unbound';
    required?: boolean;
    default_value?: string;
    source_id: string;
    validation_groups: string[];
    json_views: string[];
  }[];
  response_status?: string;
  documented_response_statuses: string[];
  response_json_views: string[];
  request_validation_groups: string[];
  security_binding_ids: string[];
  schema_binding_ids?: string[];
  uncertainties: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "springSecurityBinding".
 */
export interface SpringSecurityBinding {
  kind: 'security_binding';
  id: string;
  source_ids: string[];
  mechanism: 'method_authorisation' | 'header_interceptor' | 'filter_chain';
  scope: string;
  policies: {
    expression: string;
    source_id: string;
    paths?: string[];
    excluded_paths?: string[];
  }[];
  activation: {
    state: 'source_enabled' | 'unresolved' | 'disabled';
    source_ids: string[];
  };
  authentication: string[];
  authorisation: string[];
  enforcement_chain: {
    stage: string;
    source_ids: string[];
    detail: string;
  }[];
  uncertainties: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "AspNetRouteBinding".
 */
export interface AspNetRouteBinding {
  kind: 'aspnet_route_binding';
  id: string;
  source: string;
  support: Support;
  controller: string;
  method: string;
  /**
   * @minItems 1
   */
  httpMethods: [
    'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS',
    ...('GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS')[],
  ];
  template: string | null;
  parameters: {
    name: string;
    type: string;
    source: string;
  }[];
  status: 'source_declared';
  /**
   * @minItems 1
   */
  limitations: [string, ...string[]];
  input_contract_ids: string[];
  output_contract_ids: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "SourceFrameworkBinding".
 */
export interface SourceFrameworkBinding {
  kind: 'source_framework_binding';
  id: string;
  source: string;
  support: Support;
  language: 'python' | 'rust';
  framework: 'fastapi' | 'graphene' | 'apollo-router' | 'serde';
  role: 'http_entry' | 'graphql_field' | 'plugin_entry' | 'declared_schema';
  name: string;
  target_source: string | null;
  declaration: string;
  status: 'source_declared' | 'partial';
  /**
   * @minItems 1
   */
  limitations: [string, ...string[]];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "JavaCallBinding".
 */
export interface JavaCallBinding {
  kind: 'java_call_binding';
  id: string;
  call: string;
  caller: string | null;
  receiver: string | null;
  receiverType: string | null;
  methodName: string;
  argumentTypes: (string | null)[];
  target: string | null;
  signature: string | null;
  resolution: 'exact' | 'unresolved';
  reason: string;
  guards: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "JavaValueBinding".
 */
export interface JavaValueBinding {
  kind: 'java_value_binding';
  id: string;
  relation:
    | 'argument_parameter'
    | 'return_call'
    | 'initializer'
    | 'assignment'
    | 'reference'
    | 'field_projection';
  from: string;
  to: string;
  call: string | null;
  guards: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "mongoCollectionBinding".
 */
export interface MongoCollectionBinding {
  kind: 'mongo_collection_binding';
  id: string;
  entityType: string;
  collection: string | null;
  source: string;
  gaps: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "mongoRepositoryBinding".
 */
export interface MongoRepositoryBinding {
  kind: 'mongo_repository_binding';
  id: string;
  repositoryType: string;
  entityType: string;
  collection_id: string;
  idType: string;
  fragments: {
    interfaceType: string;
    implementationType: string | null;
    source: string;
  }[];
  methods: {
    name: string;
    operation: 'read' | 'write' | 'unknown';
    source: string;
    readPreference: string | null;
  }[];
  source: string;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "mongoOperationBinding".
 */
export interface MongoOperationBinding {
  kind: 'mongo_operation_binding';
  id: string;
  receiverType: string;
  receiver_source: string;
  method: string;
  operation: 'read' | 'write' | 'unknown';
  collection_id: string;
  repository_id: string | null;
  entityType: string;
  filter_fields: string[];
  update_fields: {
    operator: '$set' | '$setOnInsert';
    field: string;
    source: string;
  }[];
  source: string;
  support: string[];
  gaps: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "ExceptionBinding".
 */
export interface ExceptionBinding {
  kind: 'exception_binding';
  id: string;
  source_ids: string[];
  thrown_type: string;
  throw_source_id: string;
  throwing_method_source_id: string;
  constructor_argument_source_ids: string[];
  guard_source_ids: string[];
  enclosing_try_source_ids: string[];
  candidates: ExceptionHandlerBinding[];
  resolution: 'resolved' | 'unresolved';
  uncertainties: string[];
  local_controller_handler_source_ids: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "ExceptionHandlerBinding".
 */
export interface ExceptionHandlerBinding {
  advice: string;
  advice_source_id: string;
  handler_source_id: string;
  handled_type: string;
  scope: 'global' | 'unresolved';
  response_status?: string;
  response_return_source_ids: string[];
  response_construction_source_ids: string[];
  support_source_ids: string[];
  response_construction_owners: {
    source_id: string;
    owner_method_source_id: string;
  }[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "OutboundBinding".
 */
export interface OutboundBinding {
  kind: 'outbound_binding';
  id: string;
  source: string;
  owner_source: string;
  client: {
    type: string;
    receiver_source: string;
    logical_name: string | null;
    registry_source: string | null;
  };
  request: {
    method: string;
    method_source: string;
    uri_source: string;
    template: string | null;
    argument_sources: string[];
    headers: {
      name: string | null;
      source: string;
      value_sources: string[];
    }[];
    accept_sources: string[];
    body_sources: string[];
  };
  response: {
    type: string | null;
    type_source: string | null;
    body_source: string;
    return_sources: string[];
  };
  failure_paths: {
    caught_type: string;
    source: string;
    thrown_type: string | null;
    thrown_source: string | null;
  }[];
  call_binding_ids: string[];
  value_binding_ids: string[];
  support: string[];
  completeness: 'source_path' | 'partial';
  gaps: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "GraphqlBinding".
 */
export interface GraphqlBinding {
  id: string;
  source: string;
  owner_source: string;
  call_binding_ids: string[];
  value_binding_ids: string[];
  support: string[];
  completeness: 'source_path' | 'partial';
  gaps: string[];
  kind: 'graphql_binding';
  client: {
    type: string;
    receiver_source: string;
    logical_name: string | null;
    registry_source: string | null;
  };
  document_name: string | null;
  document_source: string;
  variables: {
    name: string | null;
    source: string;
    value_sources: string[];
  }[];
  execution_source: string;
  response: {
    field_path: string | null;
    field_source: string | null;
    type: string | null;
    type_source: string | null;
    body_source: string;
    return_sources: string[];
  };
  failure_paths: {
    caught_type: string;
    source: string;
    thrown_type: string | null;
    thrown_source: string | null;
  }[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "LibraryBinding".
 */
export interface LibraryBinding {
  id: string;
  source: string;
  owner_source: string;
  call_binding_ids: string[];
  value_binding_ids: string[];
  support: string[];
  completeness: 'source_path' | 'partial';
  gaps: string[];
  kind: 'library_binding';
  owner_type: string;
  method_name: string;
  call_source: string;
  receiver_source: string | null;
  argument_sources: string[];
  result_type: string | null;
  contract_basis: 'source_declared_type' | 'framework_api';
  failure_paths: {
    caught_type: string;
    source: string;
    thrown_type: string | null;
    thrown_source: string | null;
  }[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "JavaConstantBinding".
 */
export interface JavaConstantBinding {
  kind: 'java_constant_binding';
  id: string;
  source: string;
  value_source: string;
  owner_type: string;
  name: string;
  type: string;
  value: string | number | boolean | null;
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "GraphqlDocumentBinding".
 */
export interface GraphqlDocumentBinding {
  kind: 'graphql_document_binding';
  id: string;
  source: string;
  document_name: string;
  operation_type: 'query' | 'mutation' | 'subscription';
  operation_name: string | null;
  variables: {
    name: string;
    type: string;
    source: string;
  }[];
  selections: {
    path: string;
    field_name: string;
    arguments: {
      name: string;
      variable: string;
      source: string;
    }[];
    source: string;
  }[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "AsyncBinding".
 */
export interface AsyncBinding {
  id: string;
  source: string;
  owner_source: string;
  call_binding_ids: string[];
  value_binding_ids: string[];
  support: string[];
  completeness: 'partial';
  gaps: string[];
  kind: 'async_binding';
  owner_type: string;
  annotation_source: string;
  executor: string | null;
  activation_sources: string[];
  executor_sources: string[];
  activation: 'declared_runtime_unverified';
  return_type: string;
  completion: 'void' | 'future' | 'unknown';
  invocations: {
    call_source: string;
    owner_source: string | null;
    call_binding_id: string;
    dispatch: 'direct_self' | 'receiver_proxy_unverified';
    use: CallResultUse;
    use_source: string;
  }[];
  conditions: SpringConditionDeclaration[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "SpringConditionDeclaration".
 */
export interface SpringConditionDeclaration {
  source: string;
  owner_source: string;
  annotation_type:
    | 'org.springframework.boot.autoconfigure.condition.ConditionalOnBean'
    | 'org.springframework.boot.autoconfigure.condition.ConditionalOnProperty';
  arguments: {
    name: string;
    expression: string;
  }[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "ExecutionBinding".
 */
export interface ExecutionBinding {
  id: string;
  source: string;
  owner_source: string;
  call_binding_ids: string[];
  value_binding_ids: string[];
  support: string[];
  completeness: 'partial';
  gaps: string[];
  kind: 'execution_binding';
  owner_type: string;
  call_results: {
    call_source: string;
    call_binding_id: string;
    use: CallResultUse;
    use_source: string;
  }[];
  return_sources: string[];
  throw_sources: string[];
  catch_sources: string[];
  finally_sources: string[];
  transaction_sources: string[];
  transaction: 'declared_runtime_unverified' | 'none_in_selected_declaration';
  failure: 'source_paths_only';
  completion: 'source_returns_only';
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "EventBinding".
 */
export interface EventBinding {
  id: string;
  source: string;
  owner_source: string;
  call_binding_ids: string[];
  value_binding_ids: string[];
  support: string[];
  completeness: 'partial';
  gaps: string[];
  kind: 'event_binding';
  client: {
    type: string;
    receiver_source: string;
  };
  operation: string;
  contract: 'spring_kafka' | 'external_sdk_source';
  arguments: {
    position: number;
    role: string;
    source: string;
    type: string | null;
  }[];
  constructions: {
    source: string;
    type: string | null;
    argument_sources: string[];
    fields: {
      field: string;
      field_source: string;
      value_source: string;
    }[];
  }[];
  builder_calls: {
    source: string;
    operation: string;
    receiver_source: string;
    argument_sources: string[];
  }[];
  selectors: {
    source: string;
    receiver_type: string | null;
    operation: string;
    target_source: string | null;
  }[];
  conditions: {
    source: string;
    condition_source: string;
    consequent_source: string | null;
    alternative_source: string | null;
    return_sources: string[];
  }[];
  comparisons: {
    source: string;
    operator: string;
    operand_sources: string[];
  }[];
  result_observation: 'discarded' | 'returned' | 'assigned' | 'composed';
  failure_paths: {
    caught_type: string;
    source: string;
    thrown_type: string | null;
    thrown_source: string | null;
  }[];
  candidate_helpers: {
    call_source: string;
    target_source: string;
    argument_sources: string[];
    parameter_sources: string[];
    resolution: 'source_candidate';
  }[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "ConfigurationBinding".
 */
export interface ConfigurationBinding {
  kind: 'configuration_binding';
  id: string;
  source: string;
  format: 'java_properties' | 'yaml' | 'properties';
  declared_type: string | null;
  prefix: string | null;
  profile: string | null;
  properties: {
    key: string;
    value: SourceScalar;
    value_kind: 'declaration' | 'literal' | 'expression' | 'unresolved';
    type: string | null;
    source: string;
    placeholders: string[];
  }[];
  selectors: {
    source: string;
    receiver_type: string;
    operation: string;
    property_key: string;
    property_source: string;
  }[];
  factories: {
    source: string;
    name: string;
    return_type: string;
    parameter_sources: string[];
    call_binding_ids: string[];
  }[];
  completeness: 'partial';
  gaps: string[];
  conditions: SpringConditionDeclaration[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "ConsumerBinding".
 */
export interface ConsumerBinding {
  kind: 'consumer_binding';
  id: string;
  source: string;
  owner_source: string;
  owner_type: string;
  annotation_source: string;
  selectors: {
    role:
      | 'topics'
      | 'topicPattern'
      | 'topicPartitions'
      | 'groupId'
      | 'containerFactory'
      | 'batch'
      | 'autoStartup'
      | 'properties';
    expression: string;
    source: string;
    literal: string | null;
  }[];
  parameters: {
    source: string;
    type: string;
    payload_annotation_source: string | null;
  }[];
  factory_candidates: {
    source: string;
    annotation_source: string;
    return_type: string;
    selection: 'source_name_candidate';
  }[];
  deserialisations: {
    source: string;
    owner_source: string;
    receiver_type: string;
    argument_sources: string[];
    return_type: string;
    type_reference_sources: string[];
  }[];
  model_declarations: {
    source: string;
    type: string;
    field_sources: string[];
  }[];
  calls: {
    call_binding_id: string;
    source: string;
    owner_source: string | null;
    target_source: string | null;
    operation: string;
    receiver_type: string | null;
    argument_sources: string[];
    execution: 'direct_source' | 'async_declared' | 'deferred_source';
  }[];
  candidate_helpers: {
    call_source: string;
    target_source: string;
    argument_sources: string[];
    parameter_sources: string[];
    resolution: 'nominal_source_candidate';
  }[];
  return_sources: string[];
  throw_sources: string[];
  catch_sources: string[];
  call_binding_ids: string[];
  value_binding_ids: string[];
  support: string[];
  activation: 'declared_runtime_unverified';
  acknowledgement: 'unobserved';
  retry: 'unobserved';
  completeness: 'partial';
  gaps: string[];
  conditions: SpringConditionDeclaration[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "EnumBinding".
 */
export interface EnumBinding {
  kind: 'enum_binding';
  id: string;
  source: string;
  type: string;
  constants: {
    name: string;
    source: string;
    declared_json_name: string | null;
    json_name_source: string | null;
    annotation_sources: string[];
    argument_sources: string[];
  }[];
  value_method_sources: string[];
  codec: 'unobserved';
  completeness: 'partial';
  gaps: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "JavaCollectionBinding".
 */
export interface JavaCollectionBinding {
  kind: 'java_collection_binding';
  id: string;
  source: string;
  owner_source: string;
  owner_type: string;
  name: string;
  declared_type: 'java.util.List<java.lang.String>';
  factory: 'java.util.List.of';
  factory_call_binding_id: string;
  value_source: string;
  elements: {
    position: number;
    source: string;
    constant_source: string | null;
    value: string;
  }[];
  completeness: 'partial';
  gaps: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "ScheduleBinding".
 */
export interface ScheduleBinding {
  kind: 'schedule_binding';
  id: string;
  source: string;
  owner_source: string;
  owner_type: string;
  annotations: ScheduleDeclaration[];
  conditions: SpringConditionDeclaration[];
  activation_declarations: ScheduleDeclaration[];
  lock_provider_sources: string[];
  async_invocations: {
    call_source: string;
    owner_source: string | null;
    call_binding_id: string;
    dispatch: 'direct_self' | 'receiver_proxy_unverified';
    use: CallResultUse;
    use_source: string;
    async_binding_id: string;
  }[];
  call_binding_ids: string[];
  value_binding_ids: string[];
  support: string[];
  activation: 'declared_runtime_unverified';
  lock_scope: 'scheduled_invocation_only_async_completion_unverified';
  completeness: 'partial';
  gaps: string[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "ScheduleDeclaration".
 */
export interface ScheduleDeclaration {
  source: string;
  owner_source: string;
  annotation_type: ScheduleAnnotationType;
  arguments: {
    name: string;
    expression: string;
  }[];
}
/**
 * This interface was referenced by `ScanDocument`'s JSON-Schema
 * via the `definition` "CsharpSymbolBinding".
 */
export interface CsharpSymbolBinding {
  kind: 'csharp_symbol_binding';
  id: string;
  source: string;
  target: string | null;
  owner: string | null;
  relation: 'call_target' | 'reaching_definition' | 'implementation_candidate';
  symbol: string;
  dispatch: 'exact' | 'external' | 'polymorphic' | 'unresolved';
  arguments: {
    source: string;
    parameter: string | null;
  }[];
  /**
   * @minItems 1
   */
  limitations: [string, ...string[]];
  boundary: 'http' | 'storage' | 'async' | 'unclassified' | 'unknown';
  completion: 'awaited' | 'returned' | 'unobserved';
  configurationSources: string[];
  conditions: string[];
}
