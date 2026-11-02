import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { scanValidator } from '@/infrastructure/scan/scan-format';

import { bindingReviewMutations } from './scan-bindings-mutations';
import { bindingReviewDocument, bindingReviewPages } from './scan-bindings-pages';
import { bindingReviewProofs } from './scan-bindings-proofs';
import { bindingReviewSelection } from './scan-bindings-selection';

async function run(args: readonly string[]): Promise<void> {
  const [input, output] = args;
  if (input === undefined || output === undefined || args.length !== 2) {
    throw new Error('Usage: scan-bindings-review.ts <document.json> <NEW-output>');
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
    throw new Error('Evidence is outside the frozen repository revision.');
  }
  const ids = bindingReviewSelection(document);
  const pages = bindingReviewPages(document, ids);
  const bounded = bindingReviewDocument(document.id, pages);
  const returned = new Set(pages.flatMap((page) => page.records).map((record) => record.id));
  const complete = returned.size === ids.length && ids.every((id) => returned.has(id));
  const analysis = {
    proofs: bindingReviewProofs(bounded),
    mutations: bindingReviewMutations(bounded),
  };
  const receipt = {
    format: 'bindings-review/v1',
    input: path.resolve(input),
    snapshot: pages[0]?.snapshot,
    complete,
    selectedRecords: ids.length,
    returnedRecords: returned.size,
    pages: pages.length,
    bytes: Buffer.byteLength(JSON.stringify(pages)),
    ...analysis,
  };
  await mkdir(output);
  await writeFile(path.join(output, 'pages.json'), `${JSON.stringify(pages, null, 2)}\n`, {
    flag: 'wx',
  });
  await writeFile(path.join(output, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, {
    flag: 'wx',
  });
  console.log(JSON.stringify(receipt));
  if (
    !complete ||
    !Object.values(analysis.proofs).every((proof) => proof.supported) ||
    analysis.mutations.some((mutation) => !mutation.rejected)
  ) {
    process.exitCode = 1;
  }
}

if (process.argv[1] === import.meta.filename) await run(process.argv.slice(2));
