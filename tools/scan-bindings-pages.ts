import type { ScanDocument } from '@/domain/scan/scan.generated';
import {
  isScanBindingRecord,
  isScanFrameworkRecord,
} from '@/infrastructure/scan/record-collections';
import { createScanRecordReader } from '@/infrastructure/scan/record-pages';

export type BindingEvidencePage = ReturnType<ReturnType<typeof createScanRecordReader>['page']>;

const DEFAULT_TOTAL_LIMITS = { maxTotalRecords: 8192, maxTotalBytes: 16_777_216 };

/** Every proof input must have crossed the same bounded API and byte/record limits. */
export function bindingReviewPages(
  document: ScanDocument,
  ids: readonly string[],
  limits = DEFAULT_TOTAL_LIMITS,
): readonly BindingEvidencePage[] {
  if (ids.length > limits.maxTotalRecords) {
    throw new Error(`Selected evidence exceeds ${String(limits.maxTotalRecords)} records.`);
  }
  const reader = createScanRecordReader(document);
  const pages: BindingEvidencePage[] = [];
  let bytes = 0;
  const append = (current: BindingEvidencePage) => {
    if (current.limit === 'oversized-record') {
      throw new Error('Selected evidence has an oversized record.');
    }
    pages.push(current);
    bytes += Buffer.byteLength(JSON.stringify(current));
    if (bytes > limits.maxTotalBytes) {
      throw new Error('Selected evidence exceeds its total byte limit.');
    }
  };
  for (let offset = 0; offset < ids.length; offset += 32) {
    const request = { ids: ids.slice(offset, offset + 32), maxRecords: 4, maxBytes: 65_536 };
    let page = reader.page(request);
    append(page);
    while (page.nextCursor !== null) {
      page = reader.page({ ...request, cursor: page.nextCursor });
      append(page);
    }
  }
  return pages;
}

/** No original document collections are carried into this query projection. */
export function bindingReviewDocument(
  id: string,
  pages: readonly BindingEvidencePage[],
): ScanDocument {
  const records = pages.flatMap((page) => page.records);
  return {
    format: 'scan/v1',
    id,
    sources: records.filter((record) => record.kind === 'source'),
    hosts: records.filter((record) => record.kind === 'host'),
    semantic: records.filter(
      (record) => record.kind === 'semantic_node' || record.kind === 'semantic_edge',
    ),
    framework: records.filter(isScanFrameworkRecord),
    bindings: records.filter(isScanBindingRecord),
    summaries: records.filter((record) => record.kind === 'summary'),
    gaps: records.filter((record) => record.kind === 'gap'),
    rules: [],
    derivations: [],
    obligations: [],
    receipts: [],
    contracts: records.filter((record) => record.kind === 'contract'),
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
  };
}
