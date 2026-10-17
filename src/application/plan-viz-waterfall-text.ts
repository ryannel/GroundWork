import type { CacheUse } from '@/domain/plan/plan.generated';

// The waterfall's small wordings: times, lists, cache keys and "what fails" sentences in plain words.

export const ms = (n: number): string => `${String(n)} ms`;

/** Seconds, as minutes when they come out whole and long. */
export const secs = (n: number): string =>
  n >= 120 && n % 60 === 0 ? `${String(n / 60)} min` : `${String(n)} s`;

/** "a, b and c". */
export function andList(xs: readonly string[]): string {
  if (xs.length < 2) return xs[0] ?? '';
  return `${xs.slice(0, -1).join(', ')} and ${xs.at(-1) ?? ''}`;
}

/** "reviews" for "Review", without doubling an s. */
export function plural(noun: string): string {
  return noun.endsWith('s') ? noun : `${noun}s`;
}

const HEADER = /^[A-Z][a-z]+(?:-[A-Z][a-z]+)+$/u;

function keyWord(raw: string): string {
  const x = raw.trim();
  if (/^accept-language$/iu.test(x)) return 'language header';
  if (/^selection hash$/iu.test(x)) return 'selection';
  return HEADER.test(x) ? `${x.toLowerCase().replaceAll('-', ' ')} header` : x;
}

type CacheKey = NonNullable<CacheUse['key']>;

function partsOf(key: Exclude<CacheKey, string>): string[] {
  let variables: string[] = [];
  if (Array.isArray(key.variables)) variables = key.variables;
  else if (key.variables !== undefined) variables = [key.variables];
  const operation = key.operation === 'id' ? 'persisted id' : key.operation;
  return [operation, ...variables, ...(key.headers ?? [])].filter(
    (x): x is string => x !== undefined && x !== '',
  );
}

/**
 * A cache key in words: "persisted id · sku · language header" from {operation, variables, headers}, and an
 * authored string ("operation id · variables · Accept-Language") with its header names turned into words.
 */
export function keyText(key?: CacheKey | null): string {
  if (key === null || key === undefined) return '';
  const parts = typeof key === 'string' ? key.split('·') : partsOf(key);
  return parts.map(keyWord).join(' · ');
}

const words = (t: string): string => t.replaceAll(/([a-z0-9])([A-Z])/gu, '$1 $2').toLowerCase();

/** Type strings in words: `[Review!]!` becomes "a list of reviews that must exist", `Money!` "a required Money". */
export function humanBlast(text: string): string {
  return text
    .replaceAll(
      /`\[(\w+)!\]!?`/gu,
      (_, t: string) => `a list of ${plural(words(t))} that must exist`,
    )
    .replaceAll(/`\[(\w+)\]!?`/gu, (_, t: string) => `a list of ${plural(words(t))}`)
    .replaceAll(/`([A-Z]\w*)!`/gu, (_, t: string) => `a required ${t}`)
    .replaceAll('`', '')
    .replaceAll(/\bis null\b/gu, 'comes back empty')
    .replaceAll(/\bare null\b/gu, 'come back empty')
    .replaceAll(/\bis non-null\b/gu, 'is required');
}
