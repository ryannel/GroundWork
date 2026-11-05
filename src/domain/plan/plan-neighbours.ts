// The other plans and the programmes of a plan's workspace, as far as a plan reads them: by id.

/** What an op does to the thing it targets: adds it, changes it (modify or deprecate) or removes it. */
export type TouchKind = 'add' | 'change' | 'remove';

/** One thing a plan's change adds, changes or removes. */
export interface Touch {
  readonly change: string;
  readonly kind: TouchKind;
  readonly target: string;
}

/** What a plan or programme as written defines, for the plans beside it to resolve. */
export interface Neighbour {
  /** Every prefixed id it defines, with its status when it has one (a question's open or resolved). */
  readonly ids: ReadonlyMap<string, string | null>;
  /** The plans it builds on; none for a programme. */
  readonly buildsOn: readonly string[];
  /** What its changes add, change and remove; none for a programme. */
  readonly touches: readonly Touch[];
  /** A short hash of what it says, so a plan that reads it can tell when it has changed. */
  readonly hash: string;
  /** The plan has landed (it keeps base.yaml), so its changes are part of today. */
  readonly landed: boolean;
}

/** The other plans and the programmes of the workspace a plan is read in, by folder. */
export interface Neighbours {
  /** The folder of the plan being read. */
  readonly slug: string;
  readonly plans: ReadonlyMap<string, Neighbour>;
  readonly programmes: ReadonlyMap<string, Neighbour>;
}
