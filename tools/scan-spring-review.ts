import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { scanRecords } from '@/domain/scan/scan-records';
import type { ScanDocument } from '@/domain/scan/scan.generated';
import { createScanRecordReader } from '@/infrastructure/scan/record-pages';
import { scanValidator } from '@/infrastructure/scan/scan-format';

import { CUSTOMER_SPRING_ROUTES, reviewSpringRoutes } from './scan-spring-review-routes';

type EvidencePage = ReturnType<ReturnType<typeof createScanRecordReader>['page']>;

function pagesOf(document: ScanDocument): readonly EvidencePage[] {
  const ids = scanRecords(document).map((record) => record.id);
  if (ids.length > 8192) throw new Error('Framework evidence exceeds 8192 selected records.');
  const reader = createScanRecordReader(document);
  const pages: EvidencePage[] = [];
  for (let offset = 0; offset < ids.length; offset += 32) {
    const request = { ids: ids.slice(offset, offset + 32), maxRecords: 4, maxBytes: 65_536 };
    let page = reader.page(request);
    pages.push(page);
    while (page.nextCursor !== null) {
      page = reader.page({ ...request, cursor: page.nextCursor });
      pages.push(page);
    }
  }
  if (pages.some((page) => page.limit === 'oversized-record')) {
    throw new Error('Oversized evidence.');
  }
  if (Buffer.byteLength(JSON.stringify(pages)) > 33_554_432) {
    throw new Error('Evidence exceeds 32 MiB.');
  }
  return pages;
}

function boundedDocument(document: ScanDocument, pages: readonly EvidencePage[]): ScanDocument {
  const records = pages.flatMap((page) => page.records);
  return {
    ...document,
    sources: records.filter((record) => record.kind === 'source'),
    hosts: records.filter((record) => record.kind === 'host'),
    framework: records.filter(
      (record) =>
        record.kind === 'route_binding' ||
        record.kind === 'schema_binding' ||
        record.kind === 'security_binding',
    ),
  };
}

async function run(args: readonly string[]): Promise<void> {
  const [input, output] = args;
  if (input === undefined || output === undefined || args.length !== 2) {
    throw new Error('Usage: scan-spring-review.ts <document.json> <NEW-output>');
  }
  const parse = await scanValidator();
  const document = parse(JSON.parse(await readFile(input, 'utf8')));
  if (
    !document.sources.every(
      (source) =>
        source.repo === 'volvo-cars/cds-ecom-customer-service' &&
        source.commit === '09623ab3a1f39845d8fc02abc3d591b53a3b5fea',
    )
  ) {
    throw new Error('Source is outside the frozen repository revision.');
  }
  const pages = pagesOf(document);
  const bounded = boundedDocument(document, pages);
  const proof = reviewSpringRoutes(bounded, CUSTOMER_SPRING_ROUTES);
  const complete =
    pages.reduce((count, page) => count + page.records.length, 0) === scanRecords(document).length;
  const receipt = {
    format: 'spring-review/v1',
    input: path.resolve(input),
    snapshot: pages[0]?.snapshot,
    complete,
    pageCount: pages.length,
    records: scanRecords(bounded).length,
    bytes: Buffer.byteLength(JSON.stringify(pages)),
    q01: proof,
  };
  await mkdir(output);
  await writeFile(path.join(output, 'pages.json'), `${JSON.stringify(pages, null, 2)}\n`, {
    flag: 'wx',
  });
  await writeFile(path.join(output, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, {
    flag: 'wx',
  });
  console.log(JSON.stringify(receipt));
  if (!complete || !proof.supported) process.exitCode = 1;
}

if (process.argv[1] === import.meta.filename) {
  await run(process.argv.slice(2));
}
