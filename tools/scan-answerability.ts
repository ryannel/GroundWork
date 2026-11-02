import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createScanRecordReader } from '@/infrastructure/scan/record-pages';
import { scanValidator } from '@/infrastructure/scan/scan-format';

import { answerabilityProbe } from './scan-answerability-probe';
import { answerabilityRequest } from './scan-answerability-request';
import { semanticGraph } from './scan-semantic-query';

type EvidencePage = ReturnType<ReturnType<typeof createScanRecordReader>['page']>;
interface ProbeReceipt extends ReturnType<typeof answerabilityProbe> {
  readonly totalRecordBudget: number;
  readonly complete: boolean;
  readonly pageCount: number;
  readonly bytes: number;
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

function evidencePages(reader: ReturnType<typeof createScanRecordReader>, ids: readonly string[]) {
  const pages: EvidencePage[] = [];
  const selected = ids.slice(0, 2048);
  for (let offset = 0; offset < selected.length && pages.length < 512; offset += 32) {
    const input = {
      ids: selected.slice(offset, offset + 32),
      maxRecords: 4,
      maxBytes: 65_536,
    };
    let page = reader.page(input);
    pages.push(page);
    while (page.nextCursor !== null && pages.length < 512) {
      page = reader.page({ ...input, cursor: page.nextCursor });
      pages.push(page);
    }
  }
  return pages;
}

/** Probe local native relationships; these receipts never close a broader user question. */
async function run(args: readonly string[]): Promise<void> {
  const [documentFile, specificationFile, output] = args;
  if (
    documentFile === undefined ||
    specificationFile === undefined ||
    output === undefined ||
    args.length !== 3
  ) {
    throw new Error('Usage: scan-answerability.ts <document.json> <probes.json> <output>');
  }
  const parse = await scanValidator();
  const document = parse(JSON.parse(await readFile(documentFile, 'utf8')));
  const probes = answerabilityRequest(JSON.parse(await readFile(specificationFile, 'utf8')));
  const graph = semanticGraph(document);
  const reader = createScanRecordReader(document);
  await mkdir(output, { recursive: true });
  const receipts: ProbeReceipt[] = [];
  for (const probe of probes) {
    const result = answerabilityProbe(graph, probe);
    const pages = evidencePages(reader, result.evidence);
    const complete =
      result.evidence.length > 0 &&
      pages.reduce((count, page) => count + page.records.length, 0) === result.evidence.length;
    const receipt: ProbeReceipt = {
      ...result,
      status: complete ? result.status : 'unresolved',
      totalRecordBudget: 2048,
      complete,
      pageCount: pages.length,
      bytes: pages.reduce((count, page) => count + Buffer.byteLength(JSON.stringify(page)), 0),
    };
    await writeJson(path.join(output, `${probe.id}.json`), { receipt, pages });
    receipts.push(receipt);
  }
  await writeJson(path.join(output, 'receipts.json'), receipts);
  console.log(JSON.stringify(receipts, null, 2));
}

if (process.argv[1] === import.meta.filename) {
  await run(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
