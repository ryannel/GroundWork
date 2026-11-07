import type { ModelData } from './workspace-model';

/** An authored entrance into the technical model. It is a view, not a model level. */
export interface LandscapeArea {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  readonly activities: readonly string[];
  readonly boundary: string;
  readonly confidence?: 'low' | 'medium' | 'high';
  readonly evidenceCount?: number;
}

export type LandscapeRelationshipKind = 'exchange' | 'transition' | 'support';

/** One major relationship worth seeing before the reader opens an area. */
export interface LandscapeRelationship {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly label: string;
  readonly kind: LandscapeRelationshipKind;
}

/** A labelled relationship in one area's map; membership is projected, never an authored exchange. */
export interface LandscapeSystemRelationship {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly label: string;
  readonly kind: 'api' | 'message' | 'data' | 'membership';
  readonly detail: string;
}

/** A cross-system activity that explains one useful part of an area. */
export interface LandscapeCollaboration {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly systems: readonly string[];
}

export interface LandscapeAreaDetail {
  readonly valueFlow?: LandscapeValueFlow | undefined;
  readonly area: string;
  readonly systems: readonly string[];
  readonly relationships: readonly LandscapeSystemRelationship[];
  readonly collaborations: readonly LandscapeCollaboration[];
}

/** A saved, evidence-backed explanation of a directed exchange. */
export interface LandscapeFlowConnection extends Partial<
  Pick<ModelData<'LandscapeConnection'>, 'cites' | 'backs'>
> {
  readonly from: string;
  readonly to: string;
  readonly label: string;
  readonly kind: 'api' | 'message' | 'data';
  readonly evidence: readonly string[];
}

/** An inferred reading order for business value, with labelled initiating calls, event deliveries and store access. */
export interface LandscapeValueFlow {
  readonly title: string;
  readonly summary: string;
  readonly confidence: 'low' | 'medium' | 'high';
  readonly reasoning: string;
  readonly limitations: readonly string[];
  readonly bands: readonly {
    readonly id: string;
    readonly title: string;
    readonly summary: string;
    readonly nodes: readonly { readonly component: string; readonly column: number }[];
  }[];
  readonly connections: readonly LandscapeFlowConnection[];
  /** Area-wide system reading order, independent of component columns inside each activity. */
  readonly columns?: readonly { readonly system: string; readonly column: number }[] | undefined;
  /** A small, authored cross-system backbone for the default view; every entry reuses a core exchange. */
  readonly overview?: readonly LandscapeFlowConnection[] | undefined;
  /** Rename existing supporting exchanges without promoting them into the core story or creating edges. */
  readonly summaries?: readonly LandscapeFlowConnection[] | undefined;
}

export interface AuthoredLandscape {
  readonly label: 'Inferred';
  readonly reviewed: string;
  readonly scope: string;
  readonly limitation: string;
  readonly areas: readonly LandscapeArea[];
  readonly relationships: readonly LandscapeRelationship[];
  readonly details: readonly LandscapeAreaDetail[];
}
