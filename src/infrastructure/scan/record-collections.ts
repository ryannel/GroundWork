import 'server-only';

import { z } from 'zod';

import schema from '@/../schema/scan.schema.json' with { type: 'json' };
import type { ScanRecord } from '@/domain/scan/scan-records';
import type { BindingRecord, FrameworkRecord } from '@/domain/scan/scan.generated';

const definition = z.object({
  oneOf: z.array(z.object({ $ref: z.string() })).optional(),
  properties: z.object({ kind: z.object({ const: z.string() }).optional() }).optional(),
});
const definitions = new Map<string, unknown>(
  Object.entries(schema.$defs).map(([name, value]: readonly [string, unknown]) => [name, value]),
);

function kinds(name: string): readonly string[] {
  const raw = definitions.get(name);
  if (raw === undefined) throw new Error(`Unknown scan record definition ${name}`);
  const value = definition.parse(raw);
  if (value.properties?.kind) return [value.properties.kind.const];
  if (!value.oneOf) throw new Error(`Scan record definition ${name} has no kind`);
  return value.oneOf.flatMap((item) => kinds(item.$ref.replace('#/$defs/', '')));
}
const framework = new Set(kinds('FrameworkRecord'));
const bindings = new Set(kinds('BindingRecord'));

/** These partition validated records; the schema remains the collection membership authority. */
export function isScanFrameworkRecord(record: ScanRecord): record is FrameworkRecord {
  return framework.has(record.kind);
}
export function isScanBindingRecord(record: ScanRecord): record is BindingRecord {
  return bindings.has(record.kind);
}
