import type { Model } from '@/application/plan/derive';
import type { ElementStatus } from '@/application/plan/derive-core';
import { prop } from '@/application/plan/ids';
import { nodeType } from '@/application/plan-viz-map';
import { shortTech } from '@/application/plan-viz-store';
import { teamOf } from '@/application/plan-viz-teams';

// Which systems read and write which stores, as a grid: a system per row, a store per column.

export type StoreGridMode = 'asIs' | 'toBe' | 'diff';

export interface GridStore {
  readonly id: string;
  readonly label: string;
  readonly glyph: string;
  readonly word: string;
  readonly tech: string;
  readonly short: string;
  /** What the plan does to it; "existing" when it shows today's. */
  readonly status: ElementStatus;
  readonly owner: string | null;
}

export interface GridCell {
  readonly store: string;
  readonly access: 'R' | 'W' | 'RW';
  readonly owner: boolean;
  /** The cell in words, for a screen reader and the tooltip. */
  readonly what: string;
  /** The plan adds this access. */
  readonly added: boolean;
}

export interface GridSystem {
  readonly id: string;
  readonly label: string;
  readonly glyph: string;
  readonly team: string | null;
  /** In the same order as the stores; null where the system does not touch the store. */
  readonly cells: readonly (GridCell | null)[];
}

export interface StoreGridView {
  readonly stores: readonly GridStore[];
  readonly systems: readonly GridSystem[];
  /** Systems that touch no store here (compact only): named in a footnote instead of an empty row. */
  readonly idle: readonly { readonly id: string; readonly label: string }[];
}

const ACCESS = { read: 'R', write: 'W', readwrite: 'RW' } as const;
const WORD = { R: 'reads', W: 'writes', RW: 'reads and writes' } as const;

type Grid = ReturnType<Model['storeGrid']>;
type Cell = NonNullable<ReturnType<Grid['cell']>>;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

function accessOf(cell: Cell): GridCell['access'] {
  const key = cell.mode ?? '';
  return key === 'read' || key === 'write' || key === 'readwrite' ? ACCESS[key] : 'R';
}

function storeOf(model: Model, id: string, diff: boolean): GridStore {
  const entity = model.get(id);
  const [glyph, word] = nodeType(id, entity);
  const owner = text(prop(entity, 'owner'));
  const tech = text(prop(entity, 'tech'));
  return {
    id,
    label: model.label(id),
    glyph,
    word: word.toLowerCase(),
    tech,
    short: shortTech(tech),
    status: (diff ? model.status(id) : null) ?? 'existing',
    owner: owner === '' ? null : owner,
  };
}

function howOf(cell: Cell): string {
  if (cell.owner) return ' (owner)';
  return cell.access === null ? ' (in a flow step)' : ` (granted ${cell.access} access)`;
}

function cellOf(
  model: Model,
  at: { readonly system: string; readonly store: string },
  grids: readonly [Grid, Grid | null],
): GridCell | null {
  const [now, before] = grids;
  const cell = now.cell(at.system, at.store);
  if (cell === null) return null;
  const access = accessOf(cell);
  return {
    store: at.store,
    access,
    owner: cell.owner,
    what: `${model.label(at.system)} ${WORD[access]} ${model.label(at.store)}${howOf(cell)}`,
    added: before !== null && before.cell(at.system, at.store) === null,
  };
}

const touching = (row: { readonly cells: readonly (GridCell | null)[] }): boolean =>
  row.cells.some((c) => c !== null);

/** The grid for a graph; `diff` reads today's and the plan's together. Null when there is no store to show. */
export function storeGridView(
  model: Model,
  options: { readonly mode?: StoreGridMode; readonly compact?: boolean } = {},
): StoreGridView | null {
  const mode = options.mode ?? 'asIs';
  const grid = model.storeGrid(mode === 'asIs' ? 'asIs' : 'toBe');
  if (grid.stores.length === 0) return null;
  const grids: readonly [Grid, Grid | null] = [
    grid,
    mode === 'diff' ? model.storeGrid('asIs') : null,
  ];
  const all = grid.services.map((id) => ({
    id,
    cells: grid.stores.map((store) => cellOf(model, { system: id, store }, grids)),
  }));
  const shown = options.compact === true ? all.filter(touching) : all;
  const idle = options.compact === true ? all.filter((row) => !touching(row)) : [];
  return {
    stores: grid.stores.map((id) => storeOf(model, id, mode !== 'asIs')),
    systems: shown.map((row) => ({
      id: row.id,
      label: model.label(row.id),
      glyph: nodeType(row.id, model.get(row.id))[0],
      team: teamOf(model, row.id),
      cells: row.cells,
    })),
    idle: idle.map((row) => ({ id: row.id, label: model.label(row.id) })),
  };
}
