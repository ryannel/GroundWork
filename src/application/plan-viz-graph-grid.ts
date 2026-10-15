import type { Model } from '@/application/plan/derive';
import type { FieldOwners } from '@/application/plan/federation-blast';
import type { FieldChange, GraphDiff } from '@/application/plan/federation-diff';
import {
  countOf,
  fieldName,
  fieldsOf,
  type GraphMode,
  graphIn,
  graphTypes,
  isPrivateField,
  subgraphLabel,
  subgraphsOf,
} from '@/application/plan-viz-graph-base';
import { andList } from '@/application/plan-viz-waterfall-text';

// Who owns which field: a type per row, a subgraph per column, the fields it answers in the cell. With a graph
// diff the same grid reads before and after: a field that leaves is struck, one that arrives is marked new.

export type FieldState = 'same' | 'gone' | 'was' | 'new';

export interface GridField {
  readonly id: string;
  readonly name: string;
  readonly key: boolean;
  readonly private: boolean;
  readonly state: FieldState;
  /** "removed", "moves out", "new" or "moves in"; empty when nothing changes. */
  readonly note: string;
  /** What clients use it for, such as "40k/day"; only in a diff. */
  readonly usage: string;
}

export interface GridColumn {
  readonly id: string;
  readonly label: string;
  readonly team: string | null;
  readonly status: 'added' | 'deprecated' | 'removed' | null;
}

export interface GridRow {
  readonly id: string;
  readonly root: boolean;
  /** How the subgraphs find the row: its key, and how many answer for it. */
  readonly summary: string;
  /** How a query fetches the entity across subgraphs; empty without keys. */
  readonly callout: string;
  readonly cells: readonly { readonly subgraph: string; readonly fields: readonly GridField[] }[];
}

export interface OwnershipGridView {
  readonly columns: readonly GridColumn[];
  readonly rows: readonly GridRow[];
}

const NO_OWNERS: FieldOwners = {
  type: '',
  bySubgraph: {},
  contributors: [],
  stubs: [],
  keys: [],
  keyFields: [],
};

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

const baseType = (type: string | undefined): string => (type ?? '').replaceAll(/[![\]]/g, '');

/** "Pricing and Cart are asked for a Product by its sku, after Catalogue answers." */
function entityFetchLine(model: Model, typeId: string, mode: GraphMode): string {
  const owners = model.fieldOwners(typeId, mode);
  const [first] = owners.keys;
  if (first === undefined) return '';
  const name = model.label(typeId);
  const entry = graphIn(model, mode)
    .schemas.filter((s) => s.root !== undefined)
    .flatMap((s) => s.fields)
    .find((f) => baseType(f.type) === name);
  const head = entry?.subgraphs?.[0] ?? first.in[0] ?? '';
  const short = (id: string): string => subgraphLabel(model, id);
  const clauses = owners.keys
    .map((key) => ({ who: key.in.filter((s) => s !== head), by: key.fields.join(' + ') }))
    .filter((part) => part.who.length > 0)
    .map((part, at) => {
      const who = andList(part.who.map(short));
      if (at > 0) return `${who} by its ${part.by}`;
      return `${who} ${part.who.length > 1 ? 'are' : 'is'} asked for a ${name} by its ${part.by}`;
    });
  return clauses.length === 0 ? '' : `${clauses.join(', ')}, after ${short(head)} answers.`;
}

interface Sides {
  readonly before: FieldOwners | null;
  readonly after: FieldOwners;
  readonly mode: GraphMode;
}

function sidesOf(
  model: Model,
  typeId: string,
  scope: { readonly mode: GraphMode; readonly diff: GraphDiff | null },
): Sides {
  const { mode, diff } = scope;
  const side = diff === null ? mode : 'toBe';
  const owners = (m: GraphMode): FieldOwners =>
    graphIn(model, m).has(typeId) ? model.fieldOwners(typeId, m) : NO_OWNERS;
  return { before: diff === null ? null : owners('asIs'), after: owners(side), mode: side };
}

function stateOf(
  change: FieldChange | undefined,
  placed: { readonly before: boolean; readonly after: boolean },
): { state: FieldState; note: string } {
  if (change === undefined) return { state: 'same', note: '' };
  const removed = change.status === 'removed';
  if (placed.before && !placed.after) {
    return removed ? { state: 'gone', note: 'removed' } : { state: 'was', note: 'moves out' };
  }
  if (!placed.before && placed.after) {
    return { state: 'new', note: change.status === 'added' ? 'new' : 'moves in' };
  }
  return removed ? { state: 'gone', note: 'removed' } : { state: 'same', note: '' };
}

function usageOf(change: FieldChange | undefined): string {
  const perDay = change?.usage?.per_day;
  return perDay === undefined ? '' : `${String(perDay)}/day`;
}

function cellFields(
  model: Model,
  sides: Sides,
  scope: { readonly typeId: string; readonly diff: GraphDiff | null; readonly subgraph: string },
): GridField[] {
  const { typeId } = scope;
  const after = sides.after.bySubgraph[scope.subgraph] ?? [];
  const before = sides.before?.bySubgraph[scope.subgraph] ?? [];
  return unique([...before, ...after]).map((id) => {
    const change = scope.diff?.fields.find((f) => f.id === id);
    const placed = { before: before.includes(id), after: after.includes(id) };
    const { state, note } = stateOf(change, placed);
    const home = scope.diff !== null && !placed.after ? 'asIs' : sides.mode;
    const field = fieldsOf(graphIn(model, home), typeId).find((f) => f.id === id);
    return {
      id,
      name: fieldName(id),
      key: sides.after.keyFields.includes(id) || (sides.before?.keyFields.includes(id) ?? false),
      private: isPrivateField(field),
      state,
      note,
      usage: usageOf(change),
    };
  });
}

function summaryOf(owners: FieldOwners): string {
  const count = countOf(owners.contributors.length, 'subgraph');
  if (owners.keys.length > 0) {
    const fields = unique(owners.keys.flatMap((k) => k.fields)).join(', ');
    return `key: ${fields} · ${count}`;
  }
  return owners.contributors.length > 1 ? count : '';
}

function columnsOf(
  model: Model,
  graphId: string,
  scope: {
    readonly typeIds: readonly string[];
    readonly mode: GraphMode;
    readonly diff: GraphDiff | null;
  },
): GridColumn[] {
  const modes: GraphMode[] = scope.diff === null ? [scope.mode] : ['asIs', 'toBe'];
  const wanted = new Set(
    scope.typeIds.flatMap((id) =>
      modes.flatMap((m) =>
        graphIn(model, m).has(id) ? model.fieldOwners(id, m).contributors : [],
      ),
    ),
  );
  const all = unique(
    [...subgraphsOf(model, graphId, 'asIs'), ...subgraphsOf(model, graphId, 'toBe')].map(
      (s) => s.id,
    ),
  );
  return all
    .filter((id) => wanted.has(id))
    .map((id) => {
      const status = scope.diff?.subgraphs.find((s) => s.id === id)?.status;
      return {
        id,
        label: subgraphLabel(model, id),
        team: model.ownerTeam(id),
        status:
          status === 'added' || status === 'deprecated' || status === 'removed' ? status : null,
      };
    });
}

/** The types a grid draws: all of them, or in a diff the ones whose fields change (today's too, when retired). */
function typesShown(
  model: Model,
  graphId: string,
  scope: { mode: GraphMode; diff: GraphDiff | null },
) {
  const now = graphTypes(model, graphId, scope.diff === null ? scope.mode : 'toBe');
  if (scope.diff === null) return now;
  const changed = new Set(scope.diff.fields.map((f) => f.type));
  const was = graphTypes(model, graphId, 'asIs').filter((t) => !now.some((x) => x.id === t.id));
  return [...now, ...was].filter((t) => changed.has(t.id));
}

/** The grid for one graph, or null when it has no types to show. `diff` is `model.graphDiff(graphId)`. */
export function ownershipGrid(
  model: Model,
  graphId: string,
  options: { readonly mode?: GraphMode; readonly diff?: GraphDiff | null } = {},
): OwnershipGridView | null {
  const mode = options.mode ?? 'asIs';
  const diff = options.diff ?? null;
  const types = typesShown(model, graphId, { mode, diff });
  if (types.length === 0) return null;
  const columns = columnsOf(model, graphId, { typeIds: types.map((t) => t.id), mode, diff });
  const rows = types.map((type): GridRow => {
    const sides = sidesOf(model, type.id, { mode, diff });
    return {
      id: type.id,
      root: type.root !== undefined,
      summary: type.root === undefined ? summaryOf(sides.after) : 'entry points',
      callout: entityFetchLine(model, type.id, sides.mode),
      cells: columns.map((c) => ({
        subgraph: c.id,
        fields: cellFields(model, sides, { typeId: type.id, diff, subgraph: c.id }),
      })),
    };
  });
  return { columns, rows };
}
