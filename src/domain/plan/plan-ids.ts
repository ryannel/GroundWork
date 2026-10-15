// Id vocabulary of a plan. Ids are `<prefix>:<kebab-slug>`; children are `<parent-id>#<slug>`
// (steps, fields, regions). Endpoints sit inside interfaces but carry top-level `api:*` ids.

export const ID_PREFIXES = {
  team: 'team',
  sys: 'system',
  svc: 'service',
  st: 'store',
  sch: 'schema',
  if: 'interface',
  api: 'endpoint',
  msg: 'message',
  flow: 'flow',
  chg: 'change',
  tst: 'test',
  wi: 'workItem',
  ms: 'milestone',
  dec: 'decision',
  risk: 'risk',
  q: 'question',
  sc: 'scenario',
  con: 'concept',
  stage: 'stage',
  scr: 'screen',
  graph: 'graph',
  sg: 'subgraph',
  gql: 'operation',
  ui: 'interaction',
  uj: 'userJourney',
} as const;

export type IdPrefix = keyof typeof ID_PREFIXES;
export type BaseType = (typeof ID_PREFIXES)[IdPrefix];
export type ChildType = 'field' | 'step' | 'region';
export type EntityType = BaseType | ChildType;
export type PathSegment = string | number;

/** Types that hold a child collection, with the collection prop and the child type. */
export type ContainerType = 'schema' | 'interface' | 'flow' | 'screen';
export const CHILDREN = {
  schema: ['fields', 'field'],
  interface: ['endpoints', 'endpoint'],
  flow: ['steps', 'step'],
  screen: ['regions', 'region'],
} as const;

/** `add:` types allowed in ops, and the container type that `into` must name (null: none). */
export const ADD_TYPES = {
  system: null,
  service: null,
  store: null,
  schema: null,
  interface: null,
  message: null,
  flow: null,
  screen: null,
  graph: null,
  subgraph: null,
  operation: null,
  interaction: null,
  userJourney: null,
  field: 'schema',
  endpoint: 'interface',
  step: 'flow',
  region: 'screen',
} as const;

/** System base arrays: plan key → type. */
export const SYSTEM_COLLECTIONS = {
  teams: 'team',
  systems: 'system',
  services: 'service',
  stores: 'store',
  schemas: 'schema',
  interfaces: 'interface',
  messages: 'message',
  flows: 'flow',
  screens: 'screen',
  interactions: 'interaction',
  user_journeys: 'userJourney',
  graphs: 'graph',
  subgraphs: 'subgraph',
  operations: 'operation',
} as const;

/** Plan-level collections outside the system graphs: plan key → type. */
export const PLAN_COLLECTIONS = {
  changes: 'change',
  tests: 'test',
  milestones: 'milestone',
  work_items: 'workItem',
  decisions: 'decision',
  risks: 'risk',
  questions: 'question',
} as const;

/** Types that can carry references (the commitment list is the one plan-level extra). */
export type RefOwner = EntityType | 'commitment';
export type RefSpec = readonly [prop: string, allowed: readonly EntityType[] | null];

/**
 * Reference-bearing props per entity type: [prop, allowed target types] (null: any type).
 * `prop[]` = list prop; `prop.sub` = a prop of an object; `prop[].sub` = a prop of each object;
 * `prop[].sub[]` = a ref list in each object.
 */
export const REFS: Readonly<Record<RefOwner, readonly RefSpec[]>> = {
  scenario: [['flows[]', ['flow']]],
  concept: [
    ['born_in', ['service']],
    ['part_of', ['concept']],
    ['relates[].to', ['concept']],
    ['aka[].in', ['service']],
    ['aka[].at', null],
    ['introduced_by[]', ['change']],
  ],
  stage: [
    ['services[].svc', ['service']],
    ['services[].from[]', ['service', 'store', 'interface', 'endpoint']],
    ['flows[]', ['flow']],
  ],
  team: [],
  system: [['team', ['team']]],
  service: [
    ['team', ['team']],
    ['system', ['system']],
  ],
  store: [
    ['owner', ['service']],
    ['access[].svc', ['service']],
    ['invalidated_by[]', ['message']],
  ],
  schema: [
    ['store', ['store']],
    ['graph', ['graph']],
    ['keys[].in[]', ['subgraph']],
  ],
  field: [
    ['ref', ['schema', 'field']],
    ['subgraphs[]', ['subgraph']],
    ['provides[]', ['field']],
    ['requires[]', ['field']],
    ['override.from', ['subgraph']],
    ['reads[]', ['schema', 'field']],
    ['via', ['endpoint']],
    ['cache[].at', ['store']],
  ],
  interface: [
    ['service', ['service']],
    ['supersedes', ['interface']],
  ],
  endpoint: [
    ['request', ['schema']],
    ['response', ['schema']],
    ['supersedes', ['endpoint']],
  ],
  message: [
    ['topic', ['store']],
    ['payload', ['schema']],
    ['producer', ['service']],
    ['consumers[]', ['service']],
    ['supersedes', ['message']],
  ],
  flow: [],
  step: [
    ['from', ['service', 'store']],
    ['to', ['service', 'store']],
    ['via', ['endpoint', 'message', 'operation']],
    ['reads[]', ['schema', 'field']],
    ['writes[]', ['schema', 'field']],
    ['screen', ['screen', 'region']],
    ['purges[]', ['store']],
  ],
  screen: [['service', ['service']]],
  interaction: [
    ['from[]', ['screen', 'region']],
    ['to', ['screen', 'region']],
    ['supporting_steps[]', ['step']],
  ],
  userJourney: [['interactions[]', ['interaction']]],
  region: [['reads[]', ['schema', 'field']]],
  change: [['decisions[]', ['decision']]],
  test: [
    ['proves[]', ['change']],
    ['walks[]', ['flow', 'step', 'operation', 'subgraph']],
    ['owner', ['team']],
  ],
  milestone: [],
  workItem: [
    ['team', ['team']],
    ['milestone', ['milestone']],
    ['implements[]', ['change']],
    ['verified_by[]', ['test']],
    ['depends_on[]', ['workItem']],
  ],
  decision: [
    ['decider', ['team']],
    ['supersedes[]', ['decision']],
  ],
  risk: [
    ['owner', ['team']],
    ['about[]', null],
    ['accepted_by', ['decision']],
  ],
  question: [
    ['decider', ['team']],
    ['blocks[]', null],
    ['answered_by', ['decision']],
  ],
  commitment: [['team', ['team']]],
  graph: [['gateway', ['service']]],
  subgraph: [
    ['graph', ['graph']],
    ['service', ['service']],
  ],
  operation: [
    ['graph', ['graph']],
    ['screens[]', ['screen', 'region']],
    ['client', ['service']],
    ['writes[]', ['schema', 'field']],
    ['cache[].at', ['store']],
  ],
};
