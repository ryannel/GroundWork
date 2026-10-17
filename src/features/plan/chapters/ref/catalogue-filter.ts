export interface Tally {
  /** Rows showing after both the lens and the search. */
  readonly shown: number;
  /** Rows the lens leaves in. */
  readonly inLens: number;
  /** Every row on the page. */
  readonly total: number;
}

const termsOf = (query: string): string[] =>
  query
    .trim()
    .toLowerCase()
    .split(/\s+/u)
    .filter((t) => t !== '');

const inCut = (row: HTMLElement, lens: string | null): boolean => {
  const teams = row.dataset.teams;
  return lens === null || teams === undefined || teams.split(' ').includes(lens);
};

/**
 * Shows the rows that are in the team's cut and hold every word typed, and hides a group none of whose rows show.
 * A row carries `data-search` (its words) and `data-teams` (the teams whose cut holds it); a group is `data-group`.
 * A row inside another row is part of it and left to it.
 */
export function filterRows(root: HTMLElement, query: string, lens: string | null): Tally {
  const terms = termsOf(query);
  let shown = 0;
  let inLens = 0;
  const rows = [...root.querySelectorAll<HTMLElement>('[data-search]')].filter(
    (row) => (row.parentElement?.closest('[data-search]') ?? null) === null,
  );
  for (const row of rows) {
    const words = row.dataset.search ?? '';
    const lensOk = inCut(row, lens);
    const ok = lensOk && terms.every((t) => words.includes(t));
    row.hidden = !ok;
    if (lensOk) inLens += 1;
    if (ok) shown += 1;
  }
  for (const group of root.querySelectorAll<HTMLElement>('[data-group]')) {
    const mine = rows.filter((row) => group.contains(row));
    group.hidden = mine.length > 0 && mine.every((row) => row.hidden !== false);
  }
  return { shown, inLens, total: rows.length };
}
