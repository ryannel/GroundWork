export interface PickTally {
  /** Risks in the register the pick leaves in. */
  readonly shown: number;
  /** Every risk in the register. */
  readonly total: number;
}

const mark = (el: Element, name: string, on: boolean): void => {
  el.toggleAttribute(name, on);
};

/** The grid cell a register row's risk sits in, or "" for a row that is no risk. */
const cellOfRow = (row: HTMLElement): string =>
  row.querySelector<HTMLElement>('[data-cell]')?.dataset.cell ?? '';

const keyOf = (cell: HTMLElement): string =>
  `${cell.dataset.likelihood ?? ''} ${cell.dataset.impact ?? ''}`;

/** Presses the picked cell's button and dims every other cell. */
function markGrid(root: HTMLElement, cell: string | null): void {
  for (const button of root.querySelectorAll<HTMLElement>('[data-pick]'))
    button.setAttribute('aria-pressed', String(cell !== null && button.dataset.pick === cell));
  for (const c of root.querySelectorAll<HTMLElement>('[data-likelihood][data-impact]'))
    mark(c, 'data-dim', cell !== null && keyOf(c) !== cell);
}

/** Hides a group whose rows are all filtered out, and opens a fold whose rows are the ones picked. */
function markGroups(root: HTMLElement, rows: readonly HTMLElement[], picking: boolean): void {
  for (const group of root.querySelectorAll<HTMLElement>('[data-group]')) {
    const mine = rows.filter((row) => group.contains(row));
    const left = mine.some((row) => row.dataset.off === undefined);
    mark(group, 'data-off', mine.length > 0 && !left);
    if (picking && left && group instanceof HTMLDetailsElement) group.open = true;
  }
}

/**
 * Shows only the register's risks in one cell of the grid, `"likelihood impact"`, or every risk for null: presses
 * that cell's button, dims the other cells, marks the other rows `data-off`, and hides a group left empty.
 */
export function pickCell(root: HTMLElement, cell: string | null): PickTally {
  markGrid(root, cell);
  const rows = [...root.querySelectorAll<HTMLElement>('tr')].filter((tr) => cellOfRow(tr) !== '');
  let shown = 0;
  for (const row of rows) {
    const ok = cell === null || cellOfRow(row) === cell;
    mark(row, 'data-off', !ok);
    if (ok) shown += 1;
  }
  markGroups(root, rows, cell !== null);
  return { shown, total: rows.length };
}
