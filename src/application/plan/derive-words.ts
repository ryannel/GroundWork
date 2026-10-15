import type { Core } from '@/application/plan/derive-core';
import { present, sameJson, show, str, uniq } from '@/application/plan/derive-values';
import { isRecord, prop, strings, typeOf } from '@/application/plan/ids';
import { clip } from '@/shared/plain-text';

/** Plain words for the props a modify op touches most. */
const PROP_WORDS: Record<string, string> = {
  sig: 'signature',
  summary: 'description',
  logic: 'what it does',
  does: 'what it does',
  desc: 'description',
  description: 'description',
};
export const propWord = (p: string): string => PROP_WORDS[p] ?? p.replaceAll('_', ' ');

const isCacheLayer = (x: unknown): boolean => typeof prop(x, 'at') === 'string';
const isKeySet = (x: unknown): boolean =>
  Array.isArray(prop(x, 'fields')) && Array.isArray(prop(x, 'in'));
const isIdValued = (v: unknown): v is string => typeof v === 'string' && typeOf(v) !== null;

type Label = (id: string) => string;

const dot = (s: string): string => ` · ${s}`;
const seconds = (s: string): string => ` · ${s} s`;
const percent = (s: string): string => ` · ${s} %`;
const suffix = (x: unknown, say: (s: string) => string): string =>
  x === null || x === undefined ? '' : say(show(x));

/** The items that name what they are: an {svc, mode} edge, a cache layer, an override, a cache hint, a key set. */
function namedText(label: Label, v: Record<string, unknown>): string | undefined {
  const at = str(v.at);
  const from = str(v.from);
  if (typeof v.svc === 'string' && v.svc !== '') return `${label(v.svc)} ${show(v.mode)}`.trim();
  if (at !== undefined) return `${label(at)}${suffix(v.ttl, seconds)}`;
  if (from !== undefined && isIdValued(from))
    return `from ${label(from)}${suffix(v.percent, percent)}`;
  if (typeof v.max_age === 'number') return `${show(v.max_age)} s${suffix(v.scope, dot)}`;
  if (isKeySet(v))
    return `${strings(v.fields).join(' ')} in ${strings(v.in).map(label).join(', ')}`;
  return undefined;
}

/** An error or record by its status, code or name; a small settings object as "while revalidate 30, if error 3600". */
function recordText(label: Label, v: Record<string, unknown>): string {
  const head = [v.status, v.code ?? v.name ?? v.id].filter(present).map(show).join(' ');
  if (head !== '') return head;
  const pairs = Object.entries(v).filter(([, x]) => x === null || typeof x !== 'object');
  return pairs.length === Object.keys(v).length && pairs.length > 0
    ? pairs.map(([k, x]) => `${propWord(k)} ${valText(label, x)}`).join(', ')
    : JSON.stringify(v);
}

function itemText(label: Label, v: unknown): string {
  if (!isRecord(v)) return isIdValued(v) ? label(v) : show(v);
  return namedText(label, v) ?? recordText(label, v);
}

function valText(label: Label, v: unknown): string {
  if (v === null || v === undefined) return '(none)';
  if (typeof v === 'string') {
    if (typeOf(v) !== null) return label(v);
    return clip(v, label, 60);
  }
  if (Array.isArray(v)) {
    const out = v.map((x) => valText(label, x)).join(', ');
    return out === '' ? '(none)' : out;
  }
  return isRecord(v) ? itemText(label, v) : show(v);
}

/** Short text for an id-valued prop, collapsing same-name versions to "v1 → v2". */
function pairText(core: Core, [a, b]: [string | null, string | null]): [string, string] {
  const na = a === null ? undefined : core.get(a);
  const nb = b === null ? undefined : core.get(b);
  const name = prop(na, 'name');
  const [va, vb] = [str(prop(na, 'version')), str(prop(nb, 'version'))];
  if (name !== undefined && name === prop(nb, 'name') && va !== undefined && vb !== undefined)
    return [va, vb];
  const none = (id: string | null): string => (id === null ? '(none)' : core.label(id));
  return [none(a), none(b)];
}

function createBase(core: Core) {
  const { label } = core;
  return {
    label,
    valText: (v: unknown) => valText(label, v),
    itemText: (v: unknown) => itemText(label, v),
    pairText: (a: string | null, b: string | null) => pairText(core, [a, b]),
    isIdValued,
  };
}

type Base = ReturnType<typeof createBase>;

const keyOf = (base: Base, x: unknown): string => {
  if (!isRecord(x)) return show(x);
  if (isCacheLayer(x)) return `at|${show(x.at)}`;
  if (isKeySet(x)) return `key|${strings(x.fields).join(' ')}`;
  return [x.svc, x.status, x.code, x.name].some(present) ? base.itemText(x) : JSON.stringify(x);
};

const moves = (k: string): boolean => k.startsWith('at|') || k.startsWith('key|');
const ttlText = (v: unknown): string =>
  v === null || v === undefined ? 'derived' : `${show(v)} s`;
const listed = (lead: string, items: string[]): string =>
  items.length > 0 ? `${lead} ${items.join(', ')}` : '';

function keyMove(label: Label, [was, now]: [unknown, unknown]): string {
  const [before, after] = [strings(prop(was, 'in')), strings(prop(now, 'in'))];
  const plus = after.filter((s) => !before.includes(s)).map((s) => label(s));
  const minus = before.filter((s) => !after.includes(s)).map((s) => label(s));
  const said = [listed('now also in', plus), listed('no longer in', minus)]
    .filter((x) => x !== '')
    .join('; ');
  return `${strings(prop(now, 'fields')).join(' ')} ${said === '' ? 'reordered' : said}`;
}

function cacheMove(label: Label, [was, now]: [unknown, unknown]): string {
  const at = label(show(prop(now, 'at')));
  const [t0, t1] = [prop(was, 'ttl'), prop(now, 'ttl')];
  return t0 === t1 ? `${at} changes` : `${at} ${ttlText(t0)} → ${ttlText(t1)}`;
}

/** What a list gains, loses and moves (a cache layer or key set kept but changed), keyed by identity. */
function diffLists(base: Base, before: unknown[], after: unknown[]) {
  const key = (x: unknown): string => keyOf(base, x);
  const b = new Map(before.map((x) => [key(x), x]));
  const a = new Map(after.map((x) => [key(x), x]));
  return {
    gained: [...a].filter(([k]) => !b.has(k)).map(([, x]) => base.itemText(x)),
    lost: [...b].filter(([k]) => !a.has(k)).map(([, x]) => base.itemText(x)),
    moved: [...a]
      .filter(([k, x]) => moves(k) && b.has(k) && !sameJson(b.get(k), x))
      .map(([k, x]) => (k.startsWith('key|') ? keyMove : cacheMove)(base.label, [b.get(k), x])),
  };
}

/** The words for a change of a prop: what a list gains and loses, what a settings object changes per key. */
function createDeltas(base: Base) {
  return {
    /** A list prop changed: say what it gains and loses instead of printing both lists. */
    listDelta(p: string, before: unknown[], after: unknown[]): string {
      const { gained, lost, moved } = diffLists(base, before, after);
      if (moved.length > 0 && gained.length === 0 && lost.length === 0)
        return `${propWord(p)}: ${moved.join('; ')}`;
      const bits = [...moved, listed('now also', gained), listed('no longer', lost)].filter(
        (x) => x !== '',
      );
      if (bits.length > 0) return `${propWord(p)}: ${bits.join('; ')}`;
      return `${propWord(p)} ${sameJson(before, after) ? 'reordered' : 'changes'}`;
    },

    /** Two settings objects: say what changed per key ("cache control: max age 300 → 60"). */
    objDelta(p: string, before: Record<string, unknown>, after: Record<string, unknown>): string {
      const keys = uniq([...Object.keys(before), ...Object.keys(after)]).filter(
        (k) => !sameJson(before[k], after[k]),
      );
      if (keys.length === 0) return `${propWord(p)} reordered`;
      if (isIdValued(show(before.from)) || isIdValued(show(after.from)))
        return `${propWord(p)}: ${base.itemText(before)} → ${base.itemText(after)}`;
      const each = keys.map(
        (k) => `${propWord(k)} ${base.valText(before[k])} → ${base.valText(after[k])}`,
      );
      return `${propWord(p)}: ${each.join(', ')}`;
    },
  };
}

/** The words for the values of a diff: ids as labels, list items and settings objects as short phrases. */
export function createWords(core: Core) {
  const base = createBase(core);
  return { ...base, ...createDeltas(base) };
}

export type Words = ReturnType<typeof createWords>;
