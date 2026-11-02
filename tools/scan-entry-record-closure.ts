import { scanRecords, type ScanRecord } from '@/domain/scan/scan-records';
import type { ScanDocument } from '@/domain/scan/scan.generated';

interface ClosureLimits {
  readonly maxRecords: number;
  readonly maxBytes: number;
}
interface ClosureSelection {
  readonly ids: readonly string[];
  readonly missing: readonly string[];
  readonly omitted: number;
  readonly bytes: number;
  readonly oversized: readonly string[];
}

const DESCRIPTIVE = new Set([
  'id',
  'kind',
  'syntax',
  'name',
  'description',
  'path',
  'repo',
  'commit',
  'blob',
  'text',
  'signature',
  'methodName',
  'receiverType',
  'return_type',
  'annotation_type',
  'expression',
  'value',
  'label',
  'type',
  'reason',
  'gaps',
  'operator',
  'field',
  'collection',
  'entityType',
  'const',
  'enum',
  'routeId',
]);

function references(input: unknown, known: ReadonlyMap<string, ScanRecord>): readonly string[] {
  if (typeof input === 'string') return known.has(input) ? [input] : [];
  if (Array.isArray(input)) return input.flatMap((value: unknown) => references(value, known));
  if (typeof input !== 'object' || input === null) return [];
  return Object.entries(input)
    .filter(([key]) => !DESCRIPTIVE.has(key))
    .flatMap(([, value]: readonly [string, unknown]) => references(value, known));
}

/** Follow present record identities only; budgets remain visible rather than pretending a closed behaviour graph. */
export function entryRecordClosure(
  document: ScanDocument,
  seeds: readonly string[],
  limits: ClosureLimits,
): ClosureSelection {
  const records = new Map(scanRecords(document).map((record) => [record.id, record]));
  const pending = [...seeds];
  const seen = new Set<string>();
  const selected: string[] = [];
  const missing: string[] = [];
  const oversized: string[] = [];
  const totals = { bytes: 0, omitted: 0 };
  for (const id of pending) {
    if (seen.has(id)) continue;
    seen.add(id);
    const record = records.get(id);
    if (record === undefined) missing.push(id);
    else {
      const size = Buffer.byteLength(JSON.stringify(record));
      if (size > 64_000) oversized.push(id);
      else if (selected.length >= limits.maxRecords || totals.bytes + size > limits.maxBytes) {
        totals.omitted += 1;
      } else {
        selected.push(id);
        totals.bytes += size;
        pending.push(...references(record, records));
      }
    }
  }
  return { ids: selected, missing, oversized, omitted: totals.omitted, bytes: totals.bytes };
}
