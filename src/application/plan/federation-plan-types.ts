import type { Variable } from '@/application/plan/federation-parse';
import type { TreeErrorCode, TreeNode } from '@/application/plan/federation-tree';

export interface FetchRead {
  readonly field: string;
  readonly ref: string;
  readonly store: string | null;
  /** The service that performs the read: the endpoint's service when the field also has `via`. */
  readonly svc: string | null;
}

export interface FetchVia {
  readonly field: string;
  readonly via: string;
  /** The endpoint's service. */
  readonly to: string | null;
}

export interface FetchCache {
  readonly field: string;
  readonly at: string;
  readonly ttl: number | null;
}

/** One call from the gateway to a subgraph. */
export interface Fetch {
  readonly id: string;
  readonly kind: 'root' | 'entity';
  readonly subgraph: string;
  readonly service: string | null;
  readonly team: string | null;
  readonly type: string;
  /** Empty for a root fetch, else the path of the parent node. */
  readonly path: string;
  readonly after: readonly string[];
  /** The round trip it runs in, from 1. */
  readonly depth: number;
  /** A key-translation hop. */
  readonly intermediate: boolean;
  readonly fields: readonly string[];
  readonly paths: readonly string[];
  /** Fields the gateway adds for a key. */
  readonly keyFields: readonly string[];
  /** Fields the gateway adds for an @requires. */
  readonly requiredFields: readonly string[];
  readonly list: boolean;
  readonly batched: boolean;
  readonly nPlusOne: boolean;
  readonly representations: 'n' | null;
  readonly reads: readonly FetchRead[];
  readonly vias: readonly FetchVia[];
  readonly caches: readonly FetchCache[];
}

export interface Selected {
  readonly path: string;
  readonly field: string;
  readonly fetch: string;
  readonly list: boolean;
  readonly addedByRouter: 'key' | 'requires' | null;
}

export interface Added {
  readonly path: string;
  readonly field: string;
  readonly fetch: string;
  readonly reason: 'key' | 'requires';
}

export interface OverrideInfo {
  readonly field: string;
  readonly from: string;
  readonly to: string | null;
  readonly percent: number;
}

export type PlanWarningCode =
  TreeErrorCode | 'subscription' | 'no-owner' | 'no-shared-key' | 'plan-check';

export interface PlanWarning {
  readonly code: PlanWarningCode;
  readonly message: string;
  readonly path?: string;
}

/** The query plan the gateway derives for an operation. */
export interface QueryPlan {
  readonly operation: string;
  readonly name: string | null;
  readonly kind: 'query' | 'mutation' | 'subscription' | null;
  readonly graph: string | null;
  readonly gateway: string | null;
  readonly gatewayTeam: string | null;
  readonly fetches: readonly Fetch[];
  /** Fetch ids per round trip. */
  readonly levels: readonly (readonly string[])[];
  readonly roundTrips: number;
  readonly parallelism: number;
  /** Subgraph services in fetch order, then services reached by field `via` hops. */
  readonly services: readonly string[];
  readonly teams: readonly string[];
  /** Stores behind reads and data caches. */
  readonly stores: readonly string[];
  readonly selected: readonly Selected[];
  readonly addedByRouter: readonly Added[];
  /** Synthetic nodes the gateway adds for an @requires; they count toward the response policy. */
  readonly routerNodes: readonly TreeNode[];
  readonly auth: readonly { readonly field: string; readonly auth: string }[];
  readonly overrides: readonly OverrideInfo[];
  readonly variables: readonly Variable[];
  readonly warnings: readonly PlanWarning[];
}
