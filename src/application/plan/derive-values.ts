import { isRecord } from '@/application/plan/ids';

/** Memoise a function of simple (string or undefined) arguments. */
export function memo<A extends (string | undefined)[], R>(
  fn: (...args: A) => R,
): (...args: A) => R {
  const cache = new Map<string, { value: R }>();
  return (...args: A): R => {
    const key = args.map(String).join('\u0000');
    const hit = cache.get(key) ?? { value: fn(...args) };
    cache.set(key, hit);
    return hit.value;
  };
}

export const uniq = <T>(xs: readonly (T | null | undefined)[]): T[] => [
  ...new Set(xs.filter((x): x is T => x !== null && x !== undefined)),
];

/** The first difference that is not a tie (for chained sort comparisons). */
/** Whether a value is there: not null, undefined or an empty string. */
export const present = (x: unknown): boolean => x !== null && x !== undefined && x !== '';

export const tie = (...diffs: number[]): number => diffs.find((d) => d !== 0) ?? 0;

export const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/** Objects in a list, ignoring anything else. */
export const objects = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter(isRecord) : [];

/** YYYY-MM-DD for a Date or a date-ish string (the local calendar date for a Date). */
export function isoDay(d: Date | string | null | undefined): string {
  if (d instanceof Date) {
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return (d ?? '').slice(0, 10);
}

/** A scalar as text; anything else as nothing. */
export function show(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : '';
}

export const sameJson = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
