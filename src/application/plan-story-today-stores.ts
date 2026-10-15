import type { Model } from '@/application/plan/derive';
import type { StoreItem, StopView } from '@/application/plan-story-today-types';
import { countOf, countWord } from '@/application/plan-viz-text';

// The last stop of the system map: which store belongs to which system, and which are shared.

type Grid = ReturnType<Model['storeGrid']>;

const sharersOf = (grid: Grid, store: string): number =>
  new Set(grid.cells.filter((c) => c.store === store).map((c) => c.svc)).size;

function itemOf(model: Model, grid: Grid, id: string): StoreItem {
  const owner = model.asIs.stores.find((s) => s.id === id)?.owner ?? null;
  const others = grid.cells.filter((c) => c.store === id && c.svc !== owner).map((c) => c.svc);
  return {
    id,
    name: model.label(id),
    owner,
    sharedBy: grid.shared.includes(id) ? others : null,
    records: model.asIs.schemas
      .filter((s) => s.kind === 'record' && s.store === id)
      .map((s) => ({ id: s.id, name: s.name, fields: countOf(s.fields.length, 'field') })),
  };
}

function headline(model: Model, grid: Grid): string {
  const [most] = [...grid.shared].toSorted((a, b) => sharersOf(grid, b) - sharersOf(grid, a));
  if (most === undefined)
    return 'Every store belongs to one service: nothing reads another service’s data directly.';
  const others = grid.shared.length - 1;
  const are = others === 1 ? 'is' : 'are';
  const also = others > 0 ? `, and ${countWord(others, 'other store')} ${are} shared too` : '';
  return `${model.label(most)} is shared: ${countWord(sharersOf(grid, most), 'component')} read or write it${also}.`;
}

export function storeStop(model: Model): StopView {
  const grid = model.storeGrid('asIs');
  // A grid whose only marks are each store's owner says nothing a card does not.
  const diagonal = grid.cells.length > 0 && grid.cells.every((c) => c.owner);
  const owned = 'Each store sits under the service that owns it.';
  return {
    key: 'data',
    title: 'Where the data lives',
    focus: 'data',
    headline: headline(model, grid),
    lede: diagonal
      ? owned
      : `${owned} Dotted lines show other components reading or writing it; the grid below lists who does which.`,
    below: {
      kind: 'stores',
      stores: grid.stores.map((id) => itemOf(model, grid, id)),
      grid: !diagonal,
    },
  };
}
