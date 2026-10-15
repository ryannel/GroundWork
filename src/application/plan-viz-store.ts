import type { Model } from '@/application/plan/derive';
import type { GraphMode, Mode } from '@/application/plan/derive-core';
import { prop } from '@/application/plan/ids';
import type { SchemaNode, StoreNode } from '@/domain/plan/plan-graph';

// What a store holds and who uses it: its records, how they refer to each other, and which services read and write it.

const graphOf = (mode: Mode): GraphMode => (mode === 'asIs' ? 'asIs' : 'toBe');
const ACCESS = new Map([
  ['read', 'reads'],
  ['write', 'writes'],
  ['readwrite', 'reads and writes'],
]);
const MAX_STEPS = 3;
const BREAKS = [' via ', ';', ' · ', ' plus ', ' / ', ','];

export const isPipe = (store: Pick<StoreNode, 'kind'>): boolean =>
  store.kind === 'topic' || store.kind === 'queue';

/** "PostgreSQL via EF Core; JSONB…" reads as "PostgreSQL". */
export function shortTech(tech?: string): string {
  const text = (tech ?? '').replaceAll('`', '');
  const ends = BREAKS.map((b) => text.indexOf(b)).filter((at) => at !== -1);
  return text.slice(0, ends.length === 0 ? text.length : Math.min(...ends)).trim();
}

/** The records of a store in a mode; in diff, the ones the plan removes follow. */
export function recordsOf(model: Model, storeId: string, mode: Mode = 'diff'): SchemaNode[] {
  const pick = (schemas: readonly SchemaNode[]): SchemaNode[] =>
    schemas.filter((s) => s.store === storeId);
  if (mode === 'asIs') return pick(model.asIs.schemas);
  const list = pick(model.toBe.schemas);
  if (mode !== 'diff') return list;
  return [...list, ...pick(model.asIs.schemas).filter((s) => !list.some((x) => x.id === s.id))];
}

export interface Reference {
  readonly key: string;
  readonly from: { readonly id: string; readonly text: string };
  /** What it points at; `id` is null when the target is not in the plan. */
  readonly to: { readonly id: string | null; readonly text: string };
  /** The store the target lives in, when it is another one. */
  readonly elsewhere: string | null;
}

function nameOf(model: Model, id: string): string {
  const name = prop(model.get(id), 'name');
  return typeof name === 'string' ? name : id;
}

/** `OrderLine.order_id → Order.id`: one line per reference among, or out of, the store's records. */
export function relationships(model: Model, storeId: string, mode: Mode = 'diff'): Reference[] {
  return recordsOf(model, storeId, mode).flatMap((s) =>
    s.fields.flatMap((f): Reference[] => {
      if (f.ref === undefined) return [];
      const [schemaId = '', field] = f.ref.split('#');
      const target = model.get(f.ref);
      const home = [...model.asIs.schemas, ...model.toBe.schemas].find(
        (x) => x.id === schemaId,
      )?.store;
      const suffix = field === undefined ? '' : `.${field}`;
      return [
        {
          key: `${s.id}#${f.name}`,
          from: { id: `${s.id}#${f.name}`, text: `${s.name}.${f.name}` },
          to: {
            id: target === undefined ? null : f.ref,
            text: `${nameOf(model, schemaId)}${suffix}`,
          },
          elsewhere: home !== undefined && home !== storeId ? nameOf(model, home) : null,
        },
      ];
    }),
  );
}

export interface Access {
  readonly svc: string;
  readonly role: string;
  readonly steps: readonly string[];
  readonly moreSteps: number;
  /** A service that reaches the store only with this plan. */
  readonly fresh: boolean;
}

/** Who reads and writes it, owner first: the service, how, and through which steps (or by declared access). */
export function accessRows(model: Model, storeId: string, mode: Mode = 'diff'): Access[] {
  const cells = model.storeGrid(graphOf(mode)).cells.filter((c) => c.store === storeId);
  const before = mode === 'diff' ? model.storeGrid('asIs') : null;
  return cells
    .toSorted((a, b) => Number(!a.owner) - Number(!b.owner))
    .map((c) => ({
      svc: c.svc,
      role: c.owner ? 'owner' : (ACCESS.get(c.mode ?? 'read') ?? 'reads'),
      steps: c.steps.slice(0, MAX_STEPS),
      moreSteps: Math.max(0, c.steps.length - MAX_STEPS),
      fresh: before !== null && before.cell(c.svc, storeId) === null,
    }));
}

export interface Glance {
  readonly tech: string | null;
  readonly owner: string | null;
  readonly records: number;
  readonly readers: number;
}

/** The first look at a store: its technology, its owner, how many records and how many other services read it. */
export function storeGlance(model: Model, storeId: string, mode: Mode = 'diff'): Glance | null {
  const e = storeNode(model, storeId, mode);
  if (e === null) return null;
  const pipe = isPipe(e);
  const records = recordsOf(model, storeId, mode).filter(
    (s) => mode !== 'diff' || model.toBe.byId.has(s.id),
  );
  const readers = new Set(
    model
      .storeGrid(graphOf(mode))
      .cells.filter((c) => c.store === storeId && c.read && !c.owner)
      .map((c) => c.svc),
  );
  return {
    tech: e.tech === undefined ? null : shortTech(e.tech),
    owner: e.owner === '' ? null : e.owner,
    records: pipe ? 0 : records.length,
    readers: pipe ? 0 : readers.size,
  };
}

/** The store as the mode sees it; in as-is a store the plan adds is not there. */
export function storeNode(model: Model, storeId: string, mode: Mode = 'diff'): StoreNode | null {
  const node =
    (mode === 'asIs' ? model.asIs : model.toBe).byId.get(storeId) ?? model.asIs.byId.get(storeId);
  return node?.$type === 'store' ? node : null;
}
