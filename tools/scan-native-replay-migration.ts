import { isDeepStrictEqual } from 'node:util';

interface RecordValue {
  readonly id: string;
  readonly [field: string]: unknown;
}
interface Mapping {
  readonly old_id: string;
  readonly new_id: string;
}
export interface EdgeIdMigration {
  readonly verified: boolean;
  readonly identityExact: boolean;
  readonly reason: string | null;
  readonly unchangedNonEdges: number;
  readonly semanticEdges: number;
  readonly changedEdgeIds: number;
  readonly mapping: readonly Mapping[];
}

function record(input: unknown): input is RecordValue {
  return (
    typeof input === 'object' && input !== null && 'id' in input && typeof input.id === 'string'
  );
}
function body(input: RecordValue): Readonly<Record<string, unknown>> {
  return Object.fromEntries(Object.entries(input).filter(([field]) => field !== 'id'));
}
function result(
  mapping: readonly Mapping[],
  nonEdges: number,
  reason: string | null,
): EdgeIdMigration {
  return {
    verified: reason === null,
    reason,
    identityExact: reason === null && mapping.every((entry) => entry.old_id === entry.new_id),
    unchangedNonEdges: nonEdges,
    semanticEdges: mapping.length,
    changedEdgeIds: mapping.filter((entry) => entry.old_id !== entry.new_id).length,
    mapping,
  };
}
function matches(old: RecordValue, current: readonly RecordValue[]): readonly RecordValue[] {
  return current.filter((entry) =>
    old.kind === 'semantic_edge'
      ? entry.kind === 'semantic_edge' && isDeepStrictEqual(body(old), body(entry))
      : entry.id === old.id && isDeepStrictEqual(old, entry),
  );
}
function matchRecords(
  baseline: readonly RecordValue[],
  current: readonly RecordValue[],
): EdgeIdMigration {
  const mapping: Mapping[] = [];
  const used = new Set<string>();
  let nonEdges = 0;
  for (const old of baseline) {
    const candidates = matches(old, current);
    const matched = candidates[0];
    if (candidates.length !== 1 || matched === undefined || used.has(matched.id)) {
      return result(mapping, nonEdges, 'A record has no unique unused exact body match.');
    }
    used.add(matched.id);
    if (old.kind === 'semantic_edge') mapping.push({ old_id: old.id, new_id: matched.id });
    else nonEdges += 1;
  }
  return result(mapping, nonEdges, null);
}

/** Only semantic-edge identity may migrate; every other field and every non-edge stays exact. */
export function semanticEdgeIdMigration(
  before: readonly unknown[],
  after: readonly unknown[],
): EdgeIdMigration {
  const baseline = before.filter(record);
  const current = after.filter(record);
  const valid = [
    baseline.length === before.length,
    current.length === after.length,
    before.length === after.length,
    new Set(baseline.map((entry) => entry.id)).size === baseline.length,
    new Set(current.map((entry) => entry.id)).size === current.length,
  ].every(Boolean);
  return valid
    ? matchRecords(baseline, current)
    : result([], 0, 'Record counts, identities or shapes are not bijective.');
}

/** Strict replay remains sensitive to every record ID and every payload field. */
export function exactReplayIdentity(
  before: readonly unknown[],
  after: readonly unknown[],
): boolean {
  const baseline = before.filter(record);
  const current = after.filter(record);
  const old = new Map(baseline.map((entry) => [entry.id, entry]));
  return (
    before.length === baseline.length &&
    after.length === current.length &&
    current.length === old.size &&
    current.every((entry) => isDeepStrictEqual(entry, old.get(entry.id)))
  );
}
