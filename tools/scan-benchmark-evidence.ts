import type { ScanDocument } from '@/domain/scan/scan.generated';
import { createScanRecordReader } from '@/infrastructure/scan/record-pages';

import type { DepthResult } from './scan-benchmark-depth-facts';

interface EvidencePages {
  readonly selectedRecords: number;
  readonly deliveredRecords: number;
  readonly pages: number;
  readonly bytes: number;
  readonly pageByteBudget: number;
  readonly complete: boolean;
  readonly continued: boolean;
}

function readChunk(
  reader: ReturnType<typeof createScanRecordReader>,
  ids: readonly string[],
): EvidencePages {
  const input = { ids, maxRecords: 4, maxBytes: 65_536 };
  let page = reader.page(input);
  let pages = 1;
  let deliveredRecords = page.records.length;
  let bytes = Buffer.byteLength(JSON.stringify(page));
  while (page.nextCursor !== null && pages < 16) {
    page = reader.page({ ...input, cursor: page.nextCursor });
    pages += 1;
    deliveredRecords += page.records.length;
    bytes += Buffer.byteLength(JSON.stringify(page));
  }
  return {
    selectedRecords: ids.length,
    deliveredRecords,
    pages,
    bytes,
    pageByteBudget: input.maxBytes,
    complete: deliveredRecords === ids.length && page.limit !== 'oversized-record',
    continued: page.nextCursor !== null,
  };
}

/** Fetch every asserted semantic record and its direct source anchor without recursive closure. */
export function benchmarkEvidence(
  document: ScanDocument,
  depth: readonly DepthResult[],
): EvidencePages {
  const reader = createScanRecordReader(document);
  const evidence = [...new Set(depth.flatMap((check) => check.evidence))];
  const sources = (document.semantic ?? []).flatMap((record) =>
    evidence.includes(record.id) ? [record.source] : [],
  );
  const ids = [...new Set([...evidence, ...sources])];
  if (ids.length > 256) throw new Error('Benchmark evidence exceeds the total record budget');
  const results = Array.from({ length: Math.ceil(ids.length / 32) }, (_, chunk) =>
    readChunk(reader, ids.slice(chunk * 32, (chunk + 1) * 32)),
  );
  return {
    selectedRecords: ids.length,
    deliveredRecords: results.reduce((count, result) => count + result.deliveredRecords, 0),
    pages: results.reduce((count, result) => count + result.pages, 0),
    bytes: results.reduce((count, result) => count + result.bytes, 0),
    pageByteBudget: 65_536,
    complete: evidence.length > 0 && results.every((result) => result.complete),
    continued: results.some((result) => result.continued),
  };
}
