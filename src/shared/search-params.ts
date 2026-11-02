/** What a route's `searchParams` hold for one name. */
export type SearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

/** The first value of a name in the address, or '' when it has none. */
export function firstParam(value: string | readonly string[] | undefined): string {
  if (value === undefined) return '';
  return typeof value === 'string' ? value : (value[0] ?? '');
}

/** The first value, or null when the address has none. */
export function paramOrNull(value: string | readonly string[] | undefined): string | null {
  const first = firstParam(value);
  return first === '' ? null : first;
}
