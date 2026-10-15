export type StopFocus = 'all' | 'api' | 'msg' | 'data';

export interface StopChip {
  readonly id: string;
  readonly label: string;
}

export interface TeamRow {
  readonly team: string;
  /** "three services". */
  readonly count: string;
  readonly services: readonly string[];
  /** The team's chat channel; empty when it has none. */
  readonly channel: string;
}

export interface StoreRecord {
  readonly id: string;
  readonly name: string;
  /** "3 fields". */
  readonly fields: string;
}

export interface StoreItem {
  readonly id: string;
  readonly name: string;
  /** The system that owns it. */
  readonly owner: string | null;
  /** The other systems that read or write it; null when only the owner does. */
  readonly sharedBy: readonly string[] | null;
  readonly records: readonly StoreRecord[];
}

export type StopBelow =
  | {
      readonly kind: 'teams';
      readonly rows: readonly TeamRow[];
      /** Teams that run no service today. */
      readonly idle: readonly string[];
    }
  | { readonly kind: 'chips'; readonly chips: readonly StopChip[] }
  | {
      readonly kind: 'stores';
      readonly stores: readonly StoreItem[];
      /** Draw the access grid too; false when its only marks are each store's owner. */
      readonly grid: boolean;
    };

/** One stop of the system map: what is true, how to read it, and what sits under the map. */
export interface StopView {
  readonly key: string;
  readonly title: string;
  readonly focus: StopFocus;
  readonly headline: string;
  readonly lede: string;
  readonly below: StopBelow;
}
