import type { Model } from '@/application/plan/derive';
import type { Mode } from '@/application/plan/derive-core';
import { schemaOf, type FieldRow } from '@/application/plan-viz-fields';
import { short, wasText } from '@/application/plan-viz-text';
import type { Field } from '@/domain/plan/plan.generated';

// What each cell of a field table says, as data the table draws: type with its old type struck, required with
// what it was, the key badges, the note with what else changed.

const baseType = (t: string): string => t.trim().replace(/\?$/u, '').trim();

const SCHEMA_NAMES = new WeakMap<Model, Map<string, string>>();

/** Schemas of the plan by name, to find a nested type (`OrderLine[]`) a field holds. */
function schemaNames(model: Model): Map<string, string> {
  const known = SCHEMA_NAMES.get(model);
  if (known !== undefined) return known;
  const map = new Map<string, string>();
  for (const g of [model.asIs, model.toBe]) {
    for (const s of g.schemas) if (!map.has(s.name)) map.set(s.name, s.id);
  }
  SCHEMA_NAMES.set(model, map);
  return map;
}

const element = (type: string): string =>
  baseType(type)
    .replace(/\[\]$/u, '')
    .replace(/^(?:list|array|set)<(.+)>$/iu, '$1');

export interface TypeCell {
  readonly text: string;
  /** The type before this plan changed it. */
  readonly was: string | null;
  /** The schema this type holds, when it is one of the plan's own. */
  readonly nested: string | null;
  readonly nestedName: string | null;
}

export function typeCell(
  model: Model,
  row: FieldRow,
  ctx: { readonly schemaId: string; readonly depth: number },
): TypeCell {
  const before = row.props.find((p) => p.prop === 'type');
  const found = ctx.depth < 1 ? (schemaNames(model).get(element(row.field.type)) ?? null) : null;
  const nested = found === ctx.schemaId ? null : found;
  return {
    text: baseType(row.field.type),
    was: before !== undefined && row.status === 'modified' ? baseType(String(before.before)) : null,
    nested,
    nestedName: nested === null ? null : (schemaOf(model, nested)?.name ?? nested),
  };
}

export interface RequiredCell {
  readonly required: boolean;
  readonly was: string | null;
}

export function requiredCell(row: FieldRow): RequiredCell {
  const p = row.props.find((x) => x.prop === 'required');
  let was: string | null = null;
  if (p !== undefined && row.status === 'modified') {
    was = p.after === true ? 'was optional' : 'was required';
  }
  return { required: row.field.required === true, was };
}

export interface NoteCell {
  /** The author's note, as markdown. */
  readonly note: string | null;
  /** Other props that changed, with what each was. */
  readonly others: readonly { readonly prop: string; readonly was: string }[];
}

const SHOWN_ELSEWHERE = new Set(['type', 'required', 'name', 'note']);

export function noteCell(model: Model, row: FieldRow): NoteCell {
  const others =
    row.status === 'modified'
      ? row.props
          .filter((p) => !SHOWN_ELSEWHERE.has(p.prop) && p.status !== 'added')
          .map((p) => ({ prop: p.prop, was: short(wasText(model, p.before), 80) }))
      : [];
  const note = row.field.note;
  return { note: note === undefined || note === '' ? null : note, others };
}

export interface KeyBadge {
  readonly key: string;
  readonly text: string;
  readonly title?: string;
  readonly glyph?: string;
  /** What a click opens. */
  readonly id?: string;
}

/** The field names an event is keyed by. */
export function keyNames(key?: string | readonly string[]): string[] {
  const list = typeof key === 'string' ? key.split(',') : [...(key ?? [])];
  return list.map((k) => k.trim()).filter(Boolean);
}

export interface KeyContext {
  readonly graphType: boolean;
  readonly keyFields: ReadonlySet<string>;
  readonly msgKeys: ReadonlySet<string>;
}

export function keyContext(model: Model, schemaId: string, mode: Mode): KeyContext {
  const g = mode === 'asIs' ? model.asIs : model.toBe;
  const s = schemaOf(model, schemaId, mode);
  const msgKeys = new Set(
    g.messages.filter((m) => m.payload === schemaId).flatMap((m) => keyNames(m.key)),
  );
  return {
    graphType: s?.kind === 'graph-type',
    keyFields: new Set((s?.keys ?? []).flatMap((k) => k.fields)),
    msgKeys,
  };
}

function graphKeys(model: Model, f: Field, ctx: KeyContext): KeyBadge[] {
  const out: KeyBadge[] = [];
  if (ctx.keyFields.has(f.name)) {
    out.push({
      key: 'key',
      text: 'key',
      glyph: '⚿',
      title: 'key field: the gateway asks other subgraphs for the type by it',
    });
  }
  for (const id of f.subgraphs ?? []) {
    out.push({ key: id, text: model.label(id).replace(/ subgraph$/iu, ''), id });
  }
  if (f.auth !== undefined || f.cache_control?.scope === 'private') {
    out.push({
      key: 'private',
      text: 'private',
      glyph: '🔒',
      title: `private: ${f.auth ?? 'a private cache scope'}`,
    });
  }
  return out;
}

function storedKeys(model: Model, f: Field, ctx: KeyContext): KeyBadge[] {
  const out: KeyBadge[] = [];
  if (f.key === true) out.push({ key: 'pk', text: 'PK', title: 'part of the record’s key' });
  if (f.ref !== undefined) {
    const [sid = '', fname] = f.ref.split('#');
    const label = model.get(sid) === undefined ? sid : model.label(sid);
    const target = fname === undefined ? label : `${label}.${fname}`;
    const base = { key: 'fk', text: `FK → ${target}` };
    out.push(
      model.get(f.ref) === undefined ? base : { ...base, id: f.ref, title: `points at ${target}` },
    );
  }
  if (f.unique === true) out.push({ key: 'unique', text: 'unique' });
  if (f.default !== undefined) {
    out.push({
      key: 'default',
      text: `default ${String(f.default)}`,
      title: 'used when the field is left out',
    });
  }
  if (ctx.msgKeys.has(f.name)) {
    out.push({ key: 'msg', text: 'message key', title: 'the event is keyed by this field' });
  }
  return out;
}

/** The marks in a field's key column: what it keys, points at, or who owns it. */
export const keyBadges = (model: Model, f: Field, ctx: KeyContext): KeyBadge[] =>
  ctx.graphType ? graphKeys(model, f, ctx) : storedKeys(model, f, ctx);

/** The rollout words of a deprecated or removed field: only a change that records it can supply them. */
export function rollouts(model: Model, row: FieldRow, mode: Mode): string[] {
  if (mode !== 'diff' || !['deprecated', 'removed'].includes(row.status)) return [];
  const words = row.changes.flatMap((id) => {
    const c = model.plan.changes?.find((x) => x.id === id);
    return c?.rollout === undefined ? [] : [c.rollout];
  });
  return [...new Set(words)];
}
