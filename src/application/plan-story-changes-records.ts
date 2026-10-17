import type { Model } from '@/application/plan/derive';
import { compatOf } from '@/application/plan-viz-compat';
import { type WorstField, worstFields } from '@/application/plan-viz-fields';
import { andList } from '@/application/plan-viz-ladder-order';
import { teamOf } from '@/application/plan-viz-teams';
import { enumValues, numWord } from '@/application/plan-viz-text';
import type { PlanNode } from '@/domain/plan/plan-graph';

import { changesOf, teamsBehind } from './plan-story-changes-touched';

// What a reader takes away from a record: its worst field and what that costs, said in the plan's words.

const uniq = <T>(xs: readonly T[]): T[] => [...new Set(xs)];
const code = (text: string): string => `\`${text}\``;
const HEAD_MAX = 84;

/** A headline split in two: what fits on two display lines, and the rest as a lede. */
export function fit(
  text: string,
  max = HEAD_MAX,
): { readonly head: string; readonly rest: string } {
  if (text.length <= max) return { head: text, rest: '' };
  for (const sep of [' (', '; ', ': ', ', ']) {
    const at = text.lastIndexOf(sep, max);
    if (at > 24) {
      const rest = text.slice(at + sep.length).replace(/\)$/u, '');
      return { head: text.slice(0, at), rest: rest.charAt(0).toUpperCase() + rest.slice(1) };
    }
  }
  return { head: text, rest: '' };
}

const nameOf = (model: Model, id: string): string => {
  const node = model.get(id);
  return node !== undefined && 'name' in node && typeof node.name === 'string'
    ? node.name
    : model.label(id);
};

interface Moves {
  readonly gains: readonly string[];
  readonly other: readonly string[];
}

const list = (vs: readonly string[]): string => andList(vs.map(code));
const STATE_WORD = /^(?:status|state)$/u;

function gainOf(name: string, added: readonly string[]): string[] {
  if (added.length === 0) return [];
  const one = added.length === 1;
  if (STATE_WORD.test(name)) return [`${one ? 'a ' : ''}${list(added)} ${name}`];
  const lead = one ? 'a new' : 'new';
  return [`${lead} ${code(name)} ${one ? 'value' : 'values'} (${added.map(code).join(', ')})`];
}

function enumMove(model: Model, fid: string, name: string): Moves {
  const d = model.diff(fid).find((x) => x.target === fid && x.prop === 'type');
  if (d === undefined) return { gains: [], other: [`${code(name)} changes`] };
  const before = enumValues(typeof d.before === 'string' ? d.before : null);
  const after = enumValues(typeof d.after === 'string' ? d.after : null);
  const added = before !== null && after !== null ? after.filter((v) => !before.includes(v)) : [];
  const dropped = before !== null && after !== null ? before.filter((v) => !after.includes(v)) : [];
  const other: string[] = [];
  if (dropped.length > 0) other.push(`${code(name)} drops ${list(dropped)}`);
  if (added.length === 0 && dropped.length === 0) {
    other.push(`${code(name)} becomes ${typeof d.after === 'string' ? code(d.after) : '`?`'}`);
  }
  return { gains: gainOf(name, added), other };
}

function fieldMoves(
  model: Model,
  field: { readonly fid: string; readonly name: string },
  kept: boolean,
): Moves {
  const { fid, name: n } = field;
  const st = model.status(fid);
  if (st === 'modified') return enumMove(model, fid, n);
  if (st === 'deprecated') return { gains: [], other: [`${code(n)} is deprecated · still works`] };
  if (st === 'removed' || !kept) return { gains: [], other: [`${code(n)} is removed`] };
  return { gains: [], other: [] };
}

const namesIn = (node: PlanNode | undefined): string[] =>
  node?.$type === 'schema' ? node.fields.map((f) => f.name) : [];

/** "Subscription gains a `paused` status and three new fields". */
function recordSentence(model: Model, schemaId: string): string {
  const name = nameOf(model, schemaId);
  const after = model.toBe.get(schemaId);
  const fieldsAfter = namesIn(after);
  const moves = namesIn(model.asIs.get(schemaId)).map((n) =>
    fieldMoves(
      model,
      { fid: `${schemaId}#${n}`, name: n },
      after === undefined || fieldsAfter.includes(n),
    ),
  );
  const gains = moves.flatMap((m) => m.gains);
  const other = moves.flatMap((m) => m.other);
  const added = fieldsAfter.filter((n) => model.status(`${schemaId}#${n}`) === 'added');
  const [only] = added;
  if (added.length === 1 && only !== undefined) gains.push(`a ${code(only)} field`);
  else if (added.length > 1) gains.push(`${numWord(added.length)} new fields`);
  const parts = [
    ...(gains.length > 0 ? [`gains ${andList(gains)}`] : []),
    ...(other.length > 0 ? [other.join(', ')] : []),
  ];
  return parts.length === 0 ? `${name} changes` : `${name} ${parts.join('; ')}`;
}

/** Teams behind a record: the owner of its store first, then the teams of the changes that touch it. */
export function recordTeams(model: Model, id: string): string[] {
  const owner = teamOf(model, id);
  return uniq([...(owner === null ? [] : [owner]), ...teamsBehind(model, changesOf(model, id))]);
}

const ROLE_PLURAL: Readonly<Record<string, string>> = {
  reader: 'readers',
  caller: 'callers',
  consumer: 'consumers',
  writer: 'writers',
};

/** "Storefront BFF", "Catalog API and PIM", "Orders, PIM and two more". */
function nameList(model: Model, services: readonly string[], max = 2): string {
  const names = uniq(services.map((s) => model.label(s)));
  return names.length > max
    ? `${names.slice(0, max).join(', ')} and ${numWord(names.length - max)} more`
    : andList(names);
}

const isEnum = (v: unknown): boolean => typeof v === 'string' && enumValues(v) !== null;

function whatHappens(model: Model, schemaId: string, w: WorstField): string {
  const name = nameOf(model, schemaId);
  const f = code(w.name);
  const prop = (key: string) => w.row.props.find((p) => p.prop === key);
  const type = prop('type');
  const required = prop('required');
  if (w.status === 'removed' || w.status === 'deprecated') {
    return `${name} ${w.status === 'removed' ? 'loses' : 'deprecates'} ${f}`;
  }
  if (w.status === 'added') {
    return `${name} gains ${w.row.field.required === true ? 'required ' : ''}${f}`;
  }
  if (type !== undefined && !(isEnum(type.before) && isEnum(type.after))) {
    return `${name}’s ${f} becomes ${w.row.field.type.replace(/\?$/u, '')}`;
  }
  if (required !== undefined) {
    return `${name}’s ${f} ${required.after === true ? 'becomes required' : 'may now be absent'}`;
  }
  return `${name}’s ${f} changes`;
}

function whoMoves(model: Model, w: WorstField): string {
  if (w.who.length === 0) return '';
  const services = uniq(w.who);
  if (services.length <= 2) return nameList(model, w.who);
  const roles = uniq((compatOf(model, w.fid)?.who ?? []).map((x) => x.role));
  const [only] = roles;
  const word = roles.length === 1 && only !== undefined ? ROLE_PLURAL[only] : undefined;
  return `${numWord(services.length)} ${word ?? 'services'}`;
}

const QUIET_RULES = new Set(['all-move', 'unmoved', 'no-reader']);

function reasonOf(model: Model, w: WorstField): string {
  const reasons = compatOf(model, w.fid)?.reasons ?? [];
  return reasons.find((r) => r.verdict !== 'safe' && !QUIET_RULES.has(r.rule))?.text ?? '';
}

/**
 * What the reader takes away from a record: its worst field and what that costs. "Removing `lead_time_text` breaks
 * Storefront BFF, and no change in this plan moves it". A record whose edits are all safe reads as what it gains.
 */
export function recordClaim(model: Model, schemaId: string): string {
  const w = worstFields(model, schemaId)[0];
  if (w === undefined || w.verdict === 'safe') return recordSentence(model, schemaId);
  const what = whatHappens(model, schemaId, w);
  if (w.unmoved.length > 0) {
    const stuck = `no change in this plan moves ${uniq(w.unmoved).length > 1 ? 'them' : 'it'}`;
    if (w.status === 'removed') {
      return `Removing ${code(w.name)} breaks ${nameList(model, w.unmoved)}, and ${stuck}`;
    }
    return `${what}, which breaks ${nameList(model, w.unmoved)}; ${stuck}`;
  }
  let tail = reasonOf(model, w);
  if (w.who.length > 0) tail = `${whoMoves(model, w)} must move first`;
  else if (w.verdict === 'breaking') tail = 'no service reader is recorded';
  return tail === '' ? what : `${what}; ${tail}`;
}

/** Records, worst first: the one with a field that breaks someone leads. */
export const bySeverity = (model: Model, ids: readonly string[]): string[] =>
  ids
    .map((id, k) => ({ id, k, score: worstFields(model, id)[0]?.score ?? 0 }))
    .toSorted((a, b) => (a.score === b.score ? a.k - b.k : b.score - a.score))
    .map((x) => x.id);
