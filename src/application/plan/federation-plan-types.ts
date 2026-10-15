import type { Variable } from '@/application/plan/federation-parse';
import type { TreeErrorCode, TreeNode } from '@/application/plan/federation-tree';

export interface FetchRead {
  field: string;
  ref: string;
  store: string | null;
  /** The service that performs the read: the endpoint's service when the field also has `via`. */
  svc: string | null;
}

export interface FetchVia {
  field: string;
  via: string;
  /** The endpoint's service. */
  to: string | null;
}

export interface FetchCache {
  field: string;
  at: string;
  ttl: number | null;
}

/** One call from the gateway to a subgraph. */
export interface Fetch {
  id: string;
  kind: 'root' | 'entity';
  subgraph: string;
  service: string | null;
  team: string | null;
  type: string;
  /** Empty for a root fetch, else the path of the parent node. */
  path: string;
  after: string[];
  /** The round trip it runs in, from 1. */
  depth: number;
  /** A key-translation hop. */
  intermediate: boolean;
  fields: string[];
  paths: string[];
  /** Fields the gateway adds for a key. */
  keyFields: string[];
  /** Fields the gateway adds for an @requires. */
  requiredFields: string[];
  list: boolean;
  batched: boolean;
  nPlusOne: boolean;
  representations: 'n' | null;
  reads: FetchRead[];
  vias: FetchVia[];
  caches: FetchCache[];
}

export interface Selected {
  path: string;
  field: string;
  fetch: string;
  list: boolean;
  addedByRouter: 'key' | 'requires' | null;
}

export interface Added {
  path: string;
  field: string;
  fetch: string;
  reason: 'key' | 'requires';
}

export interface OverrideInfo {
  field: string;
  from: string;
  to: string | null;
  percent: number;
}

export type PlanWarningCode =
  TreeErrorCode | 'subscription' | 'no-owner' | 'no-shared-key' | 'plan-check';

export interface PlanWarning {
  code: PlanWarningCode;
  message: string;
  path?: string;
}

/** The query plan the gateway derives for an operation. */
export interface QueryPlan {
  operation: string;
  name: string | null;
  kind: 'query' | 'mutation' | 'subscription' | null;
  graph: string | null;
  gateway: string | null;
  gatewayTeam: string | null;
  fetches: Fetch[];
  /** Fetch ids per round trip. */
  levels: string[][];
  roundTrips: number;
  parallelism: number;
  /** Subgraph services in fetch order, then services reached by field `via` hops. */
  services: string[];
  teams: string[];
  /** Stores behind reads and data caches. */
  stores: string[];
  selected: Selected[];
  addedByRouter: Added[];
  /** Synthetic nodes the gateway adds for an @requires; they count toward the response policy. */
  routerNodes: TreeNode[];
  auth: { field: string; auth: string }[];
  overrides: OverrideInfo[];
  variables: Variable[];
  warnings: PlanWarning[];
}
