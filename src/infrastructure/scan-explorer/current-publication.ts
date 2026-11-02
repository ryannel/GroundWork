import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import type { ScanDocument } from '@/domain/scan/scan.generated';
import { scanValidator } from '@/infrastructure/scan/scan-format';
import { sourceDigest } from '@/infrastructure/scan/source-index';

const recordShape = z.object({ kind: z.string(), id: z.string() }).loose();
const pagesShape = z.array(
  z.object({ snapshot: z.string(), records: z.array(recordShape) }).loose(),
);
const receiptShape = z.object({ pagesChecksum: z.string() }).loose();
const FRAMEWORK = new Set([
  'source_framework_binding',
  'route_binding',
  'schema_binding',
  'security_binding',
  'aspnet_route_binding',
]);

/** Reconstitute and validate the native record closure already returned by the public bounded query. */
export async function currentQueryPublication(directory: string): Promise<ScanDocument> {
  const [raw, receipt, validate] = await Promise.all([
    readFile(/* turbopackIgnore: true */ path.join(directory, 'pages.json'), 'utf8'),
    readFile(/* turbopackIgnore: true */ path.join(directory, 'receipt.json'), 'utf8'),
    scanValidator(),
  ]);
  const parsed: unknown = JSON.parse(raw);
  const pages = pagesShape.parse(parsed);
  const publication = receiptShape.parse(JSON.parse(receipt));
  if (publication.pagesChecksum !== sourceDigest(JSON.stringify(parsed))) {
    throw new Error('Current query pages checksum mismatch');
  }
  const snapshot = pages[0]?.snapshot;
  if (snapshot === undefined || pages.some((page) => page.snapshot !== snapshot)) {
    throw new Error('Current query snapshot mismatch');
  }
  const records = [
    ...new Map(pages.flatMap((page) => page.records).map((record) => [record.id, record])).values(),
  ];
  const kind = (name: string) => records.filter((record) => record.kind === name);
  return validate({
    format: 'scan/v1',
    id: snapshot,
    sources: kind('source'),
    hosts: kind('host'),
    contracts: kind('contract'),
    gaps: kind('gap'),
    summaries: kind('summary'),
    semantic: records.filter(
      (record) => record.kind === 'semantic_node' || record.kind === 'semantic_edge',
    ),
    framework: records.filter((record) => FRAMEWORK.has(record.kind)),
    bindings: records.filter(
      (record) => record.kind.endsWith('_binding') && !FRAMEWORK.has(record.kind),
    ),
    rules: [],
    derivations: [],
    obligations: [],
    receipts: [],
    effects: [],
    actors: [],
    surfaces: [],
    controls: [],
    actions: [],
    outcomes: [],
    executions: [],
    journeys: [],
    dependencies: [],
    closures: [],
  });
}
