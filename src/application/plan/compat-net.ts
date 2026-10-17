import { type PropRow, propRows } from '@/application/plan/compat-rules';
import type { InterfaceNode, SchemaNode, SystemGraph } from '@/domain/plan/plan-graph';

type Status = 'added' | 'removed' | 'modified';

interface Row {
  readonly status: Status;
  readonly before: object | null;
  readonly after: object | null;
  readonly props: readonly PropRow[];
}

export interface FieldRow extends Row {
  readonly field: string;
}

export interface EndpointRow extends Row {
  readonly endpoint: string;
}

export type NetRow = PropRow | FieldRow | EndpointRow;

function statusOf(before: object | undefined, after: object | undefined): Status {
  if (before === undefined) return 'added';
  return after === undefined ? 'removed' : 'modified';
}

function rowOf(before: object | undefined, after: object | undefined, named: boolean): Row {
  const props =
    before !== undefined && after !== undefined
      ? propRows(before, after).filter((p) => !named || p.prop !== 'name')
      : [];
  return { status: statusOf(before, after), before: before ?? null, after: after ?? null, props };
}

/** Both sides of every child, matched by key (a field's name, an endpoint's id). */
function pairs<T extends object>(
  before: readonly T[],
  after: readonly T[],
  key: (x: T) => string,
): [T | undefined, T | undefined][] {
  const by = new Map<string, [T | undefined, T | undefined]>();
  for (const x of before) by.set(key(x), [x, undefined]);
  for (const x of after) by.set(key(x), [by.get(key(x))?.[0], x]);
  return [...by.values()];
}

const kept = (row: Row): boolean => row.status !== 'modified' || row.props.length > 0;

function fieldRows(a: SchemaNode, b: SchemaNode): FieldRow[] {
  return pairs(a.fields, b.fields, (f) => f.name).flatMap(([x, y]) => {
    const row = rowOf(x, y, true);
    return kept(row) ? [{ field: x?.name ?? y?.name ?? '', ...row }] : [];
  });
}

function endpointRows(a: InterfaceNode, b: InterfaceNode): EndpointRow[] {
  return pairs(a.endpoints, b.endpoints, (e) => e.id).flatMap(([x, y]) => {
    const row = rowOf(x, y, false);
    return kept(row) ? [{ endpoint: x?.id ?? y?.id ?? '', ...row }] : [];
  });
}

/** What is different between today and with this plan, not which edits were written. */
export function netDiff(asIs: SystemGraph, toBe: SystemGraph, id: string): NetRow[] {
  const [a, b] = [asIs.get(id), toBe.get(id)];
  if (a === undefined || b === undefined) return [];
  if (a.$type === 'field') return propRows(a, b).filter((p) => p.prop !== 'name');
  const rows: NetRow[] = propRows(a, b);
  if (a.$type === 'schema' && b.$type === 'schema') rows.push(...fieldRows(a, b));
  if (a.$type === 'interface' && b.$type === 'interface') rows.push(...endpointRows(a, b));
  return rows;
}
