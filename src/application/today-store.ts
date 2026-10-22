import type { Model } from '@/application/plan/derive';
import { type ChipRef, chipRefOf } from '@/application/today-scope';
import type { FieldNode } from '@/domain/plan/plan-graph';

// What a store holds, as its page lists it: a database's tables and their columns, a topic's messages with who
// announces each and who listens.

export interface ColumnView {
  readonly name: string;
  readonly type: string;
  /** "key", "required", "unique": what the column promises. */
  readonly marks: readonly string[];
  /** The table a reference points at, when the model knows it. */
  readonly ref: ChipRef | null;
}

export interface TableView {
  readonly chip: ChipRef;
  readonly summary: string | null;
  readonly columns: readonly ColumnView[];
}

export interface TopicMessageView {
  readonly chip: ChipRef;
  readonly summary: string | null;
  readonly payload: ChipRef | null;
  readonly producer: ChipRef | null;
  readonly consumers: readonly ChipRef[];
}

export interface StoreContents {
  readonly tables: readonly TableView[];
  readonly messages: readonly TopicMessageView[];
}

const known = (model: Model, id: string | undefined): ChipRef | null =>
  id === undefined || model.get(id) === undefined ? null : chipRefOf(model, id);

function columnOf(model: Model, field: FieldNode): ColumnView {
  const marks = [
    field.key === true ? 'key' : null,
    field.required === true ? 'required' : null,
    field.unique === true ? 'unique' : null,
  ].filter((m) => m !== null);
  return { name: field.name, type: field.type, marks, ref: known(model, field.ref?.split('#')[0]) };
}

/** The tables kept in a store and the messages carried on it; null when it holds neither, or is no store. */
export function storeContentsOf(model: Model, id: string): StoreContents | null {
  if (model.asIs.stores.every((s) => s.id !== id)) return null;
  const tables = model.asIs.schemas
    .filter((s) => s.store === id)
    .map((s) => ({
      chip: chipRefOf(model, s.id),
      summary: s.summary ?? null,
      columns: s.fields.map((f) => columnOf(model, f)),
    }));
  const messages = model.asIs.messages
    .filter((m) => m.topic === id)
    .map((m) => ({
      chip: chipRefOf(model, m.id),
      summary: m.summary ?? null,
      payload: known(model, m.payload),
      producer: known(model, m.producer),
      consumers: (m.consumers ?? []).flatMap((c) => known(model, c) ?? []),
    }));
  return tables.length === 0 && messages.length === 0 ? null : { tables, messages };
}
