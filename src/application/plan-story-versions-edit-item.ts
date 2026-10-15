// One line of "All edits": what changes, in markdown-lite ([[id]] citations, bold and code).

export interface EditItem {
  readonly what: string;
  readonly detail: string;
  /** A before and after, when the edit moves a value from one to the other. */
  readonly was: string | null;
  readonly now: string | null;
  /** The change the edit is made in. */
  readonly via: string | null;
}

interface Extra {
  readonly detail?: string | undefined;
  readonly via?: string | undefined;
  readonly was?: string | undefined;
  readonly now?: string | undefined;
}

export function plainOf(what: string, extra: Extra = {}): EditItem {
  return {
    what,
    detail: extra.detail ?? '',
    was: extra.was ?? null,
    now: extra.now ?? null,
    via: extra.via ?? null,
  };
}
