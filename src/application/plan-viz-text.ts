import type { Model } from '@/application/plan/derive';
import { refLabel } from '@/application/plan/ref-label';
import { cutAtWord, plain } from '@/shared/plain-text';

// The small wordings the data and decision vizzes share: numbers as words, counts, first sentences, enum values.

const WORDS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];

/** 3 becomes "three"; numbers above twelve stay digits. */
export const numWord = (n: number): string => WORDS[n] ?? String(n);

/** "3 fields". */
export const countOf = (n: number, one: string, many = `${one}s`): string =>
  `${String(n)} ${n === 1 ? one : many}`;

/** "three fields", "one field". */
export const countWord = (n: number, one: string, many = `${one}s`): string =>
  `${numWord(n)} ${n === 1 ? one : many}`;

/** The first sentence of a string of prose. */
export function firstSentence(text: string | null | undefined): string {
  const s = (text ?? '').replaceAll(/\s+/g, ' ').trim();
  const end = s.search(/[!.?](?=\s|$)/);
  return end === -1 ? s : s.slice(0, end + 1);
}

/** The values of an `enum(a, b, c)` type string (a trailing `?` is allowed), else null. */
export function enumValues(type: string | null | undefined): string[] | null {
  const inner = /^\s*enum\((.*)\)\??\s*$/.exec(type ?? '')?.[1];
  return inner === undefined
    ? null
    : inner
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

/** A title cut at a word, with citations and markdown marks read as plain words. */
export function short(text: unknown, n = 40): string {
  const flat = (typeof text === 'string' ? text : '')
    .replaceAll(/\[\[([^\]]{1,200})]]/g, '$1')
    .replaceAll(/[*`]/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();
  return cutAtWord(flat, n);
}

const ID = /^[a-z]+:[a-z0-9-]+(#[a-z0-9-]+)?$/;

/** A "was" value as words: ids become labels, lists join, objects read "from: Pricing · percent: 10". */
export function wasText(model: Model, value: unknown): string {
  if (value === null || value === undefined || value === '') return '(none)';
  if (Array.isArray(value)) return value.map((x) => wasText(model, x)).join(', ');
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, x]) => x !== null && x !== undefined)
      .map(([k, x]) => `${k}: ${wasText(model, x)}`)
      .join(' · ');
  }
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return ID.test(s) && model.get(s) !== undefined ? model.label(s) : s;
}

/** Prose as one plain line, its citations read as labels. */
export const plainLine = (text: string | null | undefined): string => plain(text, refLabel);
