import type { ElementStatus } from '@/application/plan/derive-core';

export type EdgeKind = 'api' | 'msg' | 'data';
export type Overlay = 'none' | 'all' | EdgeKind;

export interface Edge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly via: string | null;
  readonly kind: EdgeKind;
  readonly sync: boolean;
  readonly mode: 'read' | 'write' | 'readwrite' | null;
  readonly read: boolean;
  readonly write: boolean;
  readonly fanout?: boolean;
  readonly steps: readonly string[];
  /** The handlers whose calls, publishes, reads or writes draw this edge. */
  readonly handlers?: readonly string[];
  /** Set in diff mode only. */
  readonly status?: ElementStatus;
}

export interface Consumer {
  readonly svc: string;
  readonly steps: readonly string[];
  readonly declared: boolean;
}

export interface StepPoint {
  readonly step: string;
  readonly flow: string | undefined;
  readonly from: string;
  readonly to: string;
}

/** One service's reads and writes of one store. */
export interface StoreCell {
  readonly svc: string;
  readonly store: string;
  readonly read: boolean;
  readonly write: boolean;
  readonly mode: Edge['mode'];
  readonly owner: boolean;
  readonly access: Edge['mode'];
  readonly steps: readonly string[];
}

/** Services × stores: who reads and writes what, and the stores more than one service touches. */
export interface StoreGrid {
  readonly services: readonly string[];
  readonly stores: readonly string[];
  readonly cells: readonly StoreCell[];
  readonly shared: readonly string[];
  readonly cell: (svc: string, st: string) => StoreCell | null;
}

/** A step that calls an api. */
export interface CallPoint {
  readonly step: string;
  readonly flow: string | undefined;
  readonly from: string;
}

export interface EdgeQueries {
  /** Talks-to edges for a mode (asIs, toBe or diff) and an overlay. */
  readonly edges: (mode?: string, overlay?: Overlay) => Edge[];
  readonly storeGrid: (mode?: string) => StoreGrid;
  readonly callers: (apiId: string, mode?: string) => CallPoint[];
  readonly publishPoints: (msgId: string, mode?: string) => StepPoint[];
  readonly consumePoints: (msgId: string, mode?: string) => StepPoint[];
  readonly consumersEffective: (msgId: string, mode?: string) => Consumer[];
  readonly edgesOfGraph: (mode: string | undefined) => Edge[];
}
