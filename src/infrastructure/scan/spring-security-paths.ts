import 'server-only';

function segmentMatches(expected: string, actual: string | undefined): boolean | undefined {
  if ((expected.includes('*') && expected !== '*') || expected.includes('?')) return undefined;
  if (actual === undefined) return false;
  if (expected === '*' || expected === actual) return true;
  return actual.includes('{') ? undefined : false;
}

/** A conservative subset of Spring Ant paths; unsupported embedded globs stay unknown. */
export function springPathMatches(pattern: string, path: string): boolean | undefined {
  const expected = pattern.split('/').filter(Boolean);
  const actual = path.split('/').filter(Boolean);
  for (const [position, segment] of expected.entries()) {
    if (segment === '**') return position === expected.length - 1 ? true : undefined;
    const matches = segmentMatches(segment, actual[position]);
    if (matches !== true) return matches;
  }
  return expected.length === actual.length;
}
